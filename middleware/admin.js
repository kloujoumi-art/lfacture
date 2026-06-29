const User = require('../models/User');

function requireAdmin(req, res, next) {
  const isApi = req.path.startsWith('/api/') || (req.headers.accept || '').includes('application/json');
  if (!req.session || !req.session.userId) {
    if (isApi) return res.status(401).json({ error: 'Session expirée — reconnectez-vous' });
    return res.redirect('/login');
  }
  const user = User.findById(req.session.userId);
  if (!user || !user.is_admin) {
    if (isApi) return res.status(403).json({ error: 'Accès refusé' });
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
