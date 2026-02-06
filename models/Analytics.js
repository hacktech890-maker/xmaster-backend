const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  videoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  views: {
    type: Number,
    default: 0
  },
  uniqueViews: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  dislikes: {
    type: Number,
    default: 0
  },
  shares: {
    type: Number,
    default: 0
  },
  avgWatchTime: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
analyticsSchema.index({ videoId: 1, date: 1 }, { unique: true });
analyticsSchema.index({ date: 1 });

module.exports = mongoose.model('Analytics', analyticsSchema);