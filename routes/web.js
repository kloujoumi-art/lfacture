const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const DashboardController = require('../controllers/DashboardController');
const AdminController = require('../controllers/AdminController');
const PaddleController = require('../controllers/PaddleController');
const BlogAdminController = require('../controllers/BlogAdminController');
const WordController = require('../controllers/WordController');
const AdminAnalyticsController = require('../controllers/AdminAnalyticsController');
const BlogController = require('../controllers/BlogController');
const { requireAuth, requireAccess, requireInvoiceQuota, requireQuoteQuota, guestOnly } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const upload = require('../middleware/upload');

// ---- Public routes ----
router.get('/', (req, res) => res.renderLayout('index', {
  title: 'Logiciel de facturation gratuit en ligne — LFacture',
  metaDesc: 'LFacture : logiciel de facturation gratuit en ligne pour créer vos factures et devis professionnels en quelques secondes. 8 factures + 8 devis offerts sans carte bancaire.',
  canonicalPath: '/',
}));
router.get('/pricing', (req, res) => res.renderLayout('pricing', {
  title: 'Tarifs logiciel de facturation — LFacture',
  metaDesc: 'Découvrez les tarifs de LFacture, logiciel de facturation en ligne. Plan gratuit avec 8 factures + 8 devis, puis à partir de 5€/mois pour une facturation illimitée.',
  canonicalPath: '/pricing',
}));
router.get('/features', (req, res) => res.renderLayout('features', {
  title: 'Fonctionnalités logiciel facture — LFacture',
  metaDesc: 'LFacture : toutes les fonctionnalités pour votre logiciel de facturation. Factures PDF, devis, clients, tableaux de bord, modèles personnalisables.',
  canonicalPath: '/features',
}));
router.get('/about', (req, res) => res.renderLayout('about', {
  title: 'À propos — LFacture logiciel facturation',
  metaDesc: 'LFacture, le logiciel de facturation français pensé pour les indépendants et PME. Simple, rapide, sans installation.',
  canonicalPath: '/about',
}));
router.get('/contact', (req, res) => res.renderLayout('contact', {
  title: 'Contactez-nous — LFacture',
  metaDesc: 'Contactez l\'équipe LFacture pour toute question, bug ou suggestion. Réponse sous 24h.',
  canonicalPath: '/contact',
  query: req.query,
}));
router.post('/contact', AdminController.submitContact);

// ---- Pages légales ----
router.get('/mentions-legales', (req, res) => res.renderLayout('legal/mentions-legales', {
  title: 'Mentions légales — LFacture',
  metaDesc: 'Mentions légales du logiciel de facturation LFacture.',
}));
router.get('/politique-confidentialite', (req, res) => res.renderLayout('legal/confidentialite', {
  title: 'Politique de confidentialité — LFacture',
  metaDesc: 'Politique de confidentialité et RGPD de LFacture, logiciel de facturation gratuit.',
}));
router.get('/cgu', (req, res) => res.renderLayout('legal/cgu', {
  title: 'Conditions Générales d\'Utilisation — LFacture',
  metaDesc: 'CGU de LFacture — Conditions Générales d\'Utilisation du logiciel de facturation en ligne.',
}));

// ---- Paddle webhook (appelé par skacollection.com) ----
router.post('/api/paddle/confirm', express.json(), PaddleController.confirm);

// ---- Sitemap ----
router.get('/sitemap.xml', require('../controllers/SitemapController'));

// ---- Robots.txt ----
router.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send('User-agent: *\nAllow: /\nDisallow: /dashboard\nDisallow: /admin\nSitemap: https://lfacture.com/sitemap.xml');
});

// ---- Blog public ----
router.get('/blog', BlogController.index);
router.get('/blog/:slug', BlogController.show);

// ---- Auth routes ----
router.get('/register', guestOnly, AuthController.showRegister);
router.post('/register', guestOnly, AuthController.register);
router.get('/login', guestOnly, AuthController.showLogin);
router.post('/login', guestOnly, AuthController.login);
router.post('/logout', requireAuth, AuthController.logout);

// ---- Email verification (code OTP) ----
router.get('/verify-email', AuthController.showVerifyEmail);
router.post('/verify-email', AuthController.verifyEmail);
router.post('/verify-email/resend', AuthController.resendCode);

// ---- Magic login link (envoyé par admin) ----
router.get('/auth/magic/:token', AuthController.loginWithMagicToken);

// ---- Dashboard routes ----
router.get('/dashboard', requireAuth, (req, res, next) => { res.locals.pageTitle = 'Tableau de bord'; next(); }, DashboardController.index);

// Clients
router.get('/dashboard/clients', requireAccess, DashboardController.listClients);
router.get('/dashboard/clients/create', requireAccess, DashboardController.showCreateClient);
router.post('/dashboard/clients', requireAccess, upload.single('client_logo_file'), DashboardController.createClient);
router.get('/dashboard/clients/:id/edit', requireAccess, DashboardController.showEditClient);
router.put('/dashboard/clients/:id', requireAccess, upload.single('client_logo_file'), DashboardController.updateClient);
router.delete('/dashboard/clients/:id', requireAccess, DashboardController.deleteClient);

