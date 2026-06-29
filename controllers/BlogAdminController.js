const Post = require('../models/Post');

const adm = (res, view, data = {}) => res.renderLayout(view, data, 'admin');

class BlogAdminController {

  static index(req, res) {
    const posts = Post.all();
    const stats = Post.stats();
    adm(res, 'admin/blog/index', {
      title: 'Blog — Admin',
      pageTitle: 'Blog',
      activePage: 'blog',
      posts,
      stats,
    });
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
