const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  topic: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  scheduledAt: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'live', 'ended'],
    default: 'scheduled'
  },
  materials: [{
    url: String, // Cloudinary URL
    publicId: String,
    filename: String,
    type: String // e.g., 'image', 'video', 'pdf'
  }],
  recordingUrl: {
    type: String, // Path or URL to the finished stream recording
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Class', classSchema);