// Invoices
router.get('/dashboard/invoices', requireAccess, DashboardController.listInvoices);
router.get('/dashboard/quotes', requireAccess, DashboardController.listQuotes);
router.get('/dashboard/invoices/create', requireAccess, DashboardController.showCreateInvoice);
router.post('/dashboard/invoices', requireAccess, DashboardController.createInvoice);  // quota check inside controller
router.get('/dashboard/invoices/:id', requireAccess, DashboardController.showInvoice);
router.post('/dashboard/invoices/:id/status', requireAccess, DashboardController.updateInvoiceStatus);
router.post('/dashboard/invoices/:id/template', requireAccess, DashboardController.updateTemplate);
router.get('/dashboard/invoices/:id/print', requireAccess, DashboardController.printInvoice);
router.get('/dashboard/invoices/:id/word', requireAccess, WordController.download);
router.delete('/dashboard/invoices/:id', requireAccess, DashboardController.deleteInvoice);

// Settings
router.get('/dashboard/settings', requireAuth, DashboardController.showSettings);
router.post('/dashboard/settings', requireAuth, upload.single('company_logo_file'), DashboardController.updateSettings);

// ---- Lien de connexion secret admin (URL unique via env ADMIN_SECRET_TOKEN) ----
router.get('/admin/access/:token', (req, res) => {
  const secret = process.env.ADMIN_SECRET_TOKEN;
  if (!secret || req.params.token !== secret) {
    return res.status(404).renderLayout('errors/404', { title: 'Page introuvable — LFacture' });
  }
  const { db } = require('../database/db');
  const admin = db.get('users').find({ is_admin: 1 }).value();
  if (!admin) {
    return res.redirect('/admin/setup');
  }
  req.session.userId = admin.id;
  res.redirect('/admin');
});

// ---- Admin setup (sans auth — seulement si 0 admin existe) ----
router.get('/admin/setup', AdminController.showSetup);
router.post('/admin/setup', AdminController.createSetup);

// ---- Admin routes ----
router.get('/admin', requireAdmin, AdminController.index);
router.get('/admin/users', requireAdmin, AdminController.listUsers);
router.get('/admin/users/:id', requireAdmin, AdminController.showUser);
router.post('/admin/users/:id/plan', requireAdmin, AdminController.updateUserPlan);
router.post('/admin/users/:id/extend', requireAdmin, AdminController.extendTrial);
router.post('/admin/users/:id/toggle-admin', requireAdmin, AdminController.toggleAdmin);
router.post('/admin/users/:id/delete', requireAdmin, AdminController.deleteUser);
router.post('/admin/users/:id/magic-link', requireAdmin, AdminController.sendMagicLink);
router.get('/admin/invoices', requireAdmin, AdminController.listInvoices);
router.get('/admin/trial', requireAdmin, AdminController.listTrialUsers);
router.get('/admin/mailing', requireAdmin, AdminController.listMailing);
router.get('/admin/payments', requireAdmin, AdminController.listPayments);
router.post('/admin/payments/manual', requireAdmin, AdminController.manualPayment);

// ---- Admin analytics ----
router.get('/admin/analytics', requireAdmin, AdminAnalyticsController.index);

// ---- Admin blog ----
router.get('/admin/blog', requireAdmin, BlogAdminController.index);
router.get('/admin/blog/create', requireAdmin, BlogAdminController.showCreate);
router.post('/admin/blog', requireAdmin, BlogAdminController.create);
router.get('/admin/blog/:id/edit', requireAdmin, BlogAdminController.showEdit);
router.post('/admin/blog/:id', requireAdmin, BlogAdminController.update);
router.post('/admin/blog/:id/toggle', requireAdmin, BlogAdminController.togglePublish);
router.post('/admin/blog/:id/delete', requireAdmin, BlogAdminController.delete);

// ---- Admin support ----
router.get('/admin/support', requireAdmin, AdminController.listSupport);
router.post('/admin/support/:id/delete', requireAdmin, AdminController.deleteSupport);

// ---- Admin blog campaigns (JSON API) ----
router.get('/api/admin/campaigns', requireAdmin, BlogAdminController.getCampaigns);
router.post('/api/admin/campaigns', requireAdmin, express.json(), BlogAdminController.createCampaign);
router.post('/api/admin/campaigns/:id/toggle', requireAdmin, BlogAdminController.toggleCampaign);
router.post('/api/admin/campaigns/:id/run', requireAdmin, BlogAdminController.runCampaignNow);
router.post('/api/admin/campaigns/:id/update', requireAdmin, express.json(), BlogAdminController.updateCampaign);
router.post('/api/admin/campaigns/:id/delete', requireAdmin, BlogAdminController.deleteCampaign);

module.exports = router;
