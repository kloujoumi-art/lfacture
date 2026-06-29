const Post = require('../models/Post');

class BlogController {

  static index(req, res) {
    const posts = Post.published();
    res.renderLayout('blog/index', {
      title: 'Blog — LFacture — Conseils Facturation & Gestion',
      metaDesc: 'Découvrez nos articles sur la facturation, la gestion de devis, et les conseils pour les auto-entrepreneurs et PME.',
      posts,
    });
  }

  static show(req, res) {
    const post = Post.findBySlug(req.params.slug);
    if (!post || !post.published) {
      return res.status(404).renderLayout('errors/404', { title: 'Article introuvable — LFacture' });
    }
    // Articles connexes (mêmes tags, excluant le courant)
    const allPublished = Post.published().filter(p => p.id !== post.id);
    const related = allPublished.slice(0, 3);

    res.renderLayout('blog/show', {
      title: `${post.title} — Blog LFacture`,
      metaDesc: post.meta_desc || post.excerpt || '',
      ogImage: post.cover_image || '',
      post,
      related,
    });
  }
}

module.exports = BlogController;
