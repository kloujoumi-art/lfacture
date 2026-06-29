const { db, nextId } = require('../database/db');

const FREQ_MS = {
  daily:       24 * 60 * 60 * 1000,
  four_daily:  6  * 60 * 60 * 1000,
  six_daily:   4  * 60 * 60 * 1000,
  eight_daily: 3  * 60 * 60 * 1000,
  ten_daily:   2  * 60 * 60 * 1000 + 24 * 60 * 1000,
};

const FREQ_LABELS = {
  daily: '1/jour', four_daily: '4/jour', six_daily: '6/jour',
  eight_daily: '8/jour', ten_daily: '10/jour',
};

class BlogCampaign {
  static create({ name, keywords, language = 'fr', frequency = 'daily', tone = 'professional', image_source = 'pexels' }) {
    const now = new Date();
    const nextRunAt = new Date(now.getTime() + (FREQ_MS[frequency] || FREQ_MS.daily));
    const campaign = {
      id: nextId('blog_campaign'),
      name: name.trim(),
      keywords: JSON.stringify(keywords),
      language,
      frequency,
      tone,
      image_source,
      is_active: true,
      keyword_index: 0,
      run_count: 0,
      success_count: 0,
      last_run_at: null,
      last_error: null,
      next_run_at: nextRunAt.toISOString(),
      created_at: now.toISOString(),
    };
    db.get('blog_campaigns').push(campaign).write();
    return BlogCampaign._format(campaign);
  }

  static all() {
    return (db.get('blog_campaigns').value() || [])
      .sort((a, b) => b.id - a.id)
      .map(BlogCampaign._format);
  }

  static findById(id) {
    const c = db.get('blog_campaigns').find({ id: Number(id) }).value();
    return c ? BlogCampaign._format(c) : null;
  }

  static update(id, data) {
    db.get('blog_campaigns').find({ id: Number(id) }).assign(data).write();
    return BlogCampaign.findById(id);
  }

  static delete(id) {
    db.get('blog_campaigns').remove({ id: Number(id) }).write();
  }

  static toggleActive(id) {
    const c = db.get('blog_campaigns').find({ id: Number(id) }).value();
    if (!c) return null;
    db.get('blog_campaigns').find({ id: Number(id) }).assign({ is_active: !c.is_active }).write();
    return BlogCampaign.findById(id);
  }

  static findDue() {
    const now = new Date();
    return (db.get('blog_campaigns').value() || [])
      .filter(c => c.is_active && c.next_run_at && new Date(c.next_run_at) <= now)
      .map(BlogCampaign._format);
  }

  static _format(c) {
    let keywords;
    try { keywords = JSON.parse(c.keywords); } catch { keywords = []; }
    return {
      ...c,
      keywords,
      freq_label: FREQ_LABELS[c.frequency] || c.frequency,
    };
  }
}

module.exports = BlogCampaign;
