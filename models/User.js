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
      is_admin: 0,
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

  static makeAdmin(email) {
    db.get('users').find(u => u.email === email.toLowerCase()).assign({ is_admin: 1 }).write();
  }

  static updatePlan(id, plan, daysFromNow = null) {
    const patch = { plan };
    if (daysFromNow !== null) {
      const d = new Date();
      d.setDate(d.getDate() + daysFromNow);
      patch.subscription_ends_at = d.toISOString();
    }
    db.get('users').find({ id: Number(id) }).assign(patch).write();
  }

  static delete(id) {
    db.get('users').remove({ id: Number(id) }).write();
    db.get('clients').remove({ user_id: Number(id) }).write();
    db.get('invoices').remove({ user_id: Number(id) }).write();
    db.get('settings').remove({ user_id: Number(id) }).write();
  }

  static all() {
    return db.get('users').sortBy(u => -new Date(u.created_at).getTime()).value();
  }

  static globalStats() {
    const users = db.get('users').value();
    const invoices = db.get('invoices').value();
    const now = new Date();
    return {
      total_users: users.length,
      trial_users: users.filter(u => u.plan === 'trial' && new Date(u.trial_ends_at) > now).length,
      active_users: users.filter(u => u.plan === 'active' && u.subscription_ends_at && new Date(u.subscription_ends_at) > now).length,
      expired_users: users.filter(u => {
        if (u.plan === 'trial') return new Date(u.trial_ends_at) <= now;
        if (u.plan === 'active') return !u.subscription_ends_at || new Date(u.subscription_ends_at) <= now;
        return false;
      }).length,
      total_invoices: invoices.filter(i => i.type === 'invoice').length,
      total_quotes: invoices.filter(i => i.type === 'quote').length,
      new_today: users.filter(u => new Date(u.created_at).toDateString() === now.toDateString()).length,
    };
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
