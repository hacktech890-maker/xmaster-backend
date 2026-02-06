const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const Video = require('../models/Video');
const Category = require('../models/Category');
const Ad = require('../models/Ad');
const Report = require('../models/Report');
const Settings = require('../models/Settings');
const { simpleAdminAuth } = require('../middleware/adminAuth');
const { loginLimiter } = require('../middleware/rateLimiter');

// ==================== AUTH ROUTES ====================

// POST /api/admin/login - Admin Login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { password, username } = req.body;
    
    // Check against environment password (simple auth)
    if (password === process.env.ADMIN_PASSWORD) {
      // Generate JWT
      const token = jwt.sign(
        { 
          isAdmin: true, 
          username: username || 'admin',
          loginTime: Date.now()
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      return res.json({
        success: true,
        token,
        admin: {
          username: username || 'admin',
          role: 'admin'
        },
        message: 'Login successful'
      });
    }
    
    // Check in database for admin users
    const admin = await Admin.findOne({ username: username?.toLowerCase() });
    
    if (admin && await admin.comparePassword(password)) {
      // Update last login
      admin.lastLogin = Date.now();
      admin.loginAttempts = 0;
      await admin.save();
      
      const token = jwt.sign(
        { 
          id: admin._id,
          isAdmin: true,
          username: admin.username,
          role: admin.role
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      return res.json({
        success: true,
        token,
        admin: {
          id: admin._id,
          username: admin.username,
          role: admin.role
        },
        message: 'Login successful'
      });
    }
    
    res.status(401).json({ error: 'Invalid credentials' });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/admin/verify - Verify Token
router.post('/verify', simpleAdminAuth, (req, res) => {
  res.json({
    success: true,
    admin: req.admin,
    message: 'Token is valid'
  });
});

// POST /api/admin/change-password
router.post('/change-password', simpleAdminAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // For simple auth, can't change env password
    if (currentPassword === process.env.ADMIN_PASSWORD) {
      return res.status(400).json({ 
        error: 'Cannot change environment password through API' 
      });
    }
    
    // For DB admins
    if (req.admin.id) {
      const admin = await Admin.findById(req.admin.id);
      if (!admin || !await admin.comparePassword(currentPassword)) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
      
      admin.password = newPassword;
      await admin.save();
      
      return res.json({ success: true, message: 'Password changed successfully' });
    }
    
    res.status(400).json({ error: 'Password change not available' });
  } catch (error) {
    console.error('Change Password Error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ==================== DASHBOARD ROUTES ====================

// GET /api/admin/dashboard - Get Dashboard Stats
router.get('/dashboard', simpleAdminAuth, async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Get counts
    const [
      totalVideos,
      publicVideos,
      totalViews,
      totalCategories,
      totalAds,
      pendingReports,
      todayVideos,
      weekVideos
    ] = await Promise.all([
      Video.countDocuments(),
      Video.countDocuments({ status: 'public' }),
      Video.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }]),
      Category.countDocuments({ isActive: true }),
      Ad.countDocuments({ enabled: true }),
      Report.countDocuments({ status: 'pending' }),
      Video.countDocuments({ uploadDate: { $gte: today } }),
      Video.countDocuments({ uploadDate: { $gte: weekAgo } })
    ]);
    
    // Get top videos
    const topVideos = await Video.find({ status: 'public' })
      .sort({ views: -1 })
      .limit(5)
      .select('title thumbnail views uploadDate');
    
    // Get recent uploads
    const recentUploads = await Video.find()
      .sort({ uploadDate: -1 })
      .limit(5)
      .select('title thumbnail views status uploadDate');
    
    // Get views by day (last 7 days)
    const viewsByDay = await Video.aggregate([
      {
        $match: { uploadDate: { $gte: weekAgo } }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$uploadDate' } },
          views: { $sum: '$views' },
          uploads: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    res.json({
      success: true,
      stats: {
        totalVideos,
        publicVideos,
        totalViews: totalViews[0]?.total || 0,
        totalCategories,
        totalAds,
        pendingReports,
        todayVideos,
        weekVideos
      },
      topVideos,
      recentUploads,
      viewsByDay
    });
  } catch (error) {
    console.error('Dashboard Error:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

// ==================== VIDEO MANAGEMENT ROUTES ====================

// GET /api/admin/videos - Get All Videos (Admin)
router.get('/videos', simpleAdminAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      category = '',
      featured = '',
      sort = 'newest'
    } = req.query;
    
    const query = {};
    
    // Search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { file_code: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    // Status filter
    if (status) {
      query.status = status;
    }
    
    // Category filter
    if (category) {
      query.category = category;
    }
    
    // Featured filter
    if (featured === 'true') {
      query.featured = true;
    } else if (featured === 'false') {
      query.featured = false;
    }
    
    // Sort options
    let sortOption = {};
    switch (sort) {
      case 'oldest':
        sortOption = { uploadDate: 1 };
        break;
      case 'views':
        sortOption = { views: -1 };
        break;
      case 'title':
        sortOption = { title: 1 };
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
        .limit(parseInt(limit)),
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

// GET /api/admin/videos/:id - Get Single Video
router.get('/videos/:id', simpleAdminAuth, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id)
      .populate('category', 'name slug');
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    res.json({ success: true, video });
  } catch (error) {
    console.error('Get Video Error:', error);
    res.status(500).json({ error: 'Failed to get video' });
  }
});

// PUT /api/admin/videos/:id - Update Video
router.put('/videos/:id', simpleAdminAuth, async (req, res) => {
  try {
    const {
      title,
      description,
      thumbnail,
      category,
      tags,
      status,
      featured,
      duration
    } = req.body;
    
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    // Update fields
    if (title) video.title = title;
    if (description !== undefined) video.description = description;
    if (thumbnail) video.thumbnail = thumbnail;
    if (category !== undefined) video.category = category || null;
    if (tags) video.tags = tags;
    if (status) video.status = status;
    if (featured !== undefined) video.featured = featured;
    if (duration) video.duration = duration;
    
    await video.save();
    
    // Update category video count if category changed
    if (category !== undefined) {
      await updateCategoryCounts();
    }
    
    res.json({ 
      success: true, 
      video,
      message: 'Video updated successfully' 
    });
  } catch (error) {
    console.error('Update Video Error:', error);
    res.status(500).json({ error: 'Failed to update video' });
  }
});

// DELETE /api/admin/videos/:id - Delete Video
router.delete('/videos/:id', simpleAdminAuth, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    // Optionally delete from Abyss.to
    // await abyssService.deleteVideo(video.file_code);
    
    await Video.findByIdAndDelete(req.params.id);
    
    // Update category counts
    await updateCategoryCounts();
    
    res.json({ 
      success: true, 
      message: 'Video deleted successfully' 
    });
  } catch (error) {
    console.error('Delete Video Error:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

// DELETE /api/admin/videos/bulk - Bulk Delete Videos
router.post('/videos/bulk-delete', simpleAdminAuth, async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No video IDs provided' });
    }
    
    const result = await Video.deleteMany({ _id: { $in: ids } });
    
    // Update category counts
    await updateCategoryCounts();
    
    res.json({ 
      success: true, 
      deletedCount: result.deletedCount,
      message: `${result.deletedCount} videos deleted successfully` 
    });
  } catch (error) {
    console.error('Bulk Delete Error:', error);
    res.status(500).json({ error: 'Failed to delete videos' });
  }
});

// PUT /api/admin/videos/:id/feature - Toggle Featured Status
router.put('/videos/:id/feature', simpleAdminAuth, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    video.featured = !video.featured;
    await video.save();
    
    res.json({ 
      success: true, 
      featured: video.featured,
      message: video.featured ? 'Video featured' : 'Video unfeatured'
    });
  } catch (error) {
    console.error('Toggle Feature Error:', error);
    res.status(500).json({ error: 'Failed to toggle featured status' });
  }
});

// PUT /api/admin/videos/:id/status - Change Video Status
router.put('/videos/:id/status', simpleAdminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['public', 'private', 'unlisted'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const video = await Video.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    res.json({ 
      success: true, 
      status: video.status,
      message: 'Video status updated'
    });
  } catch (error) {
    console.error('Update Status Error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// ==================== HELPER FUNCTIONS ====================

async function updateCategoryCounts() {
  try {
    const categories = await Category.find();
    
    for (const category of categories) {
      const count = await Video.countDocuments({ 
        category: category._id,
        status: 'public'
      });
      category.videoCount = count;
      await category.save();
    }
  } catch (error) {
    console.error('Update Category Counts Error:', error);
  }
}

module.exports = router;