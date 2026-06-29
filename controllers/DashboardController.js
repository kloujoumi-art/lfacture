const User = require('../models/User');
const Invoice = require('../models/Invoice');
const Client = require('../models/Client');
const { db, nextId } = require('../database/db');

const dash = (res, view, data = {}) => res.renderLayout(view, data, 'dashboard');

function getSettings(userId) {
  return db.get('settings').find({ user_id: Number(userId) }).value() || null;
}

function ensureSettings(userId) {
  const existing = getSettings(userId);
  if (!existing) {
    const s = {
      id: nextId('settings'),
      user_id: Number(userId),
      invoice_prefix: 'FAC',
      quote_prefix: 'DEV',
      invoice_counter: 1,
      quote_counter: 1,
      default_tva: 20,
      payment_terms: 'Paiement à 30 jours',
    };
    db.get('settings').push(s).write();
    return s;
  }
  return existing;
}

class DashboardController {
  static index(req, res) {
    const stats = User.getStats(req.user.id);
    const recentInvoices = Invoice.getRecentByUser(req.user.id, 5);
    const settings = getSettings(req.user.id);
    dash(res, 'dashboard/index', { pageTitle: 'Tableau de bord', activePage: 'dashboard', stats, recentInvoices, settings });
  }

  // ---- Clients ----
  static listClients(req, res) {
    const clients = Client.findByUser(req.user.id);
    dash(res, 'dashboard/clients/index', { pageTitle: 'Clients', activePage: 'clients', ctaLink: '/dashboard/clients/create', ctaLabel: '+ Nouveau client', clients });
  }

  static showCreateClient(req, res) {
    dash(res, 'dashboard/clients/create', { pageTitle: 'Nouveau client', activePage: 'clients', errors: [], old: {} });
  }

  static createClient(req, res) {
    const { name } = req.body;
    if (!name || name.trim().length < 1) {
      return dash(res, 'dashboard/clients/create', { pageTitle: 'Nouveau client', activePage: 'clients', errors: ['Le nom est requis.'], old: req.body });
    }
    Client.create({ user_id: req.user.id, ...req.body });
    req.flash('success', 'Client créé avec succès.');
    res.redirect('/dashboard/clients');
  }

  static showEditClient(req, res) {
    const client = Client.findById(req.params.id);
    if (!client || client.user_id !== req.user.id) return res.redirect('/dashboard/clients');
    dash(res, 'dashboard/clients/edit', { pageTitle: 'Modifier le client', activePage: 'clients', client, errors: [] });
  }

  static updateClient(req, res) {
    const client = Client.findById(req.params.id);
    if (!client || client.user_id !== req.user.id) return res.redirect('/dashboard/clients');
    Client.update(req.params.id, req.body);
    req.flash('success', 'Client mis à jour.');
    res.redirect('/dashboard/clients');
  }

  static deleteClient(req, res) {
    const client = Client.findById(req.params.id);
    if (!client || client.user_id !== req.user.id) return res.redirect('/dashboard/clients');
    Client.delete(req.params.id);
    req.flash('success', 'Client supprimé.');
    res.redirect('/dashboard/clients');
  }

  // ---- Invoices & Quotes ----
  static listInvoices(req, res) {
    const invoices = Invoice.findByUser(req.user.id, 'invoice');
    dash(res, 'dashboard/invoices/index', { pageTitle: 'Factures', activePage: 'invoices', ctaLink: '/dashboard/invoices/create?type=invoice', ctaLabel: '+ Nouvelle facture', invoices, type: 'invoice' });
  }

  static listQuotes(req, res) {
    const quotes = Invoice.findByUser(req.user.id, 'quote');
    dash(res, 'dashboard/invoices/index', { pageTitle: 'Devis', activePage: 'quotes', ctaLink: '/dashboard/invoices/create?type=quote', ctaLabel: '+ Nouveau devis', invoices: quotes, type: 'quote' });
  }

  static showCreateInvoice(req, res) {
    const type = req.query.type || 'invoice';
    const clients = Client.findByUser(req.user.id);
    const settings = ensureSettings(req.user.id);
    const label = type === 'invoice' ? 'Nouvelle facture' : 'Nouveau devis';
    dash(res, 'dashboard/invoices/create', { pageTitle: label, activePage: type === 'invoice' ? 'invoices' : 'quotes', type, clients, settings });
  }

