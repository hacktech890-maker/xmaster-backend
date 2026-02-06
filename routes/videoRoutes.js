const express = require('express');
const router = express.Router();
const Video = require('../models/Video');
const ViewLog = require('../models/ViewLog');
const Report = require('../models/Report');

// GET /api/videos - Get All Public Videos
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = 'newest',
      category = '',
      tag = ''
    } = req.query;
    
    const query = { status: 'public' };
    
    if (category) {
      query.category = category;
    }
    
    if (tag) {
      query.tags = { $in: [tag.toLowerCase()] };
    }
    
    let sortOption = {};
    switch (sort) {
      case 'oldest':
        sortOption = { uploadDate: 1 };
        break;
      case 'views':
        sortOption = { views: -1 };
        break;
      case 'likes':
        sortOption = { likes: -1 };
        break;
      default:
        sortOption = { uploadDate: -1 };
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [videos, total] = await Promise.all([
      Video.find(query)
        .populate('category', 'name slug')
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-file_code -thumbnailPublicId'),
      Video.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      videos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get Videos Error:', error);
    res.status(500).json({ error: 'Failed to get videos' });
  }
});

// GET /api/videos/latest - Get Latest Videos
router.get('/latest', async (req, res) => {
  try {
    const { limit = 12 } = req.query;
    
    const videos = await Video.find({ status: 'public' })
      .populate('category', 'name slug')
      .sort({ uploadDate: -1 })
      .limit(parseInt(limit))
      .select('-file_code -thumbnailPublicId');
    
    res.json({ success: true, videos });
  } catch (error) {
    console.error('Get Latest Error:', error);
    res.status(500).json({ error: 'Failed to get latest videos' });
  }
});

// GET /api/videos/trending - Get Trending Videos
router.get('/trending', async (req, res) => {
  try {
    const { limit = 12, period = '7d' } = req.query;
    
    // Calculate date range
    let dateRange = new Date();
    switch (period) {
      case '24h':
        dateRange.setHours(dateRange.getHours() - 24);
        break;
      case '7d':
        dateRange.setDate(dateRange.getDate() - 7);
        break;
      case '30d':
        dateRange.setDate(dateRange.getDate() - 30);
        break;
      default:
        dateRange.setDate(dateRange.getDate() - 7);
    }
    
    // Get videos with most views in the period
    // For now, just sort by views (can be enhanced with analytics)
    const videos = await Video.find({ 
      status: 'public',
      uploadDate: { $gte: dateRange }
    })
      .populate('category', 'name slug')
      .sort({ views: -1, uploadDate: -1 })
      .limit(parseInt(limit))
      .select('-file_code -thumbnailPublicId');
    
    // If not enough videos from the period, add more
    if (videos.length < parseInt(limit)) {
      const moreVideos = await Video.find({ 
        status: 'public',
        _id: { $nin: videos.map(v => v._id) }
      })
        .populate('category', 'name slug')
        .sort({ views: -1 })
        .limit(parseInt(limit) - videos.length)
        .select('-file_code -thumbnailPublicId');
      
      videos.push(...moreVideos);
    }
    
    res.json({ success: true, videos });
  } catch (error) {
    console.error('Get Trending Error:', error);
    res.status(500).json({ error: 'Failed to get trending videos' });
  }
});

// GET /api/videos/featured - Get Featured Videos
router.get('/featured', async (req, res) => {
  try {
    const { limit = 6 } = req.query;
    
    const videos = await Video.find({ 
      status: 'public',
      featured: true
    })
      .populate('category', 'name slug')
      .sort({ uploadDate: -1 })
      .limit(parseInt(limit))
      .select('-file_code -thumbnailPublicId');
    
    res.json({ success: true, videos });
  } catch (error) {
    console.error('Get Featured Error:', error);
    res.status(500).json({ error: 'Failed to get featured videos' });
  }
});

// GET /api/videos/random - Get Random Videos
router.get('/random', async (req, res) => {
  try {
    const { limit = 10, exclude = '' } = req.query;
    
    const excludeIds = exclude ? exclude.split(',') : [];
    
    const videos = await Video.aggregate([
      { 
        $match: { 
          status: 'public',
          _id: { $nin: excludeIds.map(id => require('mongoose').Types.ObjectId(id)) }
        } 
      },
      { $sample: { size: parseInt(limit) } }
    ]);
    
    // Populate category
    await Video.populate(videos, { path: 'category', select: 'name slug' });
    
    res.json({ success: true, videos });
  } catch (error) {
    console.error('Get Random Error:', error);
    res.status(500).json({ error: 'Failed to get random videos' });
  }
});

