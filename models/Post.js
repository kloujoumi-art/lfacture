const { db, nextId } = require('../database/db');

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

function uniqueSlug(base) {
  let slug = base;
  let i = 1;
  while (db.get('posts').find({ slug }).value()) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

class Post {
  static create({ title, excerpt, content, cover_image, tags, meta_desc, published }) {
    const slug = uniqueSlug(slugify(title));
    const post = {
      id: nextId('post'),
      slug,
      title: title.trim(),
      excerpt: (excerpt || '').trim(),
      content: content || '',
      cover_image: cover_image || '',
      tags: tags || '',
      meta_desc: meta_desc || '',
      published: !!published,
      published_at: published ? new Date().toISOString() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.get('posts').push(post).write();
    return post;
  }

  static update(id, data) {
    const patch = { ...data, updated_at: new Date().toISOString() };
    if (data.published && !patch.published_at) {
      const existing = db.get('posts').find({ id: Number(id) }).value();
      if (!existing?.published_at) patch.published_at = new Date().toISOString();
    }
    db.get('posts').find({ id: Number(id) }).assign(patch).write();
    return db.get('posts').find({ id: Number(id) }).value();
  }

  static findById(id) {
    return db.get('posts').find({ id: Number(id) }).value() || null;
  }

  static findBySlug(slug) {
    return db.get('posts').find({ slug }).value() || null;
  }

  static all() {
    return db.get('posts')
      .value()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  static published() {
    return db.get('posts')
      .filter({ published: true })
      .value()
      .sort((a, b) => new Date(b.published_at || b.created_at) - new Date(a.published_at || a.created_at));
  }

  static delete(id) {
    db.get('posts').remove({ id: Number(id) }).write();
  }

  static togglePublish(id) {
    const post = db.get('posts').find({ id: Number(id) }).value();
    if (!post) return null;
    const published = !post.published;
    db.get('posts').find({ id: Number(id) }).assign({
      published,
      published_at: published ? (post.published_at || new Date().toISOString()) : null,
      updated_at: new Date().toISOString(),
    }).write();
    return db.get('posts').find({ id: Number(id) }).value();
  }

  static stats() {
    const posts = db.get('posts').value();
    return {
      total: posts.length,
      published: posts.filter(p => p.published).length,
      drafts: posts.filter(p => !p.published).length,
    };
  }
}

module.exports = Post;
