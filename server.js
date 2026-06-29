require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Method override (PUT, DELETE from forms)
app.use(methodOverride('_method'));

// Render (et autres proxies) envoient les requêtes via HTTPS → trust proxy
app.set('trust proxy', 1);

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'lfacture_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

// Flash messages
app.use(flash());

// Global locals
const { renderWithLayout } = require('./helpers/render');
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.appName = 'LFacture';
  res.locals.appUrl = process.env.APP_URL || 'http://localhost:3000';
  res.locals.user = null;
  res.locals.isOnTrial = false;
  res.locals.trialDaysLeft = 0;
  res.locals.hasAccess = false;
  // Attach layout renderer
  res.renderLayout = (view, data = {}, layout = 'main') => renderWithLayout(res, view, data, layout);
  next();
});

// Analytics middleware (tracking visiteurs)
const analyticsMiddleware = require('./middleware/analytics');
app.use(analyticsMiddleware);

// Routes
const webRoutes = require('./routes/web');
app.use('/', webRoutes);

// 404
app.use((req, res) => {
  res.status(404).renderLayout('errors/404', { title: 'Page introuvable — LFacture' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).renderLayout('errors/500', { title: 'Erreur — LFacture' });
});

app.listen(PORT, () => {
  console.log(`\n✅ LFacture est en ligne sur http://localhost:${PORT}\n`);

  // Auto-setup admin via variables d'environnement
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const { db, nextId } = require('./database/db');
    const bcrypt = require('bcryptjs');
    const { v4: uuidv4 } = require('uuid');
    const adminEmail = process.env.ADMIN_EMAIL.toLowerCase().trim();
    const existing = db.get('users').find(u => u.email === adminEmail).value();
    const hashedPass = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 12);
    const farFuture = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString();
    if (existing) {
      db.get('users').find({ id: existing.id }).assign({ is_admin: 1, password: hashedPass, plan: 'active', email_verified: 1, subscription_ends_at: farFuture }).write();
      console.log(`[Admin] Compte admin mis à jour : ${adminEmail}`);
    } else {
      db.get('users').push({ id: nextId('user'), uuid: uuidv4(), name: 'Admin', email: adminEmail, password: hashedPass, plan: 'active', is_admin: 1, email_verified: 1, subscription_ends_at: farFuture, created_at: new Date().toISOString() }).write();
      console.log(`[Admin] Compte admin créé : ${adminEmail}`);
    }
  }

  // Démarre le scheduler funnel (emails automatiques)
  const { startFunnelScheduler } = require('./services/FunnelService');
  startFunnelScheduler();

  // Démarre le scheduler campagnes blog (génération articles IA)
  const { startCampaignScheduler } = require('./services/BlogCampaignService');
  startCampaignScheduler();
  // Auto-seed blog articles SEO si la collection est vide
  const Post = require('./models/Post');
  if (Post.all().length === 0) {
    try { require('./scripts/seed-blog'); } catch(e) { console.error('Blog seed error:', e.message); }
  }
});

module.exports = app;
