const express = require('express');
const router = express.Router();
const Video = require('../models/Video');
const { searchLimiter } = require('../middleware/rateLimiter');

// GET /api/search - Search Videos
router.get('/', searchLimiter, async (req, res) => {
  try {
    const {
      q = '',
      page = 1,
      limit = 20,
      sort = 'relevance',
      category = '',
      duration = '',
      date = ''
    } = req.query;
    
    if (!q.trim()) {
      return res.json({
        success: true,
        videos: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0 }
      });
    }
    
    const query = {
      status: 'public',
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } }
      ]
    };
    
    // Category filter
    if (category) {
      query.category = category;
    }
    
    // Date filter
    if (date) {
      const now = new Date();
      let dateLimit;
      switch (date) {
        case 'today':
          dateLimit = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          dateLimit = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          dateLimit = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case 'year':
          dateLimit = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
      }
      if (dateLimit) {
        query.uploadDate = { $gte: dateLimit };
      }
    }
    
    // Sort options
    let sortOption = {};
    switch (sort) {
      case 'newest':
        sortOption = { uploadDate: -1 };
        break;
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
        // Relevance - use text score if available
        sortOption = { views: -1, uploadDate: -1 };
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
      query: q,
      videos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Search Error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /api/search/suggestions - Get Search Suggestions
router.get('/suggestions', searchLimiter, async (req, res) => {
  try {
    const { q = '', limit = 5 } = req.query;
    
    if (!q.trim() || q.length < 2) {
      return res.json({ success: true, suggestions: [] });
    }
    
    const videos = await Video.find({
      status: 'public',
      title: { $regex: q, $options: 'i' }
    })
      .select('title')
      .limit(parseInt(limit));
    
    const suggestions = videos.map(v => v.title);
    
    res.json({ success: true, suggestions });
  } catch (error) {
    console.error('Suggestions Error:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

// GET /api/search/tags/:tag - Search by Tag
router.get('/tags/:tag', async (req, res) => {
  try {
    const { page = 1, limit = 20, sort = 'newest' } = req.query;
    const tag = req.params.tag.toLowerCase();
    
    let sortOption = {};
    switch (sort) {
      case 'oldest':
        sortOption = { uploadDate: 1 };
        break;
      case 'views':
        sortOption = { views: -1 };
        break;
      default:
        sortOption = { uploadDate: -1 };
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [videos, total] = await Promise.all([
      Video.find({
        status: 'public',
        tags: tag
      })
        .populate('category', 'name slug')
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-file_code -thumbnailPublicId'),
      Video.countDocuments({
        status: 'public',
        tags: tag
      })
    ]);
    
    res.json({
      success: true,
      tag,
      videos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Tag Search Error:', error);
    res.status(500).json({ error: 'Tag search failed' });
  }
});

// GET /api/search/popular-tags - Get Popular Tags
router.get('/popular-tags', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    const tags = await Video.aggregate([
      { $match: { status: 'public' } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: parseInt(limit) }
    ]);
    
    res.json({
      success: true,
      tags: tags.map(t => ({ tag: t._id, count: t.count }))
    });
  } catch (error) {
    console.error('Popular Tags Error:', error);
    res.status(500).json({ error: 'Failed to get popular tags' });
  }
});

module.exports = router;