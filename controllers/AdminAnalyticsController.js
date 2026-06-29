const { db } = require('../database/db');
const adm = (res, view, data = {}) => res.renderLayout(view, data, 'admin');

// Génère la liste de toutes les dates entre start et end (YYYY-MM-DD)
function dateRange(start, end) {
  const days = [];
  const s = new Date(start), e = new Date(end);
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function formatDateFR(iso) {
  const [y, m, d] = iso.split('-');
  const months = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'];
  return `${parseInt(d)} ${months[parseInt(m)-1]}`;
}

// Convertit code pays → emoji drapeau (Regional Indicator Symbols)
function countryFlag(code) {
  if (!code || code === 'XX' || code === 'LOCAL') return '🌍';
  return [...code.toUpperCase()].map(c => String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0))).join('');
}

class AdminAnalyticsController {

  static index(req, res) {
    const { period = '7d', from_date, to_date } = req.query;

    const today     = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    let startDate, endDate;
    switch (period) {
      case 'today':
        startDate = endDate = today; break;
      case 'yesterday':
        startDate = endDate = yesterday; break;
      case '30d':
        startDate = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
        endDate = today; break;
      case 'custom':
        startDate = from_date || today;
        endDate   = to_date   || today;
        break;
      default: // 7d
        startDate = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
        endDate   = today;
    }

    const allViews = db.get('page_views').value() || [];
    const filtered = allViews.filter(v => v.date >= startDate && v.date <= endDate);

    // ---- Métriques globales ----
    const totalViews      = filtered.length;
    const uniqueVisitors  = new Set(filtered.map(v => v.ip_hash)).size;
    const uniqueSessions  = new Set(filtered.map(v => v.session_id)).size;

    // Comparaison période précédente
    const diffDays = Math.max(1, dateRange(startDate, endDate).length);
    const prevEnd   = new Date(new Date(startDate) - 86400000).toISOString().slice(0, 10);
    const prevStart = new Date(new Date(prevEnd) - (diffDays - 1) * 86400000).toISOString().slice(0, 10);
    const prevViews = allViews.filter(v => v.date >= prevStart && v.date <= prevEnd).length;
    const prevUniq  = new Set(allViews.filter(v => v.date >= prevStart && v.date <= prevEnd).map(v => v.ip_hash)).size;

    function pct(curr, prev) {
      if (!prev) return curr > 0 ? '+100%' : '—';
      const p = Math.round(((curr - prev) / prev) * 100);
      return (p >= 0 ? '+' : '') + p + '%';
    }

    // Quick cards: aujourd'hui + hier
    const todayViews     = allViews.filter(v => v.date === today).length;
    const yesterdayViews = allViews.filter(v => v.date === yesterday).length;
    const todayUniq      = new Set(allViews.filter(v => v.date === today).map(v => v.ip_hash)).size;
    const yesterdayUniq  = new Set(allViews.filter(v => v.date === yesterday).map(v => v.ip_hash)).size;

    // ---- Graphique par jour ----
    const dayKeys = dateRange(startDate, endDate);
    const byDay   = {};
    filtered.forEach(v => { byDay[v.date] = (byDay[v.date] || 0) + 1; });
    const byDayUniq = {};
    const ipByDay   = {};
    filtered.forEach(v => {
      if (!ipByDay[v.date]) ipByDay[v.date] = new Set();
      ipByDay[v.date].add(v.ip_hash);
    });
    dayKeys.forEach(k => { byDayUniq[k] = ipByDay[k] ? ipByDay[k].size : 0; });

    const chartDays = dayKeys.map(k => ({
      date: k,
      label: formatDateFR(k),
      views: byDay[k] || 0,
      uniq: byDayUniq[k] || 0,
    }));
    const chartMax = Math.max(1, ...chartDays.map(d => d.views));

    // ---- Pays ----
    const countryMap = {};
    filtered.forEach(v => {
      if (!v.country_code || v.country_code === 'LOCAL') return;
      const k = v.country_code;
      if (!countryMap[k]) countryMap[k] = { code: k, name: v.country_name || k, count: 0, flag: countryFlag(k) };
      countryMap[k].count++;
    });
    const countries = Object.values(countryMap).sort((a, b) => b.count - a.count).slice(0, 20);
    const countryMax = countries.length ? countries[0].count : 1;

    // ---- Sources de trafic ----
    const sourceMap = {};
    filtered.forEach(v => {
      const raw = v.source || 'direct';
      const key = raw.startsWith('referral:') ? 'referral' : raw;
      if (!sourceMap[key]) sourceMap[key] = { name: key, count: 0 };
      sourceMap[key].count++;
    });
    const sources = Object.values(sourceMap).sort((a, b) => b.count - a.count);
    const sourceMax = sources.length ? sources[0].count : 1;

    // Labels + couleurs sources
    const sourceConfig = {
      direct:    { label: 'Direct',    color: '#6366f1', icon: '🔗' },
      google:    { label: 'Google',    color: '#4285f4', icon: '🔍' },
      bing:      { label: 'Bing',      color: '#00809d', icon: '🔍' },
      yahoo:     { label: 'Yahoo',     color: '#720e9e', icon: '🔍' },
      facebook:  { label: 'Facebook',  color: '#1877f2', icon: '📘' },
      instagram: { label: 'Instagram', color: '#e1306c', icon: '📸' },
      twitter:   { label: 'Twitter/X', color: '#1da1f2', icon: '🐦' },
      linkedin:  { label: 'LinkedIn',  color: '#0077b5', icon: '💼' },
      tiktok:    { label: 'TikTok',    color: '#010101', icon: '🎵' },
      youtube:   { label: 'YouTube',   color: '#ff0000', icon: '▶️' },
      referral:  { label: 'Référents', color: '#10b981', icon: '🌐' },
    };
    sources.forEach(s => {
      const cfg = sourceConfig[s.name] || { label: s.name, color: '#64748b', icon: '📎' };
      s.label = cfg.label; s.color = cfg.color; s.icon = cfg.icon;
    });

    // ---- Top pages ----
    const pageMap = {};
    filtered.forEach(v => { pageMap[v.path] = (pageMap[v.path] || 0) + 1; });
    const topPages = Object.entries(pageMap)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    const pageMax = topPages.length ? topPages[0].count : 1;

    adm(res, 'admin/analytics', {
      title: 'Analytics visiteurs — LFacture Admin',
      pageTitle: 'Analytics visiteurs',
      activePage: 'analytics',
      period,
      from_date: from_date || startDate,
      to_date:   to_date   || endDate,
      startDate, endDate,
      totalViews, uniqueVisitors, uniqueSessions,
      prevViews, prevUniq,
      viewsPct: pct(totalViews, prevViews),
      uniqPct:  pct(uniqueVisitors, prevUniq),
      todayViews, yesterdayViews, todayUniq, yesterdayUniq,
      chartDays, chartMax,
      countries, countryMax,
      sources, sourceMax,
      topPages, pageMax,
      countryFlag,
    });
  }
}

module.exports = AdminAnalyticsController;
