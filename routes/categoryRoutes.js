const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const Video = require('../models/Video');
const { simpleAdminAuth } = require('../middleware/adminAuth');

// ==================== PUBLIC ROUTES ====================

// GET /api/categories - Get All Active Categories
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ order: 1, name: 1 });
    
    res.json({ success: true, categories });
  } catch (error) {
    console.error('Get Categories Error:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

// GET /api/categories/:slug - Get Category by Slug
router.get('/:slug', async (req, res) => {
  try {
    const category = await Category.findOne({ 
      slug: req.params.slug,
      isActive: true 
    });
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json({ success: true, category });
  } catch (error) {
    console.error('Get Category Error:', error);
    res.status(500).json({ error: 'Failed to get category' });
  }
});

// GET /api/categories/:slug/videos - Get Videos in Category
router.get('/:slug/videos', async (req, res) => {
  try {
    const { page = 1, limit = 20, sort = 'newest' } = req.query;
    
    const category = await Category.findOne({ 
      slug: req.params.slug,
      isActive: true 
    });
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
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
      Video.find({ 
        category: category._id,
        status: 'public'
      })
        .populate('category', 'name slug')
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-file_code -thumbnailPublicId'),
      Video.countDocuments({ 
        category: category._id,
        status: 'public'
      })
    ]);
    
    res.json({
      success: true,
      category,
      videos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get Category Videos Error:', error);
    res.status(500).json({ error: 'Failed to get category videos' });
  }
});

// ==================== ADMIN ROUTES ====================

// POST /api/categories - Create Category (Admin)
router.post('/', simpleAdminAuth, async (req, res) => {
  try {
    const { name, description, thumbnail, icon, color } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    
    // Check if category exists
    const existing = await Category.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Category already exists' });
    }
    
    const category = await Category.create({
      name,
      description: description || '',
      thumbnail: thumbnail || '',
      icon: icon || '📁',
      color: color || '#6366f1'
    });
    
    res.json({ 
      success: true, 
      category,
      message: 'Category created successfully'
    });
  } catch (error) {
    console.error('Create Category Error:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PUT /api/categories/:id - Update Category (Admin)
router.put('/:id', simpleAdminAuth, async (req, res) => {
  try {
    const { name, description, thumbnail, icon, color, isActive, order } = req.body;
    
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    if (name) category.name = name;
    if (description !== undefined) category.description = description;
    if (thumbnail !== undefined) category.thumbnail = thumbnail;
    if (icon) category.icon = icon;
    if (color) category.color = color;
    if (isActive !== undefined) category.isActive = isActive;
    if (order !== undefined) category.order = order;
    
    await category.save();
    
    res.json({ 
      success: true, 
      category,
      message: 'Category updated successfully'
    });
  } catch (error) {
    console.error('Update Category Error:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/categories/:id - Delete Category (Admin)
router.delete('/:id', simpleAdminAuth, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Remove category from all videos
    await Video.updateMany(
      { category: category._id },
      { $set: { category: null } }
    );
    
    await Category.findByIdAndDelete(req.params.id);
    
    res.json({ 
      success: true, 
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Delete Category Error:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// PUT /api/categories/reorder - Reorder Categories (Admin)
router.put('/admin/reorder', simpleAdminAuth, async (req, res) => {
  try {
    const { order } = req.body; // Array of { id, position }
    
    if (!order || !Array.isArray(order)) {
      return res.status(400).json({ error: 'Order array is required' });
    }
    
    for (const item of order) {
      await Category.findByIdAndUpdate(item.id, { order: item.position });
    }
    
    res.json({ 
      success: true, 
      message: 'Categories reordered successfully'
    });
  } catch (error) {
    console.error('Reorder Categories Error:', error);
    res.status(500).json({ error: 'Failed to reorder categories' });
  }
});

module.exports = router;