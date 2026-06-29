const { db, nextId } = require('../database/db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

class User {
  static create({ name, email, password }) {
    const uuid = uuidv4();
    const hashedPassword = bcrypt.hashSync(password, 12);
    const trialDays = parseInt(process.env.TRIAL_DAYS) || 7;
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

    const user = {
      id: nextId('user'),
      uuid,
      name,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      plan: 'trial',
      trial_ends_at: trialEndsAt.toISOString(),
      subscription_ends_at: null,
      created_at: new Date().toISOString(),
    };
    db.get('users').push(user).write();
    return user;
  }

  static findById(id) {
    return db.get('users').find({ id: Number(id) }).value() || null;
  }

  static findByEmail(email) {
    return db.get('users').find(u => u.email === email.toLowerCase().trim()).value() || null;
  }

  static verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compareSync(plainPassword, hashedPassword);
  }

  static isOnTrial(user) {
    if (!user || user.plan !== 'trial') return false;
    return new Date(user.trial_ends_at) > new Date();
  }

  static hasActiveSubscription(user) {
    if (!user) return false;
    if (this.isOnTrial(user)) return true;
    if (user.plan === 'active' && user.subscription_ends_at) {
      return new Date(user.subscription_ends_at) > new Date();
    }
    return false;
  }

  static trialDaysLeft(user) {
    if (!user || !user.trial_ends_at) return 0;
    const diff = new Date(user.trial_ends_at) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  static getStats(userId) {
    const uid = Number(userId);
    const invoices = db.get('invoices').filter({ user_id: uid, type: 'invoice' }).value();
    const quotes = db.get('invoices').filter({ user_id: uid, type: 'quote' }).value();
    const clients = db.get('clients').filter({ user_id: uid }).value();
    const paid = invoices.filter(i => i.status === 'paid');
    const pending = invoices.filter(i => i.status === 'sent');
    return {
      invoices: invoices.length,
      quotes: quotes.length,
      clients: clients.length,
      revenue: paid.reduce((sum, i) => sum + (i.total || 0), 0),
      pending: pending.reduce((sum, i) => sum + (i.total || 0), 0),
    };
  }
}

module.exports = User;
