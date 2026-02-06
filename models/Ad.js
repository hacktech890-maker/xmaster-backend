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
      'home_top', 'home_sidebar', 'home_infeed', 'home_footer',
      'watch_sidebar', 'watch_below', 'watch_related', 'watch_overlay',
      'search_top', 'category_top', 'popunder', 'interstitial'
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
  device: {
    type: String,
    enum: ['all', 'desktop', 'mobile'],
    default: 'all'
  },
  enabled: {
    type: Boolean,
    default: true
  },
  impressions: {
    type: Number,
    default: 0
  },
  clicks: {
    type: Number,
    default: 0
  },
  priority: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Ad', adSchema);