const User = require('../models/User');
const Invoice = require('../models/Invoice');
const { db, nextId } = require('../database/db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const FunnelService = require('../services/FunnelService');

const adm = (res, view, data = {}) => res.renderLayout(view, data, 'admin');

// Clé secrète de setup (changeable dans .env)
const SETUP_KEY = process.env.ADMIN_SETUP_KEY || 'lfacture-setup-2024';

class AdminController {

  // ---- Setup (création premier admin) ----
  static showSetup(req, res) {
    const admins = db.get('users').filter({ is_admin: 1 }).value();
    if (admins.length > 0) {
      return res.redirect('/login');
    }
    res.render('admin/setup', { setupKey: SETUP_KEY, error: null });
  }

  static createSetup(req, res) {
    const admins = db.get('users').filter({ is_admin: 1 }).value();
    if (admins.length > 0) {
      return res.redirect('/login');
    }

    const { name, email, password, setup_key } = req.body;

    if (setup_key !== SETUP_KEY) {
      return res.render('admin/setup', { setupKey: SETUP_KEY, error: 'Clé de setup invalide.' });
    }
    if (!name || !email || !password || password.length < 8) {
      return res.render('admin/setup', { setupKey: SETUP_KEY, error: 'Tous les champs sont requis (mot de passe min. 8 caractères).' });
    }

    // Vérifier si email existe déjà
    const existing = User.findByEmail(email);
    if (existing) {
      // Promouvoir en admin
      db.get('users').find({ id: existing.id }).assign({ is_admin: 1 }).write();
      req.session.userId = existing.id;
      return res.redirect('/admin');
    }

    // Créer le compte admin
    const trialEnd = new Date();
    trialEnd.setFullYear(trialEnd.getFullYear() + 10);
    const newAdmin = {
      id: nextId('user'),
      uuid: uuidv4(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: bcrypt.hashSync(password, 12),
      plan: 'active',
      is_admin: 1,
      trial_ends_at: trialEnd.toISOString(),
      subscription_ends_at: trialEnd.toISOString(),
      created_at: new Date().toISOString(),
    };
    db.get('users').push(newAdmin).write();

    // Initialiser les settings
    db.get('settings').push({
      id: nextId('settings'),
      user_id: newAdmin.id,
      invoice_prefix: 'FAC',
      quote_prefix: 'DEV',
      invoice_counter: 1,
      quote_counter: 1,
      default_tva: 20,
      payment_terms: 'Paiement à 30 jours',
    }).write();

    req.session.userId = newAdmin.id;
    res.redirect('/admin');
  }

  // ---- Dashboard ----
  static index(req, res) {
    const stats = User.globalStats();
    const recentUsers = User.all().slice(0, 10);
    adm(res, 'admin/index', {
      title: 'Admin — LFacture',
      pageTitle: 'Tableau de bord Admin',
      activePage: 'dashboard',
      stats,
      recentUsers,
    });
  }

  // ---- Users ----
  static listUsers(req, res) {
    const search = (req.query.q || '').toLowerCase().trim();
    const filter = req.query.filter || 'all';
    const now = new Date();

    let users = User.all();

    if (search) {
      users = users.filter(u =>
        u.name.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search)
      );
    }

    if (filter === 'trial') {
      users = users.filter(u => u.plan === 'trial' && new Date(u.trial_ends_at) > now);
    } else if (filter === 'active') {
      users = users.filter(u => u.plan === 'active' && u.subscription_ends_at && new Date(u.subscription_ends_at) > now);
    } else if (filter === 'expired') {
      users = users.filter(u => {
        if (u.plan === 'trial') return new Date(u.trial_ends_at) <= now;
        return !u.subscription_ends_at || new Date(u.subscription_ends_at) <= now;
      });
    } else if (filter === 'admin') {
      users = users.filter(u => u.is_admin);
    }

    adm(res, 'admin/users', {
      title: 'Utilisateurs — Admin',
      pageTitle: 'Utilisateurs',
      activePage: 'users',
      users,
      search,
      filter,
      stats: User.globalStats(),
    });
  }

  static showUser(req, res) {
    const user = User.findById(req.params.id);
    if (!user) return res.redirect('/admin/users');
    const stats = User.getStats(user.id);
    const invoices = Invoice.findByUser(user.id).slice(0, 10);
    adm(res, 'admin/user-detail', {
      title: `${user.name} — Admin`,
      pageTitle: `Utilisateur : ${user.name}`,
      activePage: 'users',
      targetUser: user,
      stats,
      invoices,
    });
  }

  static updateUserPlan(req, res) {
    const { plan, days } = req.body;
    const user = User.findById(req.params.id);
    if (!user) return res.redirect('/admin/users');

    if (plan === 'trial') {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + (parseInt(days) || 7));
      db.get('users').find({ id: user.id }).assign({
        plan: 'trial',
        trial_ends_at: trialEnd.toISOString(),
        subscription_ends_at: null,
      }).write();
    } else if (plan === 'active') {
      const subEnd = new Date();
      subEnd.setDate(subEnd.getDate() + (parseInt(days) || 30));
      db.get('users').find({ id: user.id }).assign({
        plan: 'active',
        subscription_ends_at: subEnd.toISOString(),
      }).write();
      FunnelService.sendAdminNotification('purchase', { ...user, plan: 'active' }).catch(() => {});
    } else if (plan === 'suspended') {
      db.get('users').find({ id: user.id }).assign({
        plan: 'suspended',
        subscription_ends_at: null,
      }).write();
    }

    req.flash('success', `Plan de ${user.name} mis à jour : ${plan}.`);
    res.redirect(`/admin/users/${req.params.id}`);
  }

  static toggleAdmin(req, res) {
    const user = User.findById(req.params.id);
    if (!user) return res.redirect('/admin/users');
    if (user.id === req.user.id) {
      req.flash('error', 'Vous ne pouvez pas modifier vos propres droits admin.');
      return res.redirect(`/admin/users/${req.params.id}`);
    }
    db.get('users').find({ id: user.id }).assign({ is_admin: user.is_admin ? 0 : 1 }).write();
    req.flash('success', user.is_admin ? `${user.name} n'est plus administrateur.` : `${user.name} est maintenant administrateur.`);
    res.redirect(`/admin/users/${req.params.id}`);
  }

  static async sendMagicLink(req, res) {
    const user = User.findById(req.params.id);
    if (!user) {
      req.flash('error', 'Utilisateur introuvable.');
      return res.redirect('/admin/users');
    }
    const token = User.generateMagicToken(user.id);
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const magicLink = `${appUrl}/auth/magic/${token}`;
    try {
      await FunnelService.sendMagicLoginEmail(user, magicLink);
      req.flash('success', `Lien de connexion envoyé à ${user.email}.`);
    } catch (e) {
      console.error('[Admin] Magic link email error:', e.message);
      req.flash('error', `Erreur envoi email. Lien manuel : ${magicLink}`);
    }
    res.redirect(`/admin/users/${req.params.id}`);
  }

  static deleteUser(req, res) {
    const user = User.findById(req.params.id);
    if (!user) return res.redirect('/admin/users');
    if (user.id === req.user.id) {
      req.flash('error', 'Vous ne pouvez pas supprimer votre propre compte.');
      return res.redirect('/admin/users');
    }
    User.delete(user.id);
    req.flash('success', `Utilisateur ${user.name} supprimé.`);
    res.redirect('/admin/users');
  }

  static extendTrial(req, res) {
    const user = User.findById(req.params.id);
    if (!user) return res.redirect('/admin/users');
    const days = parseInt(req.body.days) || 7;
    const base = user.trial_ends_at && new Date(user.trial_ends_at) > new Date()
      ? new Date(user.trial_ends_at)
      : new Date();
    base.setDate(base.getDate() + days);
    db.get('users').find({ id: user.id }).assign({
      plan: 'trial',
      trial_ends_at: base.toISOString(),
    }).write();
    req.flash('success', `Essai de ${user.name} prolongé de ${days} jours.`);
    res.redirect(`/admin/users/${req.params.id}`);
  }

  // ---- Plan Gratuit (anciennement "Essai 7j") ----
  static listTrialUsers(req, res) {
    const freeUsers = User.getFreeUsers().map(u => {
      const quota = User.getQuota(u.id);
      const funnelLogs = db.get('funnel_logs').filter({ user_id: u.id }).value();
      const invProgress = Math.round((quota.invoices.used / quota.invoices.max) * 100);
      const quotProgress = Math.round((quota.quotes.used / quota.quotes.max) * 100);
      return { ...u, quota, funnelLogs, invProgress, quotProgress };
    });

    const pendingUsers = db.get('users').filter(u => u.plan === 'pending').value();

    adm(res, 'admin/trial-users', {
      title: 'Plan Gratuit — Admin',
      pageTitle: 'Utilisateurs plan gratuit',
      activePage: 'trial',
      freeUsers,
      pendingUsers,
      stats: User.globalStats(),
    });
  }

  // ---- Mailing ----
  static listMailing(req, res) {
    const contacts = db.get('contacts')
      .value()
      .sort((a, b) => new Date(b.subscribed_at) - new Date(a.subscribed_at));

    const funnelLogs = db.get('funnel_logs')
      .value()
      .sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at))
      .slice(0, 100)
      .map(log => {
        const user = User.findById(log.user_id);
        return { ...log, user_name: user?.name || '—', user_email: user?.email || '—' };
      });

    const emailTypes = ['verification', 'welcome', 'trial_ending', 'trial_expired', 'followup', 'discount'];
    const emailStats = {};
    emailTypes.forEach(type => {
      emailStats[type] = db.get('funnel_logs').filter({ type }).value().length;
    });

    adm(res, 'admin/mailing', {
      title: 'Mailing — Admin',
      pageTitle: 'Mailing & Contacts',
      activePage: 'mailing',
      contacts,
      funnelLogs,
      emailStats,
      totalEmails: db.get('funnel_logs').value().length,
    });
  }

  // ---- Payments (Paddle) ----
  static listPayments(req, res) {
    const payments = (db.get('payments').value() || [])
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const total = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    adm(res, 'admin/payments', {
      title: 'Paiements — Admin',
      pageTitle: 'Paiements Paddle',
      activePage: 'payments',
      payments,
      total,
    });
  }

  // ---- Invoices overview ----
  static listInvoices(req, res) {
    const all = db.get('invoices').value();
    const invoices = [...all]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 100)
      .map(inv => {
        const user = User.findById(inv.user_id);
        const client = inv.client_id ? db.get('clients').find({ id: inv.client_id }).value() : null;
        return { ...inv, user_name: user?.name || '—', client_name: client?.name || '—' };
      });

    adm(res, 'admin/invoices', {
      title: 'Factures — Admin',
      pageTitle: 'Toutes les factures',
      activePage: 'invoices',
      invoices,
      totalInvoices: all.filter(i => i.type === 'invoice').length,
      totalQuotes: all.filter(i => i.type === 'quote').length,
    });
  }

  // ── Support / Contact ──────────────────────────────────────────
  static submitContact(req, res) {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.redirect('/contact?error=1');
    }
    const { db, nextId } = require('../database/db');
    const id = nextId('support_message');
    db.get('support_messages').push({
      id, name: name.trim(), email: email.trim().toLowerCase(),
      subject: subject || 'autre', message: message.trim(),
      created_at: new Date().toISOString(), read_at: null,
    }).write();

    // Notif admin par email (non-bloquant)
    try {
      const EmailService = require('../services/EmailService');
      EmailService.sendEmail({
        to: process.env.ADMIN_EMAIL || 'khalidlouj520@gmail.com',
        subject: `[LFacture Contact] ${subject || 'Nouveau message'} — ${name}`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#4F46E5;">Nouveau message de contact</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:6px 0;color:#64748b;width:100px;">De</td><td style="padding:6px 0;font-weight:700;">${name} &lt;${email}&gt;</td></tr>
            <tr><td style="padding:6px 0;color:#64748b;">Sujet</td><td style="padding:6px 0;">${subject || 'non précisé'}</td></tr>
          </table>
          <div style="margin-top:16px;padding:16px;background:#f8fafc;border-left:4px solid #4F46E5;border-radius:0 8px 8px 0;">
            <p style="margin:0;color:#374151;line-height:1.6;">${message.replace(/\n/g,'<br>')}</p>
          </div>
          <p style="margin-top:16px;"><a href="mailto:${email}?subject=Re: ${subject}" style="background:#4F46E5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;">Répondre →</a></p>
          <p style="color:#94a3b8;font-size:12px;margin-top:20px;">Voir tous les messages : <a href="https://lfacture.com/admin/support">admin/support</a></p>
        </div>`,
      }).catch(() => {});
    } catch {}

    res.redirect('/contact?sent=1');
  }

  static listSupport(req, res) {
    const { db } = require('../database/db');
    const messages = (db.get('support_messages').value() || [])
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    adm(res, 'admin/support', {
      title: 'Support — Admin',
      pageTitle: 'Messages de support',
      activePage: 'support',
      messages,
    });
  }

  static deleteSupport(req, res) {
    const { db } = require('../database/db');
    const id = parseInt(req.params.id);
    db.get('support_messages').remove({ id }).write();
    res.redirect('/admin/support');
  }
}

module.exports = AdminController;
