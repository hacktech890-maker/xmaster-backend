const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const Video = require('../models/Video');
const Category = require('../models/Category');
const { simpleAdminAuth } = require('../middleware/adminAuth');
const { videoUpload, imageUpload, cleanupFile } = require('../middleware/upload');
const abyssService = require('../config/abyss');
const { uploadFromUrl } = require('../config/cloudinary');
const { uploadLimiter } = require('../middleware/rateLimiter');

// POST /api/upload/single - Upload Single Video
router.post('/single', simpleAdminAuth, uploadLimiter, videoUpload.single('video'), async (req, res) => {
  let uploadedFilePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }
    
    uploadedFilePath = req.file.path;
    
    const { title, description, category, tags, status, featured } = req.body;
    
    // Upload to Abyss.to
    console.log('Uploading to Abyss.to:', req.file.originalname);
    const abyssResult = await abyssService.uploadVideo(
      uploadedFilePath,
      req.file.originalname
    );
    
    if (!abyssResult || abyssResult.status !== 200) {
      throw new Error('Abyss.to upload failed');
    }
    
    const fileCode = abyssResult.result.filecode;
    const embedUrl = abyssService.getEmbedUrl(fileCode);
    let thumbnailUrl = abyssService.getThumbnailUrl(fileCode);
    
    // Optionally upload thumbnail to Cloudinary for reliability
    try {
      const cloudinaryResult = await uploadFromUrl(thumbnailUrl);
      thumbnailUrl = cloudinaryResult.secure_url;
    } catch (cloudErr) {
      console.log('Using Abyss thumbnail, Cloudinary upload failed:', cloudErr.message);
    }
    
    // Create video in database
    const video = new Video({
      file_code: fileCode,
      embed_code: embedUrl,
      title: title || req.file.originalname.replace(/\.[^/.]+$/, ''),
      description: description || '',
      thumbnail: thumbnailUrl,
      category: category || null,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
      status: status || 'public',
      featured: featured === 'true' || featured === true,
      duration: '00:00' // Will be updated when video info is fetched
    });
    
    await video.save();
    
    // Update category count
    if (category) {
      await Category.findByIdAndUpdate(category, { $inc: { videoCount: 1 } });
    }
    
    // Clean up uploaded file
    cleanupFile(uploadedFilePath);
    
    res.json({
      success: true,
      video,
      message: 'Video uploaded successfully'
    });
  } catch (error) {
    console.error('Upload Error:', error);
    
    // Clean up on error
    if (uploadedFilePath) {
      cleanupFile(uploadedFilePath);
    }
    
    res.status(500).json({ 
      error: 'Upload failed',
      details: error.message 
    });
  }
});

// POST /api/upload/file-code - Add Video by File Code
router.post('/file-code', simpleAdminAuth, async (req, res) => {
  try {
    const { file_code, title, description, category, tags, status, featured } = req.body;
    
    if (!file_code) {
      return res.status(400).json({ error: 'File code is required' });
    }
    
    // Check if already exists
    const existing = await Video.findOne({ file_code });
    if (existing) {
      return res.status(400).json({ error: 'Video with this file code already exists' });
    }
    
    // Get video info from Abyss.to
    let videoInfo = null;
    try {
      const infoResult = await abyssService.getVideoInfo(file_code);
      if (infoResult && infoResult.result && infoResult.result.length > 0) {
        videoInfo = infoResult.result[0];
      }
    } catch (infoErr) {
      console.log('Could not fetch video info:', infoErr.message);
    }
    
    const embedUrl = abyssService.getEmbedUrl(file_code);
    let thumbnailUrl = abyssService.getThumbnailUrl(file_code);
    
    // Try to upload thumbnail to Cloudinary
    try {
      const cloudinaryResult = await uploadFromUrl(thumbnailUrl);
      thumbnailUrl = cloudinaryResult.secure_url;
    } catch (cloudErr) {
      console.log('Using Abyss thumbnail');
    }
    
    // Create video
    const video = new Video({
      file_code,
      embed_code: embedUrl,
      title: title || videoInfo?.title || file_code,
      description: description || '',
      thumbnail: thumbnailUrl,
      category: category || null,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
      status: status || 'public',
      featured: featured === 'true' || featured === true,
      duration: videoInfo?.length || '00:00',
      views: videoInfo?.views || 0
    });
    
    await video.save();
    
    // Update category count
    if (category) {
      await Category.findByIdAndUpdate(category, { $inc: { videoCount: 1 } });
    }
    
    res.json({
      success: true,
      video,
      message: 'Video added successfully'
    });
  } catch (error) {
    console.error('Add File Code Error:', error);
    res.status(500).json({ 
      error: 'Failed to add video',
      details: error.message 
    });
  }
});

