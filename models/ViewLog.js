const mongoose = require('mongoose');

const viewLogSchema = new mongoose.Schema({
  videoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video',
    required: true
  },
  ip: {
    type: String,
    required: true
  },
  sessionId: {
    type: String,
    default: ''
  },
  userAgent: {
    type: String,
    default: ''
  },
  referer: {
    type: String,
    default: ''
  },
  country: {
    type: String,
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now,
    expires: 1800 // Auto-delete after 30 minutes (for anti-spam)
  }
});

// Compound index for efficient duplicate checking
viewLogSchema.index({ videoId: 1, ip: 1 });
viewLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 1800 });

module.exports = mongoose.model('ViewLog', viewLogSchema);