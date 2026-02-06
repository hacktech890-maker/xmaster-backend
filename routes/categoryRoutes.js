const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Category = require('../models/Category');
const Video = require('../models/Video');

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

// GET /api/categories
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ order: 1, name: 1 });
    res.json({ success: true, categories });
  } catch (error) {
    console.error('Get Categories Error:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

// GET /api/categories/:slug
router.get('/:slug', async (req, res) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug, isActive: true });
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.json({ success: true, category });
  } catch (error) {
    console.error('Get Category Error:', error);
    res.status(500).json({ error: 'Failed to get category' });
  }
});

// GET /api/categories/:slug/videos
router.get('/:slug/videos', async (req, res) => {
  try {
    const { page = 1, limit = 20, sort = 'newest' } = req.query;
    const category = await Category.findOne({ slug: req.params.slug, isActive: true });
    if (!category) return res.status(404).json({ error: 'Category not found' });

    let sortOption = {};
    switch (sort) {
      case 'oldest': sortOption = { uploadDate: 1 }; break;
      case 'views': sortOption = { views: -1 }; break;
      default: sortOption = { uploadDate: -1 };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [videos, total] = await Promise.all([
      Video.find({ category: category._id, status: 'public' })
        .populate('category', 'name slug')
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit)),
      Video.countDocuments({ category: category._id, status: 'public' })
    ]);

    res.json({
      success: true,
      category,
      videos,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    console.error('Get Category Videos Error:', error);
    res.status(500).json({ error: 'Failed to get category videos' });
  }
});

// POST /api/categories (Admin)
router.post('/', simpleAdminAuth, async (req, res) => {
  try {
    const { name, description, thumbnail, icon, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required' });

    const existing = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existing) return res.status(400).json({ error: 'Category already exists' });

    const category = await Category.create({
      name,
      description: description || '',
      thumbnail: thumbnail || '',
      icon: icon || '📁',
      color: color || '#ef4444'
    });

    res.json({ success: true, category, message: 'Category created successfully' });
  } catch (error) {
    console.error('Create Category Error:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PUT /api/categories/:id (Admin)
router.put('/:id', simpleAdminAuth, async (req, res) => {
  try {
    const { name, description, thumbnail, icon, color, isActive, order } = req.body;
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });

    if (name) category.name = name;
    if (description !== undefined) category.description = description;
    if (thumbnail !== undefined) category.thumbnail = thumbnail;
    if (icon) category.icon = icon;
    if (color) category.color = color;
    if (isActive !== undefined) category.isActive = isActive;
    if (order !== undefined) category.order = order;

    await category.save();
    res.json({ success: true, category, message: 'Category updated successfully' });
  } catch (error) {
    console.error('Update Category Error:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/categories/:id (Admin)
router.delete('/:id', simpleAdminAuth, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });

    await Video.updateMany({ category: category._id }, { $set: { category: null } });
    await Category.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete Category Error:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

module.exports = router;