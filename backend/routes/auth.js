const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { authLimiter } = require('../middleware/rateLimiter');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || 'dummy_client_id');

// Simple helper to generate JWT
const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.SECRET_KEY || 'secret', { expiresIn: '7d' });
};

const serializeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  teacherId: user.teacherId,
  createdAt: user.createdAt,
});

const ensureTeacher = (req, res, next) => {
  if (req.user?.role !== 'teacher') {
    return res.status(403).json({ success: false, message: 'Teacher access required' });
  }
  next();
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

    if (role && role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Student accounts are created by teachers. Please use the credentials from your coaching.',
      });
    }

    // Check if user exists
    let user = await User.findOne({ email });

    if (!user) {
      // Create new user
      user = new User({
        name,
        email,
        role: 'teacher',
        oauthId: sub || 'mock_sub',
        avatar: picture
      });
      await user.save();
    } else {
      if (user.role === 'student') {
        return res.status(403).json({
          success: false,
          message: 'Student accounts must use the credentials provided by their coaching.',
        });
      }

      const requestedRole = role === 'teacher' ? 'teacher' : user.role;

      // Preserve the user's custom name if they signed up with email/password.
      // Only pull the name from Google for pure OAuth accounts (no password set).
      const resolvedName = user.password
        ? user.name                  // email/password account → keep their chosen username
        : (name || user.name);       // OAuth-only account → sync name from Google

      const profileUpdates = {
        name: resolvedName,
        // Always update avatar from Google (nice to have fresh profile picture)
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
      user: serializeUser(user)
    });

  } catch (err) {
    console.error('OAuth error:', err);
    res.status(500).json({ success: false, message: 'Authentication failed' });
  }
});

// @route POST /api/auth/signup
// @desc Register a teacher account with email and password
// Add strict rate limiting to prevent brute force password guessing
router.post('/signup', authLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();
    const trimmedName = name?.trim();

    if (!trimmedName || !normalizedEmail || !password) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    // Check if user already exists
    let user = await User.findOne({ email: normalizedEmail });
    if (user) {
      if (user.password) {
        return res.status(400).json({ success: false, message: 'A user with this email already exists' });
      }

      // Allow users who originally joined with Google to add email/password login.
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
      user.name = trimmedName;
      user.role = 'teacher';
      user.teacherId = null;
      await user.save();

      const token = generateToken(user);

      return res.status(200).json({
        success: true,
        token,
        user: serializeUser(user)
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    user = new User({
      name: trimmedName,
      email: normalizedEmail,
      password: hashedPassword,
      role: 'teacher',
      teacherId: null,
    });

    await user.save();

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      token,
      user: serializeUser(user)
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

// @route POST /api/auth/login
// @desc Authenticate custom user with email and password
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    // Check for user
    const user = await User.findOne({ email: normalizedEmail });
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
      user: serializeUser(user)
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
  res.json({ success: true, user: serializeUser(req.user) });
});

router.get('/students', protect, ensureTeacher, async (req, res) => {
  try {
    const students = await User.find({ role: 'student', teacherId: req.user._id })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({ success: true, students: students.map(serializeUser) });
  } catch (err) {
    console.error('Fetch students error:', err);
    res.status(500).json({ success: false, message: 'Could not fetch students' });
  }
});

router.post('/students', protect, ensureTeacher, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();
    const trimmedName = name?.trim();

    if (!trimmedName || !normalizedEmail || !password) {
      return res.status(400).json({ success: false, message: 'Please provide student name, email, and password' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Student password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'A user with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const student = await User.create({
      name: trimmedName,
      email: normalizedEmail,
      password: hashedPassword,
      role: 'student',
      teacherId: req.user._id,
    });

    res.status(201).json({ success: true, student: serializeUser(student) });
  } catch (err) {
    console.error('Create student error:', err);
    res.status(500).json({ success: false, message: 'Could not create student' });
  }
});

module.exports = router;
module.exports.protect = protect;
