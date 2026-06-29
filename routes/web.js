const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const DashboardController = require('../controllers/DashboardController');
const AdminController = require('../controllers/AdminController');
const { requireAuth, requireAccess, guestOnly } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');

// ---- Public routes ----
router.get('/', (req, res) => res.renderLayout('index', { title: 'LFacture — Créez vos factures et devis en quelques secondes' }));
router.get('/pricing', (req, res) => res.renderLayout('pricing', { title: 'Tarifs — LFacture' }));
router.get('/features', (req, res) => res.renderLayout('features', { title: 'Fonctionnalités — LFacture' }));
router.get('/about', (req, res) => res.renderLayout('about', { title: 'À propos — LFacture' }));

// ---- Auth routes ----
router.get('/register', guestOnly, AuthController.showRegister);
router.post('/register', guestOnly, AuthController.register);
router.get('/login', guestOnly, AuthController.showLogin);
router.post('/login', guestOnly, AuthController.login);
router.post('/logout', requireAuth, AuthController.logout);

// ---- Dashboard routes ----
router.get('/dashboard', requireAuth, (req, res, next) => { res.locals.pageTitle = 'Tableau de bord'; next(); }, DashboardController.index);

// Clients
router.get('/dashboard/clients', requireAccess, DashboardController.listClients);
router.get('/dashboard/clients/create', requireAccess, DashboardController.showCreateClient);
router.post('/dashboard/clients', requireAccess, DashboardController.createClient);
router.get('/dashboard/clients/:id/edit', requireAccess, DashboardController.showEditClient);
router.put('/dashboard/clients/:id', requireAccess, DashboardController.updateClient);
router.delete('/dashboard/clients/:id', requireAccess, DashboardController.deleteClient);

// Invoices
router.get('/dashboard/invoices', requireAccess, DashboardController.listInvoices);
router.get('/dashboard/quotes', requireAccess, DashboardController.listQuotes);
router.get('/dashboard/invoices/create', requireAccess, DashboardController.showCreateInvoice);
router.post('/dashboard/invoices', requireAccess, DashboardController.createInvoice);
router.get('/dashboard/invoices/:id', requireAccess, DashboardController.showInvoice);
router.post('/dashboard/invoices/:id/status', requireAccess, DashboardController.updateInvoiceStatus);
router.delete('/dashboard/invoices/:id', requireAccess, DashboardController.deleteInvoice);

// Settings
router.get('/dashboard/settings', requireAuth, DashboardController.showSettings);
router.post('/dashboard/settings', requireAuth, DashboardController.updateSettings);

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
router.get('/admin/invoices', requireAdmin, AdminController.listInvoices);

module.exports = router;
