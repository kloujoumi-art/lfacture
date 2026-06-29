const { db, nextId } = require('../database/db');
const crypto = require('crypto');
const http = require('http');

// In-memory cache: ip → { country_code, country_name }
const ipCache = new Map();
const pendingIPs = new Set();

const SKIP_PATH = /^\/(admin|dashboard|favicon|sitemap|robots|images|uploads)/;
const SKIP_EXT  = /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|map|webp|txt|xml)$/i;
const BOT_UA    = /bot|crawler|spider|scraper|lighthouse|pingdom|uptimerobot|facebookexternalhit|curl|wget/i;

function hashIp(ip) {
  return crypto.createHash('sha256').update(ip + '_lf24').digest('hex').slice(0, 16);
}

function parseSource(referer, host) {
  if (!referer) return { source: 'direct', referrer: null };
  try {
    const u = new URL(referer);
    const ref = u.hostname.replace(/^www\./, '');
    const self = (host || '').replace(/^www\./, '').split(':')[0];
    if (ref === self || ref === 'lfacture.com') return { source: 'direct', referrer: null };
    if (/google\./i.test(ref))    return { source: 'google', referrer: referer };
    if (/bing\./i.test(ref))      return { source: 'bing', referrer: referer };
    if (/yahoo\./i.test(ref))     return { source: 'yahoo', referrer: referer };
    if (/facebook\.|fb\.com/i.test(ref))  return { source: 'facebook', referrer: referer };
    if (/instagram\./i.test(ref)) return { source: 'instagram', referrer: referer };
    if (/twitter\.|^t\.co/i.test(ref))    return { source: 'twitter', referrer: referer };
    if (/linkedin\./i.test(ref))  return { source: 'linkedin', referrer: referer };
    if (/tiktok\./i.test(ref))    return { source: 'tiktok', referrer: referer };
    if (/youtube\./i.test(ref))   return { source: 'youtube', referrer: referer };
    return { source: 'referral:' + ref, referrer: referer };
  } catch {
    return { source: 'direct', referrer: null };
  }
}

function lookupCountry(ip) {
  if (!ip || ip === '::1' || ip === '127.0.0.1' || /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) {
    return Promise.resolve({ country_code: 'LOCAL', country_name: 'Local' });
  }
  if (ipCache.has(ip)) return Promise.resolve(ipCache.get(ip));
  if (pendingIPs.has(ip)) return Promise.resolve(null);
  pendingIPs.add(ip);

  return new Promise((resolve) => {
    const cleanIp = ip.replace(/^::ffff:/, '');
    const req = http.get(`http://ip-api.com/json/${cleanIp}?fields=status,country,countryCode&lang=fr`, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        pendingIPs.delete(ip);
        try {
          const j = JSON.parse(raw);
          const result = j.status === 'success'
            ? { country_code: j.countryCode, country_name: j.country }
            : { country_code: 'XX', country_name: 'Inconnu' };
          ipCache.set(ip, result);
          resolve(result);
        } catch { resolve({ country_code: 'XX', country_name: 'Inconnu' }); }
      });
    });
    req.on('error', () => { pendingIPs.delete(ip); resolve({ country_code: 'XX', country_name: 'Inconnu' }); });
    req.setTimeout(3000, () => { req.destroy(); pendingIPs.delete(ip); resolve(null); });
  });
}

module.exports = function analyticsMiddleware(req, res, next) {
  if (req.method !== 'GET') return next();
  if (SKIP_PATH.test(req.path) || SKIP_EXT.test(req.path)) return next();
  const ua = req.get('user-agent') || '';
  if (BOT_UA.test(ua)) return next();

  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const ip = (req.ip || req.connection.remoteAddress || '').replace(/^::ffff:/, '');
  const ip_hash = hashIp(ip);
  const { source, referrer } = parseSource(req.get('referer') || '', req.get('host') || '');

  if (!req.session.vid) req.session.vid = crypto.randomBytes(8).toString('hex');

  // Store visit immediately (country filled async)
  const visitId = nextId('page_view');
  db.get('page_views').push({
    id: visitId,
    date,
    ts: now.toISOString(),
    path: req.path,
    ip_hash,
    country_code: '',
    country_name: '',
    source,
    referrer: referrer ? referrer.slice(0, 200) : null,
    session_id: req.session.vid,
  }).write();

  // Async: update country
  lookupCountry(ip).then(country => {
    if (!country) return;
    db.get('page_views').find({ id: visitId }).assign({
      country_code: country.country_code,
      country_name: country.country_name,
    }).write();
  }).catch(() => {});

  // Cleanup 1% of requests: supprimer visites > 60 jours
  if (Math.random() < 0.01) {
    const cutoff = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
    db.get('page_views').remove(v => v.date < cutoff).write();
  }

  next();
};
