const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || 'dummy_client_id');

// Simple helper to generate JWT
const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.SECRET_KEY || 'secret', { expiresIn: '7d' });
};

// @route POST /api/auth/google
// @desc Authenticate with Google
router.post('/google', async (req, res) => {
  try {
    const { credential, role } = req.body;
    
    let payload;

    if (!credential) {
      return res.status(400).json({ success: false, message: 'Missing Google credential' });
    }

    // The current frontend uses Google's access token to fetch the user profile,
    // then sends that profile object here. Keep ID-token support for future flows.
    if (typeof credential === 'object' && credential.email) {
      payload = credential;
    } else if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'dummy_client_id') {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } else {
      payload = typeof credential === 'string' ? JSON.parse(credential) : credential;
    }

    const { email, name, picture, sub } = payload;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Google profile is missing an email' });
    }

    // Check if user exists
    let user = await User.findOne({ email });

    if (!user) {
      // Create new user
      user = new User({
        name,
        email,
        role: role || 'student', // Default to student if not provided
        oauthId: sub || 'mock_sub',
        avatar: picture
      });
      await user.save();
    } else {
      const requestedRole = ['teacher', 'student'].includes(role) ? role : user.role;
      const profileUpdates = {
        name: name || user.name,
        avatar: picture || user.avatar,
        role: requestedRole,
      };

      Object.assign(user, profileUpdates);
      await user.save();
    }

    // Generate our own JWT
    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      }
    });

  } catch (err) {
    console.error('OAuth error:', err);
    res.status(500).json({ success: false, message: 'Authentication failed' });
  }
});

// @route POST /api/auth/signup
// @desc Register custom user with email and password
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    const requestedRole = ['teacher', 'student'].includes(role) ? role : 'student';

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ success: false, message: 'A user with this email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    user = new User({
      name,
      email,
      password: hashedPassword,
      role: requestedRole
    });

    await user.save();

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

// @route POST /api/auth/login
// @desc Authenticate custom user with email and password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    // Check for user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    // If user registered with Google OAuth and doesn't have a password set
    if (!user.password) {
      return res.status(400).json({ 
        success: false, 
        message: 'This account was registered using Google. Please log in using Google OAuth.' 
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// Middleware to verify JWT
const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY || 'secret');
    req.user = await User.findById(decoded.id).select('-password');
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Token failed' });
  }
};

router.get('/me', protect, (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;
module.exports.protect = protect;
