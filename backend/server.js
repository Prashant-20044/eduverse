const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load env before other requires
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const { initRedis } = require('./redisClient');
const { createAdapter } = require('@socket.io/redis-adapter');

mongoose.set('bufferCommands', false);

const app = express();
const server = http.createServer(app);

const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5175'
];

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
  .concat(defaultOrigins);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true,
};

app.use(cors(corsOptions));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Socket.io initialization
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by Socket.IO CORS'));
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

require('./socket')(io); // Setup socket handlers

const { apiLimiter } = require('./middleware/rateLimiter');

// Apply global API rate limit
app.use('/api', apiLimiter);

app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/redis')) {
    return next();
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: 'Database is not connected. Check MongoDB Atlas network access or CONNECTION_STRING.',
    });
  }

  next();
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/classes', require('./routes/classes'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/tests', require('./routes/tests'));
app.use('/api/redis', require('./routes/redisTest'));

// --- Serve frontend static files ---
const frontendDistPath = path.join(__dirname, '..', 'frontend', 'dist');
// Asset logger + explicit asset handler to surface missing-file errors in deployments
app.use('/assets', (req, res, next) => {
  try {
    const assetRelPath = req.path;
    const assetFullPath = path.join(frontendDistPath, assetRelPath);
    console.log(`[assets] ${req.method} ${req.originalUrl} -> ${assetFullPath}`);

    if (!fs.existsSync(assetFullPath)) {
      console.error(`[assets] NOT FOUND: ${assetFullPath}`);
      return res.status(404).end();
    }

    return res.sendFile(assetFullPath, (err) => {
      if (err) {
        console.error(`[assets] sendFile error for ${assetFullPath}:`, err);
        if (!res.headersSent) res.status(500).end();
      }
    });
  } catch (err) {
    console.error('[assets] handler error:', err);
    return next(err);
  }
});

if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath, {
    etag: false,
    lastModified: false,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-store');
    },
  }));
} else {
  console.warn(`Warning: frontend dist not found at ${frontendDistPath}. Static asset serving is disabled.`);
}

// Catch-all: send index.html for SPA client-side routing, but only for HTML requests.
app.get(/.*/, (req, res, next) => {
  // If the client doesn't accept HTML (likely an asset request), return 404.
  if (!req.accepts || !req.accepts('html')) {
    return res.status(404).end();
  }

  const indexPath = path.join(frontendDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error sending index.html:', err);
      // Don't accidentally send HTML for missing assets — forward to next handler.
      return next();
    }
  });
});

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.CONNECTION_STRING).then(async () => {
  console.log('Connected to MongoDB');

  const pubClient = await initRedis();
  if (pubClient) {
    try {
      const subClient = pubClient.duplicate();
      await subClient.connect();
      io.adapter(createAdapter(pubClient, subClient));
      console.log('Socket.IO Redis Adapter initialized');
    } catch (err) {
      console.error('Socket.IO Redis Adapter initialization failed:', err);
    }
  }
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});

// Always start the server for testing even if MongoDB fails
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Generic error handler (logs and returns JSON)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err && err.stack ? err.stack : err);
  if (res.headersSent) return next(err);
  res.status(err?.status || 500).json({ success: false, message: err?.message || 'Internal Server Error' });
});
