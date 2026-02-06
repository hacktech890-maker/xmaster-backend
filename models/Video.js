const mongoose = require('mongoose');
const slugify = require('slugify');

const videoSchema = new mongoose.Schema({
  // Abyss.to Data
  file_code: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  embed_code: {
    type: String,
    default: ''
  },
  
  // Video Info
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  slug: {
    type: String,
    unique: true,
    sparse: true
  },
  description: {
    type: String,
    default: '',
    maxlength: 5000
  },
  thumbnail: {
    type: String,
    required: true
  },
  thumbnailPublicId: {
    type: String,
    default: ''
  },
  duration: {
    type: String,
    default: '00:00'
  },
  
  // Organization
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  
  // Stats
  views: {
    type: Number,
    default: 0,
    index: true
  },
  likes: {
    type: Number,
    default: 0
  },
  dislikes: {
    type: Number,
    default: 0
  },
  
  // Settings
  status: {
    type: String,
    enum: ['public', 'private', 'unlisted', 'processing'],
    default: 'public',
    index: true
  },
  featured: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Quality
  quality: {
    type: String,
    enum: ['360p', '480p', '720p', '1080p', '4K', 'unknown'],
    default: 'unknown'
  },
  
  // Timestamps
  uploadDate: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Create slug before saving
videoSchema.pre('save', function(next) {
  if (this.title && (!this.slug || this.isModified('title'))) {
    this.slug = slugify(this.title, { 
      lower: true, 
      strict: true,
      remove: /[*+~.()'"!:@]/g
    }) + '-' + this.file_code.substring(0, 8);
  }
  
  // Generate embed code if not present
  if (this.file_code && !this.embed_code) {
    this.embed_code = `https://abyss.to/e/${this.file_code}`;
  }
  
  next();
});

// Indexes
videoSchema.index({ title: 'text', tags: 'text', description: 'text' });
videoSchema.index({ views: -1, uploadDate: -1 });
videoSchema.index({ category: 1, status: 1 });
videoSchema.index({ featured: 1, uploadDate: -1 });
videoSchema.index({ status: 1, uploadDate: -1 });
videoSchema.index({ tags: 1 });

// Virtual for embed URL
videoSchema.virtual('embedUrl').get(function() {
  return `https://abyss.to/e/${this.file_code}`;
});

// Virtual for watch URL
videoSchema.virtual('watchUrl').get(function() {
  return `/watch/${this._id}/${this.slug}`;
});

// Ensure virtuals are included in JSON
videoSchema.set('toJSON', { virtuals: true });
videoSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Video', videoSchema);