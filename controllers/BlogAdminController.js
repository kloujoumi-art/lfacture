const Post = require('../models/Post');
const BlogCampaign = require('../models/BlogCampaign');
const BlogCampaignService = require('../services/BlogCampaignService');

const adm = (res, view, data = {}) => res.renderLayout(view, data, 'admin');

class BlogAdminController {

  static index(req, res) {
    const posts = Post.all();
    const stats = Post.stats();
    const campaigns = BlogCampaign.all();
    adm(res, 'admin/blog/index', {
      title: 'Blog — Admin',
      pageTitle: 'Blog & Automatisation',
      activePage: 'blog',
      posts,
      stats,
      campaigns,
    });
  }

  // ── Campaigns JSON API ──

  static getCampaigns(req, res) {
    res.json(BlogCampaign.all());
  }

  static async createCampaign(req, res) {
    try {
      const { name, keywords_raw, language, frequency } = req.body;
      if (!name || !keywords_raw) return res.status(400).json({ error: 'Nom et keywords requis' });
      const keywords = keywords_raw.split(/[,\n]+/).map(k => k.trim()).filter(Boolean);
      if (!keywords.length) return res.status(400).json({ error: 'Au moins un keyword requis' });
      const campaign = BlogCampaign.create({ name, keywords, language: language || 'fr', frequency: frequency || 'daily' });
      res.status(201).json(campaign);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }

  static toggleCampaign(req, res) {
    const campaign = BlogCampaign.toggleActive(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campagne introuvable' });
    res.json(campaign);
  }

  static async runCampaignNow(req, res) {
    const campaign = BlogCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campagne introuvable' });
    try {
      const result = await BlogCampaignService.runCampaign(campaign);
      res.json({ ok: true, title: result.post.title, slug: result.post.slug, keyword: result.keyword });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }

  static updateCampaign(req, res) {
    const campaign = BlogCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campagne introuvable' });
    const { name, keywords_raw, language, frequency } = req.body;
    const keywords = (keywords_raw || '').split(/[,\n]+/).map(k => k.trim()).filter(Boolean);
    if (!name || !keywords.length) return res.status(400).json({ error: 'Nom et keywords requis' });
    const updated = BlogCampaign.update(campaign.id, {
      name: name.trim(),
      keywords: JSON.stringify(keywords),
      language: language || campaign.language,
      frequency: frequency || campaign.frequency,
    });
    res.json(updated);
  }

  static deleteCampaign(req, res) {
    const campaign = BlogCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campagne introuvable' });
    BlogCampaign.delete(campaign.id);
    res.json({ ok: true });
  }

  static showCreate(req, res) {
    adm(res, 'admin/blog/edit', {
      title: 'Nouvel article — Admin',
      pageTitle: 'Nouvel article',
      activePage: 'blog',
      post: null,
      errors: [],
    });
  }

  static create(req, res) {
    const { title, excerpt, content, cover_image, tags, meta_desc, published } = req.body;
    const errors = [];

    if (!title || title.trim().length < 3) errors.push('Le titre doit contenir au moins 3 caractères.');
    if (!content || content.trim().length < 20) errors.push('Le contenu est trop court.');

    if (errors.length > 0) {
      return adm(res, 'admin/blog/edit', {
        title: 'Nouvel article — Admin',
        pageTitle: 'Nouvel article',
        activePage: 'blog',
        post: { title, excerpt, content, cover_image, tags, meta_desc },
        errors,
      });
    }

    const post = Post.create({ title, excerpt, content, cover_image, tags, meta_desc, published: !!published });
    req.flash('success', `Article "${post.title}" créé avec succès.`);
    res.redirect('/admin/blog');
  }

  static showEdit(req, res) {
    const post = Post.findById(req.params.id);
    if (!post) return res.redirect('/admin/blog');
    adm(res, 'admin/blog/edit', {
      title: `Modifier : ${post.title} — Admin`,
      pageTitle: `Modifier l'article`,
      activePage: 'blog',
      post,
      errors: [],
    });
  }

  static update(req, res) {
    const post = Post.findById(req.params.id);
    if (!post) return res.redirect('/admin/blog');

    const { title, excerpt, content, cover_image, tags, meta_desc, published } = req.body;
    const errors = [];

    if (!title || title.trim().length < 3) errors.push('Le titre est requis.');
    if (!content || content.trim().length < 20) errors.push('Le contenu est trop court.');

    if (errors.length > 0) {
      return adm(res, 'admin/blog/edit', {
        title: `Modifier article — Admin`,
        pageTitle: `Modifier l'article`,
        activePage: 'blog',
        post: { ...post, title, excerpt, content, cover_image, tags, meta_desc },
        errors,
      });
    }

    Post.update(post.id, { title, excerpt, content, cover_image, tags, meta_desc, published: !!published });
    req.flash('success', `Article "${title}" mis à jour.`);
    res.redirect('/admin/blog');
  }

  static togglePublish(req, res) {
    const post = Post.findById(req.params.id);
    if (!post) return res.redirect('/admin/blog');
    const updated = Post.togglePublish(post.id);
    req.flash('success', updated.published ? `"${updated.title}" publié.` : `"${updated.title}" repassé en brouillon.`);
    res.redirect('/admin/blog');
  }

  static delete(req, res) {
    const post = Post.findById(req.params.id);
    if (!post) return res.redirect('/admin/blog');
    Post.delete(post.id);
    req.flash('success', `Article "${post.title}" supprimé.`);
    res.redirect('/admin/blog');
  }
}

module.exports = BlogAdminController;
