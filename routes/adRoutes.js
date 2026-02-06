const express = require('express');
const router = express.Router();
const Ad = require('../models/Ad');
const { simpleAdminAuth } = require('../middleware/adminAuth');

// ==================== PUBLIC ROUTES ====================

// GET /api/ads - Get All Active Ads
router.get('/', async (req, res) => {
  try {
    const { device = 'desktop' } = req.query;
    
    const now = new Date();
    
    const ads = await Ad.find({
      enabled: true,
      $or: [
        { device: 'all' },
        { device: device }
      ],
      $or: [
        { startDate: null },
        { startDate: { $lte: now } }
      ],
      $or: [
        { endDate: null },
        { endDate: { $gte: now } }
      ]
    }).sort({ priority: -1, placement: 1 });
    
    // Group by placement
    const adsByPlacement = {};
    ads.forEach(ad => {
      if (!adsByPlacement[ad.placement]) {
        adsByPlacement[ad.placement] = [];
      }
      adsByPlacement[ad.placement].push(ad);
    });
    
    res.json({ 
      success: true, 
      ads: adsByPlacement 
    });
  } catch (error) {
    console.error('Get Ads Error:', error);
    res.status(500).json({ error: 'Failed to get ads' });
  }
});

// GET /api/ads/:placement - Get Ad by Placement
router.get('/placement/:placement', async (req, res) => {
  try {
    const { device = 'desktop' } = req.query;
    const now = new Date();
    
    const ad = await Ad.findOne({
      placement: req.params.placement,
      enabled: true,
      $or: [
        { device: 'all' },
        { device: device }
      ],
      $or: [
        { startDate: null },
        { startDate: { $lte: now } }
      ],
      $or: [
        { endDate: null },
        { endDate: { $gte: now } }
      ]
    }).sort({ priority: -1 });
    
    if (!ad) {
      return res.json({ success: true, ad: null });
    }
    
    res.json({ success: true, ad });
  } catch (error) {
    console.error('Get Ad Error:', error);
    res.status(500).json({ error: 'Failed to get ad' });
  }
});

// POST /api/ads/:id/impression - Record Impression
router.post('/:id/impression', async (req, res) => {
  try {
    await Ad.findByIdAndUpdate(req.params.id, { $inc: { impressions: 1 } });
    res.json({ success: true });
  } catch (error) {
    console.error('Impression Error:', error);
    res.status(500).json({ error: 'Failed to record impression' });
  }
});

// POST /api/ads/:id/click - Record Click
router.post('/:id/click', async (req, res) => {
  try {
    await Ad.findByIdAndUpdate(req.params.id, { $inc: { clicks: 1 } });
    res.json({ success: true });
  } catch (error) {
    console.error('Click Error:', error);
    res.status(500).json({ error: 'Failed to record click' });
  }
});

// ==================== ADMIN ROUTES ====================

// GET /api/ads/admin/all - Get All Ads (Admin)
router.get('/admin/all', simpleAdminAuth, async (req, res) => {
  try {
    const ads = await Ad.find().sort({ placement: 1, priority: -1 });
    res.json({ success: true, ads });
  } catch (error) {
    console.error('Get All Ads Error:', error);
    res.status(500).json({ error: 'Failed to get ads' });
  }
});

// GET /api/ads/placements - Get Available Placements
router.get('/admin/placements', simpleAdminAuth, (req, res) => {
  const placements = [
    { id: 'home_top', name: 'Home - Top Banner', size: '728x90' },
    { id: 'home_sidebar', name: 'Home - Sidebar', size: '300x600' },
    { id: 'home_infeed', name: 'Home - In-Feed', size: 'Native' },
    { id: 'home_footer', name: 'Home - Footer', size: '728x90' },
    { id: 'watch_sidebar', name: 'Watch - Sidebar', size: '300x250' },
    { id: 'watch_below', name: 'Watch - Below Player', size: '728x90' },
    { id: 'watch_related', name: 'Watch - Related Videos', size: 'Native' },
    { id: 'watch_overlay', name: 'Watch - Video Overlay', size: '480x70' },
    { id: 'search_top', name: 'Search - Top', size: '728x90' },
    { id: 'category_top', name: 'Category - Top', size: '728x90' },
    { id: 'popunder', name: 'Popunder', size: 'Full Page' },
    { id: 'interstitial', name: 'Interstitial', size: 'Full Page' }
  ];
  
  res.json({ success: true, placements });
});

// POST /api/ads - Create Ad (Admin)
router.post('/', simpleAdminAuth, async (req, res) => {
  try {
    const {
      name,
      placement,
      type,
      code,
      imageUrl,
      targetUrl,
      device,
      enabled,
      startDate,
      endDate,
      priority,
      size
    } = req.body;
    
    if (!name || !placement || !code) {
      return res.status(400).json({ error: 'Name, placement, and code are required' });
    }
    
    const ad = await Ad.create({
      name,
      placement,
      type: type || 'script',
      code,
      imageUrl: imageUrl || '',
      targetUrl: targetUrl || '',
      device: device || 'all',
      enabled: enabled !== false,
      startDate: startDate || null,
      endDate: endDate || null,
      priority: priority || 0,
      size: size || { width: 728, height: 90 }
    });
    
    res.json({ 
      success: true, 
      ad,
      message: 'Ad created successfully'
    });
  } catch (error) {
    console.error('Create Ad Error:', error);
    res.status(500).json({ error: 'Failed to create ad' });
  }
});

// PUT /api/ads/:id - Update Ad (Admin)
router.put('/:id', simpleAdminAuth, async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    
    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }
    
    const updateFields = [
      'name', 'placement', 'type', 'code', 'imageUrl', 'targetUrl',
      'device', 'enabled', 'startDate', 'endDate', 'priority', 'size'
    ];
    
    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        ad[field] = req.body[field];
      }
    });
    
    await ad.save();
    
    res.json({ 
      success: true, 
      ad,
      message: 'Ad updated successfully'
    });
  } catch (error) {
    console.error('Update Ad Error:', error);
    res.status(500).json({ error: 'Failed to update ad' });
  }
});

// DELETE /api/ads/:id - Delete Ad (Admin)
router.delete('/:id', simpleAdminAuth, async (req, res) => {
  try {
    const ad = await Ad.findByIdAndDelete(req.params.id);
    
    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }
    
    res.json({ 
      success: true, 
      message: 'Ad deleted successfully'
    });
  } catch (error) {
    console.error('Delete Ad Error:', error);
    res.status(500).json({ error: 'Failed to delete ad' });
  }
});

// PUT /api/ads/:id/toggle - Toggle Ad Status (Admin)
router.put('/:id/toggle', simpleAdminAuth, async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    
    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }
    
    ad.enabled = !ad.enabled;
    await ad.save();
    
    res.json({ 
      success: true, 
      enabled: ad.enabled,
      message: ad.enabled ? 'Ad enabled' : 'Ad disabled'
    });
  } catch (error) {
    console.error('Toggle Ad Error:', error);
    res.status(500).json({ error: 'Failed to toggle ad' });
  }
});

module.exports = router;