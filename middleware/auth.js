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
  res.locals.isOnTrial = User.isOnTrial(user);
  res.locals.trialDaysLeft = User.trialDaysLeft(user);
  res.locals.hasAccess = User.hasActiveSubscription(user);
  next();
}

function requireAccess(req, res, next) {
  requireAuth(req, res, () => {
    if (!User.hasActiveSubscription(req.user)) {
      req.flash('error', 'Votre essai gratuit est expiré. Veuillez choisir un abonnement.');
      return res.redirect('/pricing');
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

module.exports = { requireAuth, requireAccess, guestOnly };
