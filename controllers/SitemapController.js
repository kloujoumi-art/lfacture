const Post = require('../models/Post');
const APP_URL = process.env.APP_URL || 'https://lfacture.com';

module.exports = function sitemap(req, res) {
  const staticPages = [
    { loc: '/', priority: '1.0', changefreq: 'weekly' },
    { loc: '/pricing', priority: '0.9', changefreq: 'monthly' },
    { loc: '/features', priority: '0.8', changefreq: 'monthly' },
    { loc: '/blog', priority: '0.8', changefreq: 'weekly' },
    { loc: '/register', priority: '0.7', changefreq: 'monthly' },
    { loc: '/login', priority: '0.5', changefreq: 'monthly' },
  ];

  const posts = Post.published();
  const now = new Date().toISOString().split('T')[0];

  const urls = [
    ...staticPages.map(p => `
  <url>
    <loc>${APP_URL}${p.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`),
    ...posts.map(p => `
  <url>
    <loc>${APP_URL}/blog/${p.slug}</loc>
    <lastmod>${(p.updated_at || p.published_at || p.created_at).split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`),
  ];

  res.header('Content-Type', 'application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}
</urlset>`);
};
