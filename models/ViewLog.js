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
  timestamp: {
    type: Date,
    default: Date.now,
    expires: 1800
  }
});

viewLogSchema.index({ videoId: 1, ip: 1 });

module.exports = mongoose.model('ViewLog', viewLogSchema);