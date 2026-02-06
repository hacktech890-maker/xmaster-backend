const express = require('express');
const router = express.Router();
const Video = require('../models/Video');
const Category = require('../models/Category');

// GET /api/public/home
router.get('/home', async (req, res) => {
  try {
    const [featuredVideos, latestVideos, trendingVideos, categories] = await Promise.all([
      Video.find({ status: 'public', featured: true })
        .sort({ uploadDate: -1 })
        .limit(6)
        .populate('category', 'name slug'),
      Video.find({ status: 'public' })
        .sort({ uploadDate: -1 })
        .limit(12)
        .populate('category', 'name slug'),
      Video.find({ status: 'public' })
        .sort({ views: -1 })
        .limit(12)
        .populate('category', 'name slug'),
      Category.find({ isActive: true })
        .sort({ order: 1 })
        .limit(10)
    ]);

    res.json({
      success: true,
      data: { featuredVideos, latestVideos, trendingVideos, categories }
    });
  } catch (error) {
    console.error('Home Data Error:', error);
    res.status(500).json({ error: 'Failed to get home data' });
  }
});

// GET /api/public/stats
router.get('/stats', async (req, res) => {
  try {
    const [videoCount, totalViews, categoryCount] = await Promise.all([
      Video.countDocuments({ status: 'public' }),
      Video.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }]),
      Category.countDocuments({ isActive: true })
    ]);

    res.json({
      success: true,
      stats: {
        videos: videoCount,
        views: totalViews[0]?.total || 0,
        categories: categoryCount
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = router;