// GET /api/videos/:id - Get Single Video
router.get('/:id', async (req, res) => {
  try {
    const video = await Video.findOne({
      _id: req.params.id,
      status: { $in: ['public', 'unlisted'] }
    }).populate('category', 'name slug');
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    res.json({ success: true, video });
  } catch (error) {
    console.error('Get Video Error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    res.status(500).json({ error: 'Failed to get video' });
  }
});

// GET /api/videos/:id/related - Get Related Videos
router.get('/:id/related', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    let relatedVideos = [];
    
    // First, try to find videos with same tags
    if (video.tags && video.tags.length > 0) {
      relatedVideos = await Video.find({
        _id: { $ne: video._id },
        status: 'public',
        tags: { $in: video.tags }
      })
        .populate('category', 'name slug')
        .sort({ views: -1 })
        .limit(parseInt(limit))
        .select('-file_code -thumbnailPublicId');
    }
    
    // If not enough, try same category
    if (relatedVideos.length < parseInt(limit) && video.category) {
      const categoryVideos = await Video.find({
        _id: { $ne: video._id, $nin: relatedVideos.map(v => v._id) },
        status: 'public',
        category: video.category
      })
        .populate('category', 'name slug')
        .sort({ views: -1 })
        .limit(parseInt(limit) - relatedVideos.length)
        .select('-file_code -thumbnailPublicId');
      
      relatedVideos.push(...categoryVideos);
    }
    
    // If still not enough, add random videos
    if (relatedVideos.length < parseInt(limit)) {
      const randomVideos = await Video.aggregate([
        { 
          $match: { 
            _id: { $ne: video._id, $nin: relatedVideos.map(v => v._id) },
            status: 'public'
          } 
        },
        { $sample: { size: parseInt(limit) - relatedVideos.length } }
      ]);
      
      await Video.populate(randomVideos, { path: 'category', select: 'name slug' });
      relatedVideos.push(...randomVideos);
    }
    
    res.json({ success: true, videos: relatedVideos });
  } catch (error) {
    console.error('Get Related Error:', error);
    res.status(500).json({ error: 'Failed to get related videos' });
  }
});

// POST /api/videos/:id/view - Increment View Count
router.post('/:id/view', async (req, res) => {
  try {
    const videoId = req.params.id;
    const ip = req.ip || req.connection.remoteAddress;
    const { sessionId } = req.body;
    
    // Check for recent view from this IP
    const recentView = await ViewLog.findOne({
      videoId,
      ip
    });
    
    if (recentView) {
      return res.json({ 
        success: true, 
        counted: false,
        message: 'View already counted recently'
      });
    }
    
    // Log this view
    await ViewLog.create({
      videoId,
      ip,
      sessionId: sessionId || '',
      userAgent: req.headers['user-agent'] || '',
      referer: req.headers.referer || ''
    });
    
    // Increment view count
    await Video.findByIdAndUpdate(videoId, { $inc: { views: 1 } });
    
    res.json({ 
      success: true, 
      counted: true,
      message: 'View counted'
    });
  } catch (error) {
    console.error('View Count Error:', error);
    res.status(500).json({ error: 'Failed to count view' });
  }
});

// POST /api/videos/:id/like - Like Video
router.post('/:id/like', async (req, res) => {
  try {
    const video = await Video.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: 1 } },
      { new: true }
    );
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    res.json({ 
      success: true, 
      likes: video.likes 
    });
  } catch (error) {
    console.error('Like Error:', error);
    res.status(500).json({ error: 'Failed to like video' });
  }
});

// POST /api/videos/:id/dislike - Dislike Video
router.post('/:id/dislike', async (req, res) => {
  try {
    const video = await Video.findByIdAndUpdate(
      req.params.id,
      { $inc: { dislikes: 1 } },
      { new: true }
    );
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    res.json({ 
      success: true, 
      dislikes: video.dislikes 
    });
  } catch (error) {
    console.error('Dislike Error:', error);
    res.status(500).json({ error: 'Failed to dislike video' });
  }
});

// POST /api/videos/:id/report - Report Video
router.post('/:id/report', async (req, res) => {
  try {
    const { reason, description, email } = req.body;
    
    if (!reason) {
      return res.status(400).json({ error: 'Reason is required' });
    }
    
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    const report = await Report.create({
      videoId: req.params.id,
      reason,
      description: description || '',
      email: email || '',
      ip: req.ip || ''
    });
    
    res.json({ 
      success: true, 
      message: 'Report submitted successfully' 
    });
  } catch (error) {
    console.error('Report Error:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

module.exports = router;