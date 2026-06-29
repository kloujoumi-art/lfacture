const User = require('../models/User');

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    req.flash('error', 'Veuillez vous connecter pour accéder à cette page.');
    return res.redirect('/login');
  }
  const user = User.findById(req.session.userId);
  if (!user) {
    req.session.destroy();
    return res.redirect('/login');
  }
  req.user = user;
  res.locals.user = user;
  res.locals.isFree = User.isFree(user);
  res.locals.hasAccess = User.hasActiveSubscription(user);
  // Quota pour affichage dans les vues
  if (User.isFree(user)) {
    res.locals.quota = User.getQuota(user.id);
  } else {
    res.locals.quota = null;
  }
  next();
}

function requireAccess(req, res, next) {
  requireAuth(req, res, () => {
    if (!User.hasActiveSubscription(req.user)) {
      req.flash('error', 'Veuillez choisir un abonnement pour accéder à cette fonctionnalité.');
      return res.redirect('/pricing');
    }
    next();
  });
}

// Vérifie le quota de factures pour le plan gratuit
function requireInvoiceQuota(req, res, next) {
  requireAccess(req, res, () => {
    if (User.isFree(req.user)) {
      const quota = User.getQuota(req.user.id);
      if (quota.invoices.reached) {
        req.flash('error', `Limite atteinte : le plan gratuit permet ${quota.invoices.max} factures. Passez à un abonnement payant pour continuer.`);
        return res.redirect('/pricing');
      }
    }
    next();
  });
}

// Vérifie le quota de devis pour le plan gratuit
function requireQuoteQuota(req, res, next) {
  requireAccess(req, res, () => {
    if (User.isFree(req.user)) {
      const quota = User.getQuota(req.user.id);
      if (quota.quotes.reached) {
        req.flash('error', `Limite atteinte : le plan gratuit permet ${quota.quotes.max} devis. Passez à un abonnement payant pour continuer.`);
        return res.redirect('/pricing');
      }
    }
    next();
  });
}

function guestOnly(req, res, next) {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  next();
}

module.exports = { requireAuth, requireAccess, requireInvoiceQuota, requireQuoteQuota, guestOnly };
