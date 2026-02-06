const express = require('express');
const router = express.Router();
const Video = require('../models/Video');
const Ad = require('../models/Ad');
const Report = require('../models/Report');
const Category = require('../models/Category');
const { simpleAdminAuth } = require('../middleware/adminAuth');

// GET /api/analytics/dashboard - Dashboard Stats (Admin)
router.get('/dashboard', simpleAdminAuth, async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const [
      totalVideos,
      publicVideos,
      privateVideos,
      totalViewsResult,
      totalCategories,
      activeAds,
      pendingReports,
      todayUploads,
      weekUploads,
      monthUploads
    ] = await Promise.all([
      Video.countDocuments(),
      Video.countDocuments({ status: 'public' }),
      Video.countDocuments({ status: 'private' }),
      Video.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }]),
      Category.countDocuments({ isActive: true }),
      Ad.countDocuments({ enabled: true }),
      Report.countDocuments({ status: 'pending' }),
      Video.countDocuments({ uploadDate: { $gte: today } }),
      Video.countDocuments({ uploadDate: { $gte: weekAgo } }),
      Video.countDocuments({ uploadDate: { $gte: monthAgo } })
    ]);
    
    res.json({
      success: true,
      stats: {
        totalVideos,
        publicVideos,
        privateVideos,
        totalViews: totalViewsResult[0]?.total || 0,
        totalCategories,
        activeAds,
        pendingReports,
        todayUploads,
        weekUploads,
        monthUploads
      }
    });
  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    res.status(500).json({ error: 'Failed to get dashboard stats' });
  }
});

// GET /api/analytics/views - View Analytics (Admin)
router.get('/views', simpleAdminAuth, async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    let days = 7;
    switch (period) {
      case '24h': days = 1; break;
      case '7d': days = 7; break;
      case '30d': days = 30; break;
      case '90d': days = 90; break;
      case '1y': days = 365; break;
    }
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const viewsByDay = await Video.aggregate([
      {
        $match: {
          uploadDate: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$uploadDate' } },
          totalViews: { $sum: '$views' },
          videoCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    res.json({
      success: true,
      period,
      data: viewsByDay
    });
  } catch (error) {
    console.error('View Analytics Error:', error);
    res.status(500).json({ error: 'Failed to get view analytics' });
  }
});

// GET /api/analytics/top-videos - Top Videos (Admin)
router.get('/top-videos', simpleAdminAuth, async (req, res) => {
  try {
    const { limit = 10, period = '7d' } = req.query;
    
    let dateFilter = {};
    if (period !== 'all') {
      const days = period === '24h' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 365;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      dateFilter = { uploadDate: { $gte: startDate } };
    }
    
    const videos = await Video.find({ status: 'public', ...dateFilter })
      .sort({ views: -1 })
      .limit(parseInt(limit))
      .populate('category', 'name')
      .select('title thumbnail views likes uploadDate category');
    
    res.json({ success: true, videos });
  } catch (error) {
    console.error('Top Videos Error:', error);
    res.status(500).json({ error: 'Failed to get top videos' });
  }
});

// GET /api/analytics/categories - Category Analytics (Admin)
router.get('/categories', simpleAdminAuth, async (req, res) => {
  try {
    const categoryStats = await Video.aggregate([
      { $match: { status: 'public', category: { $ne: null } } },
      {
        $group: {
          _id: '$category',
          videoCount: { $sum: 1 },
          totalViews: { $sum: '$views' },
          totalLikes: { $sum: '$likes' }
        }
      },
      { $sort: { totalViews: -1 } }
    ]);
    
    // Populate category names
    await Category.populate(categoryStats, { path: '_id', select: 'name slug' });
    
    const stats = categoryStats.map(stat => ({
      category: stat._id,
      videoCount: stat.videoCount,
      totalViews: stat.totalViews,
      totalLikes: stat.totalLikes
    }));
    
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Category Analytics Error:', error);
    res.status(500).json({ error: 'Failed to get category analytics' });
  }
});

// GET /api/analytics/ads - Ad Analytics (Admin)
router.get('/ads', simpleAdminAuth, async (req, res) => {
  try {
    const ads = await Ad.find()
      .select('name placement impressions clicks enabled')
      .sort({ impressions: -1 });
    
    const totalImpressions = ads.reduce((sum, ad) => sum + ad.impressions, 0);
    const totalClicks = ads.reduce((sum, ad) => sum + ad.clicks, 0);
    const overallCTR = totalImpressions > 0 
      ? ((totalClicks / totalImpressions) * 100).toFixed(2) 
      : 0;
    
    res.json({
      success: true,
      summary: {
        totalImpressions,
        totalClicks,
        overallCTR
      },
      ads
    });
  } catch (error) {
    console.error('Ad Analytics Error:', error);
    res.status(500).json({ error: 'Failed to get ad analytics' });
  }
});

// GET /api/analytics/reports - Report Analytics (Admin)
router.get('/reports', simpleAdminAuth, async (req, res) => {
  try {
    const { status = '', page = 1, limit = 20 } = req.query;
    
    const query = status ? { status } : {};
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [reports, total] = await Promise.all([
      Report.find(query)
        .populate('videoId', 'title thumbnail')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Report.countDocuments(query)
    ]);
    
    // Get status counts
    const statusCounts = await Report.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    res.json({
      success: true,
      reports,
      statusCounts: statusCounts.reduce((acc, s) => {
        acc[s._id] = s.count;
        return acc;
      }, {}),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Report Analytics Error:', error);
    res.status(500).json({ error: 'Failed to get report analytics' });
  }
});

// PUT /api/analytics/reports/:id - Update Report Status (Admin)
router.put('/reports/:id', simpleAdminAuth, async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    
    const report = await Report.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    if (status) report.status = status;
    if (adminNotes !== undefined) report.adminNotes = adminNotes;
    
    if (status === 'resolved' || status === 'dismissed') {
      report.resolvedAt = new Date();
    }
    
    await report.save();
    
    res.json({
      success: true,
      report,
      message: 'Report updated successfully'
    });
  } catch (error) {
    console.error('Update Report Error:', error);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

module.exports = router;