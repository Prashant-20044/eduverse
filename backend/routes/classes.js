const express = require('express');
const router = express.Router();
const Class = require('../models/Class');
const { protect } = require('./auth');
const { AccessToken } = require('livekit-server-sdk');
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');

const ensureTeacher = (req, res, next) => {
  if (req.user?.role !== 'teacher') {
    return res.status(403).json({ success: false, message: 'Teacher access required' });
  }
  next();
};

const cleanupExpiredClasses = async () => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    await Class.deleteMany({
      status: 'scheduled',
      scheduledAt: { $lt: startOfToday }
    });
  } catch (err) {
    console.error('Cleanup expired classes error:', err);
  }
};

router.get('/teacher', protect, ensureTeacher, async (req, res) => {
  try {
    await cleanupExpiredClasses();
    const classes = await Class.find({ teacherId: req.user._id })
      .sort({ scheduledAt: 1, createdAt: -1 });

    res.json({ success: true, classes });
  } catch (err) {
    console.error('Fetch teacher classes error:', err);
    res.status(500).json({ success: false, message: 'Could not fetch classes' });
  }
});

router.get('/live', protect, cacheMiddleware('live_classes'), async (req, res) => {
  try {
    await cleanupExpiredClasses();
    const query = { status: 'live' };
    if (req.user.role === 'student') {
      if (!req.user.teacherId) {
        return res.json({ success: true, classes: [] });
      }
      query.teacherId = req.user.teacherId;
    }

    const classes = await Class.find(query)
      .populate('teacherId', 'name avatar')
      .sort({ updatedAt: -1 });

    res.json({ success: true, classes });
  } catch (err) {
    console.error('Fetch live classes error:', err);
    res.status(500).json({ success: false, message: 'Could not fetch live classes' });
  }
});

router.get('/materials/all', protect, cacheMiddleware('materials'), async (req, res) => {
  try {
    const query = { materials: { $exists: true, $ne: [] } };
    if (req.user.role === 'student') {
      if (!req.user.teacherId) {
        return res.json({ success: true, classes: [] });
      }
      query.teacherId = req.user.teacherId;
    }

    const classes = await Class.find(query)
      .populate('teacherId', 'name avatar')
      .sort({ updatedAt: -1 });

    res.json({ success: true, classes });
  } catch (err) {
    console.error('Fetch materials error:', err);
    res.status(500).json({ success: false, message: 'Could not fetch materials' });
  }
});

router.get('/:classId', protect, async (req, res) => {
  try {
    const classObj = await Class.findById(req.params.classId)
      .populate('teacherId', 'name avatar');

    if (!classObj) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    if (req.user.role === 'student' && classObj.teacherId?._id?.toString() !== req.user.teacherId?.toString()) {
      return res.status(403).json({ success: false, message: 'You are not enrolled in this coaching' });
    }

    res.json({ success: true, class: classObj });
  } catch (err) {
    console.error('Fetch class error:', err);
    res.status(500).json({ success: false, message: 'Could not fetch class' });
  }
});

router.post('/', protect, ensureTeacher, async (req, res) => {
  try {
    const { topic, description, scheduledAt } = req.body;

    if (!topic?.trim()) {
      return res.status(400).json({ success: false, message: 'Topic is required' });
    }

    const scheduledDate = scheduledAt ? new Date(scheduledAt) : new Date();
    // Allow a 1-minute grace period for clock skew
    if (scheduledDate.getTime() < Date.now() - 60000) {
      return res.status(400).json({ success: false, message: 'Cannot schedule classes in the past' });
    }

    const classObj = await Class.create({
      topic: topic.trim(),
      description: description?.trim() || '',
      scheduledAt: scheduledDate,
      teacherId: req.user._id,
      status: 'scheduled',
    });

    // Invalidate live/materials cache
    await invalidateCache('live_classes');
    await invalidateCache('materials');

    res.status(201).json({ success: true, class: classObj });
  } catch (err) {
    console.error('Create class error:', err);
    res.status(500).json({ success: false, message: 'Could not create class' });
  }
});

router.patch('/:classId/start', protect, ensureTeacher, async (req, res) => {
  try {
    const classObj = await Class.findOne({
      _id: req.params.classId,
      teacherId: req.user._id,
    });

    if (!classObj) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    classObj.status = 'live';
    await classObj.save();

    await invalidateCache('live_classes');

    res.json({ success: true, class: classObj });
  } catch (err) {
    console.error('Start class error:', err);
    res.status(500).json({ success: false, message: 'Could not start class' });
  }
});

router.patch('/:classId/end', protect, ensureTeacher, async (req, res) => {
  try {
    const classObj = await Class.findOne({
      _id: req.params.classId,
      teacherId: req.user._id,
    });

    if (!classObj) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    classObj.status = 'ended';
    await classObj.save();

    await invalidateCache('live_classes');

    res.json({ success: true, class: classObj });
  } catch (err) {
    console.error('End class error:', err);
    res.status(500).json({ success: false, message: 'Could not end class' });
  }
});

router.get('/:classId/livekit-token', protect, async (req, res) => {
  try {
    const classObj = await Class.findById(req.params.classId);
    if (!classObj) return res.status(404).json({ success: false, message: 'Class not found' });

    if (req.user.role === 'student' && classObj.teacherId?.toString() !== req.user.teacherId?.toString()) {
      return res.status(403).json({ success: false, message: 'You are not enrolled in this coaching' });
    }

    const roomName = classObj._id.toString();
    const participantName = req.user.name || req.user.email;
    const isTeacher = req.user.role === 'teacher';

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: req.user._id.toString(),
        name: participantName,
      }
    );
    
    at.addGrant({ 
        roomJoin: true, 
        room: roomName,
        canPublish: isTeacher,
        canPublishData: true,
        canSubscribe: true 
    });

    const token = await at.toJwt();
    res.json({ 
        success: true, 
        token,
        serverUrl: process.env.LIVEKIT_URL 
    });
  } catch (err) {
    console.error('LiveKit token error:', err);
    res.status(500).json({ success: false, message: 'Could not generate LiveKit token' });
  }
});

module.exports = router;
