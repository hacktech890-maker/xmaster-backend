const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  videoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video',
    required: true
  },
  reason: {
    type: String,
    enum: ['broken', 'copyright', 'inappropriate', 'spam', 'misleading', 'other'],
    required: true
  },
  description: {
    type: String,
    default: '',
    maxlength: 1000
  },
  email: {
    type: String,
    default: ''
  },
  ip: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'reviewing', 'resolved', 'dismissed'],
    default: 'pending'
  },
  adminNotes: {
    type: String,
    default: ''
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ videoId: 1 });

module.exports = mongoose.model('Report', reportSchema);