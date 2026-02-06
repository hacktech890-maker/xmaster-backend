const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  placement: {
    type: String,
    required: true,
    enum: [
      'home_top',
      'home_sidebar',
      'home_infeed',
      'home_footer',
      'watch_sidebar',
      'watch_below',
      'watch_related',
      'watch_overlay',
      'search_top',
      'category_top',
      'popunder',
      'interstitial'
    ]
  },
  type: {
    type: String,
    enum: ['banner', 'script', 'html', 'image', 'video'],
    default: 'script'
  },
  code: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    default: ''
  },
  targetUrl: {
    type: String,
    default: ''
  },
  size: {
    width: { type: Number, default: 728 },
    height: { type: Number, default: 90 }
  },
  device: {
    type: String,
    enum: ['all', 'desktop', 'mobile'],
    default: 'all'
  },
  enabled: {
    type: Boolean,
    default: true
  },
  
  // Stats
  impressions: {
    type: Number,
    default: 0
  },
  clicks: {
    type: Number,
    default: 0
  },
  
  // Schedule
  startDate: {
    type: Date,
    default: null
  },
  endDate: {
    type: Date,
    default: null
  },
  priority: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index
adSchema.index({ placement: 1, enabled: 1 });
adSchema.index({ device: 1 });
adSchema.index({ priority: -1 });

// Virtual for CTR
adSchema.virtual('ctr').get(function() {
  if (this.impressions === 0) return 0;
  return ((this.clicks / this.impressions) * 100).toFixed(2);
});

adSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Ad', adSchema);