const User = require('../models/User');
const Invoice = require('../models/Invoice');
const { db } = require('../database/db');

const adm = (res, view, data = {}) => res.renderLayout(view, data, 'admin');

class AdminController {

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
}

module.exports = AdminController;
