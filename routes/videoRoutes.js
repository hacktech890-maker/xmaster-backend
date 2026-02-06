const express = require('express');
const router = express.Router();
const Video = require('../models/Video');
const ViewLog = require('../models/ViewLog');
const Report = require('../models/Report');

// GET /api/videos
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, sort = 'newest', category = '', tag = '' } = req.query;
    const query = { status: 'public' };

    if (category) query.category = category;
    if (tag) query.tags = { $in: [tag.toLowerCase()] };

    let sortOption = {};
    switch (sort) {
      case 'oldest': sortOption = { uploadDate: 1 }; break;
      case 'views': sortOption = { views: -1 }; break;
      case 'likes': sortOption = { likes: -1 }; break;
      default: sortOption = { uploadDate: -1 };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [videos, total] = await Promise.all([
      Video.find(query).populate('category', 'name slug').sort(sortOption).skip(skip).limit(parseInt(limit)),
      Video.countDocuments(query)
    ]);

    res.json({
      success: true,
      videos,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    console.error('Get Videos Error:', error);
    res.status(500).json({ error: 'Failed to get videos' });
  }
});

// GET /api/videos/latest
router.get('/latest', async (req, res) => {
  try {
    const { limit = 12 } = req.query;
    const videos = await Video.find({ status: 'public' })
      .populate('category', 'name slug')
      .sort({ uploadDate: -1 })
      .limit(parseInt(limit));
    res.json({ success: true, videos });
  } catch (error) {
    console.error('Get Latest Error:', error);
    res.status(500).json({ error: 'Failed to get latest videos' });
  }
});

// GET /api/videos/trending
router.get('/trending', async (req, res) => {
  try {
    const { limit = 12 } = req.query;
    const videos = await Video.find({ status: 'public' })
      .populate('category', 'name slug')
      .sort({ views: -1, uploadDate: -1 })
      .limit(parseInt(limit));
    res.json({ success: true, videos });
  } catch (error) {
    console.error('Get Trending Error:', error);
    res.status(500).json({ error: 'Failed to get trending videos' });
  }
});

// GET /api/videos/featured
router.get('/featured', async (req, res) => {
  try {
    const { limit = 6 } = req.query;
    const videos = await Video.find({ status: 'public', featured: true })
      .populate('category', 'name slug')
      .sort({ uploadDate: -1 })
      .limit(parseInt(limit));
    res.json({ success: true, videos });
  } catch (error) {
    console.error('Get Featured Error:', error);
    res.status(500).json({ error: 'Failed to get featured videos' });
  }
});

// GET /api/videos/:id
router.get('/:id', async (req, res) => {
  try {
    const video = await Video.findOne({
      _id: req.params.id,
      status: { $in: ['public', 'unlisted'] }
    }).populate('category', 'name slug');

    if (!video) return res.status(404).json({ error: 'Video not found' });
    res.json({ success: true, video });
  } catch (error) {
    console.error('Get Video Error:', error);
    if (error.kind === 'ObjectId') return res.status(404).json({ error: 'Video not found' });
    res.status(500).json({ error: 'Failed to get video' });
  }
});

// GET /api/videos/:id/related
router.get('/:id/related', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    let relatedVideos = await Video.find({
      _id: { $ne: video._id },
      status: 'public'
    }).populate('category', 'name slug').sort({ views: -1 }).limit(parseInt(limit));

    res.json({ success: true, videos: relatedVideos });
  } catch (error) {
    console.error('Get Related Error:', error);
    res.status(500).json({ error: 'Failed to get related videos' });
  }
});

// POST /api/videos/:id/view
router.post('/:id/view', async (req, res) => {
  try {
    const videoId = req.params.id;
    const ip = req.ip || req.connection.remoteAddress;

    const recentView = await ViewLog.findOne({ videoId, ip });
    if (recentView) {
      return res.json({ success: true, counted: false, message: 'View already counted' });
    }

    await ViewLog.create({ videoId, ip, userAgent: req.headers['user-agent'] || '' });
    await Video.findByIdAndUpdate(videoId, { $inc: { views: 1 } });

    res.json({ success: true, counted: true, message: 'View counted' });
  } catch (error) {
    console.error('View Count Error:', error);
    res.status(500).json({ error: 'Failed to count view' });
  }
});

// POST /api/videos/:id/like
router.post('/:id/like', async (req, res) => {
  try {
    const video = await Video.findByIdAndUpdate(req.params.id, { $inc: { likes: 1 } }, { new: true });
    if (!video) return res.status(404).json({ error: 'Video not found' });
    res.json({ success: true, likes: video.likes });
  } catch (error) {
    console.error('Like Error:', error);
    res.status(500).json({ error: 'Failed to like video' });
  }
});

// POST /api/videos/:id/dislike
router.post('/:id/dislike', async (req, res) => {
  try {
    const video = await Video.findByIdAndUpdate(req.params.id, { $inc: { dislikes: 1 } }, { new: true });
    if (!video) return res.status(404).json({ error: 'Video not found' });
    res.json({ success: true, dislikes: video.dislikes });
  } catch (error) {
    console.error('Dislike Error:', error);
    res.status(500).json({ error: 'Failed to dislike video' });
  }
});

// POST /api/videos/:id/report
router.post('/:id/report', async (req, res) => {
  try {
    const { reason, description, email } = req.body;
    if (!reason) return res.status(400).json({ error: 'Reason is required' });

    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    await Report.create({
      videoId: req.params.id,
      reason,
      description: description || '',
      email: email || '',
      ip: req.ip || ''
    });

    res.json({ success: true, message: 'Report submitted successfully' });
  } catch (error) {
    console.error('Report Error:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

module.exports = router;