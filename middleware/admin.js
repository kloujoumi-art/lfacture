const User = require('../models/User');

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  const user = User.findById(req.session.userId);
  if (!user || !user.is_admin) {
    return res.status(403).renderLayout('errors/403', { title: 'Accès refusé — LFacture' });
  }
  req.user = user;
  res.locals.user = user;
  res.locals.isOnTrial = false;
  res.locals.trialDaysLeft = 0;
  res.locals.hasAccess = true;
  next();
}

module.exports = { requireAdmin };
