const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db, nextId } = require('../database/db');
const User = require('../models/User');
const FunnelService = require('../services/FunnelService');

function randomPassword(len = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

class PaddleController {

  // POST /api/paddle/confirm
  // Appelé par skacollection.com après un paiement LFacture réussi
  static async confirm(req, res) {
    const secret = process.env.PADDLE_BRIDGE_SECRET || '';
    const received = req.headers['x-bridge-secret'] || '';

    if (secret && received !== secret) {
      console.warn('[paddle/confirm] Invalid bridge secret');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { email, name, amount, currency, transaction_id, plan_months, plan_label } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Missing email' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const months = Math.max(1, parseInt(plan_months) || 1);
    const subEnd = new Date();
    subEnd.setDate(subEnd.getDate() + months * 30);
    const subEndISO = subEnd.toISOString();

    const existing = db.get('users').find(u => u.email === cleanEmail).value();

    let user;
    let isNew = false;
    let plainPassword = null;

    if (existing) {
      // Prolonger / activer l'abonnement
      db.get('users').find({ id: existing.id }).assign({
        plan: 'active',
        subscription_ends_at: subEndISO,
        email_verified: 1,
      }).write();
      user = { ...existing, plan: 'active', subscription_ends_at: subEndISO };
      console.log(`[paddle/confirm] ✅ Plan activé pour ${cleanEmail} (${months} mois)`);
    } else {
      // Créer un nouveau compte
      plainPassword = randomPassword();
      const newUser = {
        id: nextId('user'),
        uuid: uuidv4(),
        name: name || cleanEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        email: cleanEmail,
        password: bcrypt.hashSync(plainPassword, 12),
        plan: 'active',
        is_admin: 0,
        email_verified: 1,
        subscription_ends_at: subEndISO,
        created_at: new Date().toISOString(),
      };
      db.get('users').push(newUser).write();
      user = newUser;
      isNew = true;
      console.log(`[paddle/confirm] ✅ Nouveau compte créé pour ${cleanEmail}`);
    }

    // Enregistrer le paiement
    db.get('payments').push({
      id: nextId('payment'),
      user_email: cleanEmail,
      user_id: user.id,
      transaction_id: transaction_id || null,
      amount: parseFloat(amount) || 0,
      currency: currency || 'EUR',
      plan_label: plan_label || 'LFacture',
      plan_months: months,
      created_at: new Date().toISOString(),
    }).write();

    // Générer un lien magique (valide 24h pour le client)
    const APP_URL = process.env.APP_URL || 'https://lfacture.com';
    const token = User.generateMagicToken(user.id);
    // Extend magic token to 24h for newly-paid users
    db.get('users').find({ id: user.id }).assign({
      magic_token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }).write();
    const magicLink = `${APP_URL}/auth/magic/${token}`;

    // Envoyer l'email au client
    FunnelService.sendSubscriptionActivated(user, isNew, magicLink, plainPassword).catch(err =>
      console.error('[paddle/confirm] email failed:', err.message)
    );

    // Notification admin
    FunnelService.sendAdminNotification('purchase', { ...user, plan: plan_label || 'active' }).catch(() => {});

    return res.json({ success: true, isNew });
  }
}

module.exports = PaddleController;