  static createInvoice(req, res) {
    const { client_id, type, issue_date, due_date, notes, payment_terms, template } = req.body;

    // Vérification quota plan gratuit
    if (User.isFree(req.user)) {
      const quota = User.getQuota(req.user.id);
      const docType = type || 'invoice';
      if (docType === 'invoice' && quota.invoices.reached) {
        req.flash('error', `Limite atteinte : ${quota.invoices.max} factures maximum sur le plan gratuit. Abonnez-vous pour continuer.`);
        return res.redirect('/pricing');
      }
      if (docType === 'quote' && quota.quotes.reached) {
        req.flash('error', `Limite atteinte : ${quota.quotes.max} devis maximum sur le plan gratuit. Abonnez-vous pour continuer.`);
        return res.redirect('/pricing');
      }
    }
    let { items_desc, items_qty, items_price, items_tva } = req.body;

    const items = [];
    if (items_desc) {
      const descs = Array.isArray(items_desc) ? items_desc : [items_desc];
      const qtys = Array.isArray(items_qty) ? items_qty : [items_qty];
      const prices = Array.isArray(items_price) ? items_price : [items_price];
      const tvas = Array.isArray(items_tva) ? items_tva : [items_tva];
      descs.forEach((desc, i) => {
        if (desc && desc.trim()) {
          items.push({
            description: desc.trim(),
            quantity: parseFloat(qtys[i]) || 1,
            unit_price: parseFloat(prices[i]) || 0,
            tva_rate: parseFloat(tvas[i]) || 20,
          });
        }
      });
    }

    Invoice.create({ user_id: req.user.id, client_id, type: type || 'invoice', issue_date, due_date, notes, payment_terms, template, items });
    req.flash('success', type === 'invoice' ? 'Facture créée avec succès.' : 'Devis créé avec succès.');
    res.redirect(type === 'invoice' ? '/dashboard/invoices' : '/dashboard/quotes');
  }

  static showInvoice(req, res) {
    const invoice = Invoice.findById(req.params.id);
    if (!invoice || invoice.user_id !== req.user.id) return res.redirect('/dashboard/invoices');
    const settings = getSettings(req.user.id);
    const label = invoice.type === 'invoice' ? 'Facture' : 'Devis';
    dash(res, 'dashboard/invoices/show', { pageTitle: `${label} ${invoice.invoice_number}`, activePage: invoice.type === 'invoice' ? 'invoices' : 'quotes', invoice, settings });
  }

  static printInvoice(req, res) {
    const invoice = Invoice.findById(req.params.id);
    if (!invoice || invoice.user_id !== req.user.id) return res.status(404).send('Document introuvable.');
    const settings = getSettings(req.user.id);
    res.render('dashboard/invoices/print', { invoice, settings });
  }

  static updateTemplate(req, res) {
    const invoice = Invoice.findById(req.params.id);
    if (!invoice || invoice.user_id !== req.user.id) return res.redirect('/dashboard/invoices');
    const { db } = require('../database/db');
    const allowed = ['classic','modern','minimal','blue','green','orange','red','navy','slate','creative'];
    const tpl = allowed.includes(req.body.template) ? req.body.template : 'classic';
    db.get('invoices').find({ id: invoice.id }).assign({ template: tpl }).write();
    res.redirect(`/dashboard/invoices/${invoice.id}`);
  }

  static updateInvoiceStatus(req, res) {
    const invoice = Invoice.findById(req.params.id);
    if (!invoice || invoice.user_id !== req.user.id) return res.redirect('/dashboard/invoices');
    Invoice.updateStatus(req.params.id, req.body.status);
    req.flash('success', 'Statut mis à jour.');
    res.redirect(`/dashboard/invoices/${req.params.id}`);
  }

  static deleteInvoice(req, res) {
    const invoice = Invoice.findById(req.params.id);
    if (!invoice || invoice.user_id !== req.user.id) return res.redirect('/dashboard/invoices');
    const redirectTo = invoice.type === 'invoice' ? '/dashboard/invoices' : '/dashboard/quotes';
    Invoice.delete(req.params.id);
    req.flash('success', 'Document supprimé.');
    res.redirect(redirectTo);
  }

  // ---- Settings ----
  static showSettings(req, res) {
    const settings = ensureSettings(req.user.id);
    dash(res, 'dashboard/settings', { pageTitle: 'Paramètres', activePage: 'settings', settings });
  }

  static updateSettings(req, res) {
    const s = req.body;
    const existing = getSettings(req.user.id);

    // Logo upload: convert to base64 if a file was uploaded
    let logoData = undefined;
    if (req.file) {
      const mime = req.file.mimetype;
      const b64 = req.file.buffer.toString('base64');
      logoData = `data:${mime};base64,${b64}`;
    } else if (s.remove_logo === '1') {
      logoData = null;
    }

    const patch = {
      company_name: s.company_name || null,
      company_address: s.company_address || null,
      company_city: s.company_city || null,
      company_postal: s.company_postal || null,
      company_country: s.company_country || 'France',
      company_phone: s.company_phone || null,
      company_email: s.company_email || null,
      company_siret: s.company_siret || null,
      company_tva: s.company_tva || null,
      invoice_prefix: s.invoice_prefix || 'FAC',
      quote_prefix: s.quote_prefix || 'DEV',
      default_tva: parseFloat(s.default_tva) || 20,
      payment_terms: s.payment_terms || null,
      invoice_template: s.invoice_template || 'classic',
      bank_name: s.bank_name || null,
      bank_iban: s.bank_iban || null,
      bank_bic: s.bank_bic || null,
    };
    if (logoData !== undefined) patch.company_logo = logoData;

    if (existing) {
      db.get('settings').find({ user_id: req.user.id }).assign(patch).write();
    } else {
      ensureSettings(req.user.id);
    }
    req.flash('success', 'Paramètres sauvegardés.');
    res.redirect('/dashboard/settings');
  }
}

module.exports = DashboardController;
