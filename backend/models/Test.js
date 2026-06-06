const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
  },
  options: [{
    type: String,
    required: true,
  }],
  correctAnswer: {
    type: Number,
    required: true,
    min: 0,
  },
}, { _id: true });

const testSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  durationMinutes: {
    type: Number,
    required: true,
    min: 1,
  },
  questions: [questionSchema],
  isPublished: {
    type: Boolean,
    default: true,
  },
  sourceFilename: {
    type: String,
    default: '',
  },
}, { timestamps: true });

module.exports = mongoose.model('Test', testSchema);