// POST /api/upload/bulk-file-codes - Add Multiple Videos by File Codes
router.post('/bulk-file-codes', simpleAdminAuth, async (req, res) => {
  try {
    const { videos } = req.body;
    
    if (!videos || !Array.isArray(videos) || videos.length === 0) {
      return res.status(400).json({ error: 'No videos provided' });
    }
    
    const results = {
      success: [],
      failed: []
    };
    
    for (const videoData of videos) {
      try {
        const { file_code, title, category, tags } = videoData;
        
        if (!file_code) {
          results.failed.push({ file_code: 'unknown', error: 'File code is required' });
          continue;
        }
        
        // Check if already exists
        const existing = await Video.findOne({ file_code });
        if (existing) {
          results.failed.push({ file_code, error: 'Already exists' });
          continue;
        }
        
        const embedUrl = abyssService.getEmbedUrl(file_code);
        const thumbnailUrl = abyssService.getThumbnailUrl(file_code);
        
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
        results.failed.push({ 
          file_code: videoData.file_code || 'unknown', 
          error: err.message 
        });
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

// POST /api/upload/thumbnail - Upload Custom Thumbnail
router.post('/thumbnail', simpleAdminAuth, imageUpload.single('thumbnail'), async (req, res) => {
  let uploadedFilePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    uploadedFilePath = req.file.path;
    const { videoId } = req.body;
    
    if (!videoId) {
      cleanupFile(uploadedFilePath);
      return res.status(400).json({ error: 'Video ID is required' });
    }
    
    const video = await Video.findById(videoId);
    if (!video) {
      cleanupFile(uploadedFilePath);
      return res.status(404).json({ error: 'Video not found' });
    }
    
    // Upload to Cloudinary
    const { uploadToCloudinary } = require('../config/cloudinary');
    const cloudinaryResult = await uploadToCloudinary(uploadedFilePath);
    
    // Update video thumbnail
    video.thumbnail = cloudinaryResult.secure_url;
    video.thumbnailPublicId = cloudinaryResult.public_id;
    await video.save();
    
    // Clean up
    cleanupFile(uploadedFilePath);
    
    res.json({
      success: true,
      thumbnail: video.thumbnail,
      message: 'Thumbnail updated successfully'
    });
  } catch (error) {
    console.error('Thumbnail Upload Error:', error);
    
    if (uploadedFilePath) {
      cleanupFile(uploadedFilePath);
    }
    
    res.status(500).json({ 
      error: 'Thumbnail upload failed',
      details: error.message 
    });
  }
});

// POST /api/upload/url - Remote Upload from URL
router.post('/url', simpleAdminAuth, async (req, res) => {
  try {
    const { url, title, description, category, tags } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // Start remote upload on Abyss.to
    const result = await abyssService.remoteUpload(url);
    
    if (!result || result.status !== 200) {
      return res.status(400).json({ 
        error: 'Remote upload failed',
        details: result?.msg || 'Unknown error'
      });
    }
    
    res.json({
      success: true,
      file_code: result.result.filecode,
      message: 'Remote upload started. Video will be available shortly.',
      note: 'You will need to add the video using the file code once processing is complete.'
    });
  } catch (error) {
    console.error('Remote Upload Error:', error);
    res.status(500).json({ 
      error: 'Remote upload failed',
      details: error.message 
    });
  }
});

// GET /api/upload/abyss-files - List Files from Abyss.to
router.get('/abyss-files', simpleAdminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    
    const result = await abyssService.listFiles(parseInt(page), parseInt(limit));
    
    if (!result || result.status !== 200) {
      return res.status(400).json({ 
        error: 'Failed to list files',
        details: result?.msg || 'Unknown error'
      });
    }
    
    // Check which files are already in database
    const fileCodes = result.result.files.map(f => f.file_code);
    const existingVideos = await Video.find({ 
      file_code: { $in: fileCodes } 
    }).select('file_code');
    
    const existingCodes = new Set(existingVideos.map(v => v.file_code));
    
    const filesWithStatus = result.result.files.map(file => ({
      ...file,
      alreadyAdded: existingCodes.has(file.file_code)
    }));
    
    res.json({
      success: true,
      files: filesWithStatus,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.result.results_total
      }
    });
  } catch (error) {
    console.error('List Abyss Files Error:', error);
    res.status(500).json({ 
      error: 'Failed to list files',
      details: error.message 
    });
  }
});

// GET /api/upload/account-info - Get Abyss.to Account Info
router.get('/account-info', simpleAdminAuth, async (req, res) => {
  try {
    const result = await abyssService.getAccountInfo();
    
    if (!result || result.status !== 200) {
      return res.status(400).json({ 
        error: 'Failed to get account info',
        details: result?.msg || 'Unknown error'
      });
    }
    
    res.json({
      success: true,
      account: result.result
    });
  } catch (error) {
    console.error('Account Info Error:', error);
    res.status(500).json({ 
      error: 'Failed to get account info',
      details: error.message 
    });
  }
});

module.exports = router;