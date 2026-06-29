const { db, nextId } = require('../database/db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const FREE_INVOICE_LIMIT = 8;
const FREE_QUOTE_LIMIT = 8;

class User {
  static create({ name, email, password }) {
    const user = {
      id: nextId('user'),
      uuid: uuidv4(),
      name,
      email: email.toLowerCase().trim(),
      password: bcrypt.hashSync(password, 12),
      plan: 'pending',           // en attente de vérification email
      is_admin: 0,
      email_verified: 0,
      verification_token: uuidv4(),
      verification_sent_at: new Date().toISOString(),
      subscription_ends_at: null,
      funnel_step: 0,
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

  // Vérifie l'email → active le plan gratuit (pas de limite de temps)
  static verifyEmail(token) {
    const user = db.get('users').find(u => u.verification_token === token).value();
    if (!user) return null;
    if (user.email_verified) return user;

    db.get('users').find({ id: user.id }).assign({
      email_verified: 1,
      plan: 'free',              // plan gratuit, sans limite de temps
      verification_token: null,
    }).write();

    return db.get('users').find({ id: user.id }).value();
  }

  static isPending(user) {
    return user && user.plan === 'pending' && !user.email_verified;
  }

  static isFree(user) {
    return user && user.plan === 'free';
  }

  // Un utilisateur a accès si : plan gratuit OU abonnement actif OU admin
  static hasActiveSubscription(user) {
    if (!user) return false;
    if (user.is_admin) return true;
    if (user.plan === 'free') return true;  // plan gratuit = accès permanent (limité en volume)
    if (user.plan === 'active' && user.subscription_ends_at) {
      return new Date(user.subscription_ends_at) > new Date();
    }
    return false;
  }

  // Quota pour le plan gratuit
  static getQuota(userId) {
    const uid = Number(userId);
    const invoices = db.get('invoices').filter({ user_id: uid, type: 'invoice' }).value().length;
    const quotes   = db.get('invoices').filter({ user_id: uid, type: 'quote' }).value().length;
    return {
      invoices: { used: invoices, max: FREE_INVOICE_LIMIT, remaining: Math.max(0, FREE_INVOICE_LIMIT - invoices), reached: invoices >= FREE_INVOICE_LIMIT },
      quotes:   { used: quotes,   max: FREE_QUOTE_LIMIT,   remaining: Math.max(0, FREE_QUOTE_LIMIT - quotes),     reached: quotes >= FREE_QUOTE_LIMIT   },
    };
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
    db.get('contacts').remove({ user_id: Number(id) }).write();
    db.get('funnel_logs').remove({ user_id: Number(id) }).write();
  }

  static all() {
    return db.get('users').sortBy(u => -new Date(u.created_at).getTime()).value();
  }

  static globalStats() {
    const users = db.get('users').value();
    const invoices = db.get('invoices').value();
    const contacts = db.get('contacts').value();
    const now = new Date();
    return {
      total_users:   users.filter(u => !u.is_admin).length,
      pending_users: users.filter(u => u.plan === 'pending' || !u.email_verified).length,
      free_users:    users.filter(u => u.plan === 'free').length,
      active_users:  users.filter(u => u.plan === 'active' && u.subscription_ends_at && new Date(u.subscription_ends_at) > now).length,
      expired_users: users.filter(u => u.plan === 'active' && (!u.subscription_ends_at || new Date(u.subscription_ends_at) <= now)).length,
      total_invoices: invoices.filter(i => i.type === 'invoice').length,
      total_quotes:   invoices.filter(i => i.type === 'quote').length,
      new_today:      users.filter(u => new Date(u.created_at).toDateString() === now.toDateString()).length,
      total_contacts: contacts.length,
    };
  }

  static getFreeUsers() {
    return db.get('users')
      .filter({ plan: 'free' })
      .value()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  static getStats(userId) {
    const uid = Number(userId);
    const invoices = db.get('invoices').filter({ user_id: uid, type: 'invoice' }).value();
    const quotes   = db.get('invoices').filter({ user_id: uid, type: 'quote' }).value();
    const clients  = db.get('clients').filter({ user_id: uid }).value();
    const paid    = invoices.filter(i => i.status === 'paid');
    const pending = invoices.filter(i => i.status === 'sent');
    return {
      invoices: invoices.length,
      quotes:   quotes.length,
      clients:  clients.length,
      revenue:  paid.reduce((sum, i) => sum + (i.total || 0), 0),
      pending:  pending.reduce((sum, i) => sum + (i.total || 0), 0),
    };
  }
}

module.exports = User;
