const { db, nextId } = require('../database/db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const FREE_INVOICE_LIMIT = Infinity;
const FREE_QUOTE_LIMIT = Infinity;

class User {
  static generateOTP() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  static create({ name, email, password, country }) {
    const otp = User.generateOTP();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const user = {
      id: nextId('user'),
      uuid: uuidv4(),
      name,
      email: email.toLowerCase().trim(),
      password: bcrypt.hashSync(password, 12),
      plan: 'pending',
      is_admin: 0,
      email_verified: 0,
      country: country || null,
      verification_token: otp,         // code OTP 6 chiffres
      verification_expires_at: expires, // expire dans 24h
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

  // Vérifie le code OTP → active le plan gratuit
  static verifyEmail(code) {
    const user = db.get('users').find(u => u.verification_token === String(code).trim()).value();
    if (!user) return { error: 'invalid' };
    if (user.email_verified) return { user };
    if (user.verification_expires_at && new Date(user.verification_expires_at) < new Date()) {
      return { error: 'expired' };
    }

    db.get('users').find({ id: user.id }).assign({
      email_verified: 1,
      plan: 'free',
      verification_token: null,
      verification_expires_at: null,
    }).write();

    return { user: db.get('users').find({ id: user.id }).value() };
  }

  // Renvoie un nouveau code OTP (pour le renvoi)
  static refreshOTP(email) {
    const user = db.get('users').find(u => u.email === email.toLowerCase()).value();
    if (!user || user.email_verified) return null;
    const otp = User.generateOTP();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    db.get('users').find({ id: user.id }).assign({
      verification_token: otp,
      verification_expires_at: expires,
      verification_sent_at: new Date().toISOString(),
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

  // Activation immédiate (sans OTP) — utilisé quand SMTP n'est pas disponible
  static activateFree(id) {
    db.get('users').find({ id: Number(id) }).assign({
      email_verified: 1,
      plan: 'free',
      verification_token: null,
      verification_expires_at: null,
    }).write();
    return db.get('users').find({ id: Number(id) }).value();
  }

  // Magic link — lien de connexion unique envoyé par l'admin
  static generateMagicToken(id) {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h
    db.get('users').find({ id: Number(id) }).assign({
      magic_token: token,
      magic_token_expires_at: expires,
    }).write();
    return token;
  }

  static findByMagicToken(token) {
    const user = db.get('users').find(u => u.magic_token === token).value();
    if (!user) return null;
    if (user.magic_token_expires_at && new Date(user.magic_token_expires_at) < new Date()) return null;
    return user;
  }

  static clearMagicToken(id) {
    db.get('users').find({ id: Number(id) }).assign({
      magic_token: null,
      magic_token_expires_at: null,
    }).write();
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
