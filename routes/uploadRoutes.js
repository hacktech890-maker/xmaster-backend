const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const axios = require('axios');
const Video = require('../models/Video');
const Category = require('../models/Category');

// Admin Auth Middleware
const simpleAdminAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.isAdmin) return res.status(401).json({ error: 'Invalid token' });
    req.admin = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// Helper: Get embed and thumbnail URLs
const getAbyssUrls = (fileCode) => ({
  embedUrl: `https://abyss.to/e/${fileCode}`,
  thumbnailUrl: `https://abyss.to/thumb/${fileCode}.jpg`
});

// POST /api/upload/file-code
router.post('/file-code', simpleAdminAuth, async (req, res) => {
  try {
    const { file_code, title, description, category, tags, status, featured } = req.body;

    if (!file_code) {
      return res.status(400).json({ error: 'File code is required' });
    }

    const existing = await Video.findOne({ file_code });
    if (existing) {
      return res.status(400).json({ error: 'Video with this file code already exists' });
    }

    const { embedUrl, thumbnailUrl } = getAbyssUrls(file_code);

    const video = new Video({
      file_code,
      embed_code: embedUrl,
      title: title || file_code,
      description: description || '',
      thumbnail: thumbnailUrl,
      category: category || null,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
      status: status || 'public',
      featured: featured === 'true' || featured === true
    });

    await video.save();

    if (category) {
      await Category.findByIdAndUpdate(category, { $inc: { videoCount: 1 } });
    }

    res.json({ success: true, video, message: 'Video added successfully' });
  } catch (error) {
    console.error('Add File Code Error:', error);
    res.status(500).json({ error: 'Failed to add video', details: error.message });
  }
});

// POST /api/upload/bulk-file-codes
router.post('/bulk-file-codes', simpleAdminAuth, async (req, res) => {
  try {
    const { videos } = req.body;

    if (!videos || !Array.isArray(videos) || videos.length === 0) {
      return res.status(400).json({ error: 'No videos provided' });
    }

    const results = { success: [], failed: [] };

    for (const videoData of videos) {
      try {
        const { file_code, title, category, tags } = videoData;

        if (!file_code) {
          results.failed.push({ file_code: 'unknown', error: 'File code is required' });
          continue;
        }

        const existing = await Video.findOne({ file_code });
        if (existing) {
          results.failed.push({ file_code, error: 'Already exists' });
          continue;
        }

        const { embedUrl, thumbnailUrl } = getAbyssUrls(file_code);

        const video = new Video({
          file_code,
          embed_code: embedUrl,
          title: title || file_code,
          thumbnail: thumbnailUrl,
          category: category || null,
          tags: tags || [],
          status: 'public'
        });

        await video.save();
        results.success.push({ file_code, id: video._id });
      } catch (err) {
        results.failed.push({ file_code: videoData.file_code || 'unknown', error: err.message });
      }
    }

    res.json({
      success: true,
      results,
      message: `Added ${results.success.length} videos, ${results.failed.length} failed`
    });
  } catch (error) {
    console.error('Bulk Add Error:', error);
    res.status(500).json({ error: 'Bulk add failed' });
  }
});

// GET /api/upload/abyss-files
router.get('/abyss-files', simpleAdminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const response = await axios.get(`${process.env.ABYSS_API_BASE_URL}/v1/resources`, {
      params: {
        key: process.env.ABYSS_API_KEY,
        maxResults: parseInt(limit),
        orderBy: 'createdAt:desc'
      }
    });

    if (!response.data || !response.data.items) {
      return res.json({ success: true, files: [], pagination: { page: 1, total: 0 } });
    }

    const files = response.data.items.filter(item => !item.isDir).map(file => ({
      file_code: file.id,
      name: file.name,
      title: file.name.replace(/\.[^/.]+$/, ''),
      size: file.size,
      status: file.status,
      createdAt: file.createdAt
    }));

    const fileCodes = files.map(f => f.file_code);
    const existingVideos = await Video.find({ file_code: { $in: fileCodes } }).select('file_code');
    const existingCodes = new Set(existingVideos.map(v => v.file_code));

    const filesWithStatus = files.map(file => ({
      ...file,
      alreadyAdded: existingCodes.has(file.file_code)
    }));

    res.json({
      success: true,
      files: filesWithStatus,
      pagination: { page: parseInt(page), limit: parseInt(limit), total: files.length }
    });
  } catch (error) {
    console.error('List Abyss Files Error:', error);
    res.status(500).json({ error: 'Failed to list files', details: error.message });
  }
});

// GET /api/upload/account-info
router.get('/account-info', simpleAdminAuth, async (req, res) => {
  try {
    const response = await axios.get(`${process.env.ABYSS_API_BASE_URL}/v1/about`, {
      params: { key: process.env.ABYSS_API_KEY }
    });

    res.json({ success: true, account: response.data });
  } catch (error) {
    console.error('Account Info Error:', error);
    res.status(500).json({ error: 'Failed to get account info' });
  }
});

module.exports = router;