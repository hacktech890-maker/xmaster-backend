const express = require('express');
const router = express.Router();
const Video = require('../models/Video');
const Category = require('../models/Category');
const Settings = require('../models/Settings');

// GET /api/public/home - Get Home Page Data
router.get('/home', async (req, res) => {
  try {
    const [
      featuredVideos,
      latestVideos,
      trendingVideos,
      categories
    ] = await Promise.all([
      // Featured Videos
      Video.find({ status: 'public', featured: true })
        .sort({ uploadDate: -1 })
        .limit(6)
        .populate('category', 'name slug')
        .select('-file_code -thumbnailPublicId'),
      
      // Latest Videos
      Video.find({ status: 'public' })
        .sort({ uploadDate: -1 })
        .limit(12)
        .populate('category', 'name slug')
        .select('-file_code -thumbnailPublicId'),
      
      // Trending Videos
      Video.find({ status: 'public' })
        .sort({ views: -1 })
        .limit(12)
        .populate('category', 'name slug')
        .select('-file_code -thumbnailPublicId'),
      
      // Categories
      Category.find({ isActive: true })
        .sort({ order: 1 })
        .limit(10)
    ]);
    
    res.json({
      success: true,
      data: {
        featuredVideos,
        latestVideos,
        trendingVideos,
        categories
      }
    });
  } catch (error) {
    console.error('Home Data Error:', error);
    res.status(500).json({ error: 'Failed to get home data' });
  }
});

// GET /api/public/sitemap - Generate Sitemap
router.get('/sitemap', async (req, res) => {
  try {
    const baseUrl = process.env.FRONTEND_URL?.split(',')[0] || 'https://example.com';
    
    const videos = await Video.find({ status: 'public' })
      .select('_id slug updatedAt')
      .sort({ updatedAt: -1 });
    
    const categories = await Category.find({ isActive: true })
      .select('slug updatedAt');
    
    let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
    sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    // Home page
    sitemap += `  <url>\n    <loc>${baseUrl}</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
    
    // Video pages
    videos.forEach(video => {
      sitemap += `  <url>\n    <loc>${baseUrl}/watch/${video._id}/${video.slug || ''}</loc>\n    <lastmod>${video.updatedAt.toISOString()}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    });
    
    // Category pages
    categories.forEach(category => {
      sitemap += `  <url>\n    <loc>${baseUrl}/category/${category.slug}</loc>\n    <lastmod>${category.updatedAt.toISOString()}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
    });
    
    // Static pages
    const staticPages = ['trending', 'search'];
    staticPages.forEach(page => {
      sitemap += `  <url>\n    <loc>${baseUrl}/${page}</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.6</priority>\n  </url>\n`;
    });
    
    sitemap += '</urlset>';
    
    res.header('Content-Type', 'application/xml');
    res.send(sitemap);
  } catch (error) {
    console.error('Sitemap Error:', error);
    res.status(500).json({ error: 'Failed to generate sitemap' });
  }
});

// GET /api/public/stats - Get Public Stats
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
    console.error('Stats Error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = router;