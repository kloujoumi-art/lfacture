const fs = require('fs');
const path = require('path');

// DB_PATH (env var) → Render Disk persistent
// Sinon production → /tmp (perdu au redémarrage)
// Dev → ./database/lfacture.json
const DB_FILE = process.env.DB_PATH
  || (process.env.NODE_ENV === 'production' ? '/tmp/lfacture.json' : path.resolve(__dirname, 'lfacture.json'));

const DEFAULTS = {
  users: [],
  clients: [],
  invoices: [],
  settings: [],
  contacts: [],        // liste mailing
  funnel_logs: [],     // historique emails funnel
  posts: [],           // articles du blog
  blog_campaigns: [],  // campagnes auto blog
  page_views: [],      // analytics visiteurs
  payments: [],        // paiements Paddle
  _counters: { user: 1, client: 1, invoice: 1, settings: 1, contact: 1, funnel_log: 1, post: 1, page_view: 1, payment: 1, blog_campaign: 1 },
};

// Load or initialize
function load() {
  if (fs.existsSync(DB_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch {
      return JSON.parse(JSON.stringify(DEFAULTS));
    }
  }
  return JSON.parse(JSON.stringify(DEFAULTS));
}

function save(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// In-memory store — loaded once at startup
let _store = load();

const db = {
  get(table) {
    if (!_store[table]) _store[table] = Array.isArray(DEFAULTS[table]) ? [] : {};
    return {
      value: () => _store[table],

      find: (predOrObj) => {
        const rows = _store[table];
        const match = typeof predOrObj === 'function'
          ? rows.find(predOrObj)
          : rows.find(r => Object.keys(predOrObj).every(k => r[k] === predOrObj[k]));
        return {
          value: () => match || null,
          assign: (patch) => {
            if (match) Object.assign(match, patch);
            return { write: () => save(_store) };
          },
        };
      },

      filter: (predOrObj) => {
        const rows = _store[table];
        let filtered = typeof predOrObj === 'function'
          ? rows.filter(predOrObj)
          : rows.filter(r => Object.keys(predOrObj).every(k => r[k] === predOrObj[k]));
        const chain = {
          value: () => filtered,
          filter: (p2) => {
            filtered = typeof p2 === 'function'
              ? filtered.filter(p2)
              : filtered.filter(r => Object.keys(p2).every(k => r[k] === p2[k]));
            return chain;
          },
          sortBy: (fn) => {
            filtered = [...filtered].sort((a, b) => {
              const va = fn(a), vb = fn(b);
              return va < vb ? -1 : va > vb ? 1 : 0;
            });
            return chain;
          },
          take: (n) => {
            filtered = filtered.slice(0, n);
            return chain;
          },
          map: (fn) => {
            filtered = filtered.map(fn);
            return chain;
          },
        };
        return chain;
      },

      push: (item) => ({
        write: () => { _store[table].push(item); save(_store); },
      }),

      remove: (predOrObj) => ({
        write: () => {
          _store[table] = _store[table].filter(
            typeof predOrObj === 'function'
              ? r => !predOrObj(r)
              : r => !Object.keys(predOrObj).every(k => r[k] === predOrObj[k])
          );
          save(_store);
        },
      }),

      sortBy: (fn) => {
        const sorted = [..._store[table]].sort((a, b) => {
          const va = fn(a), vb = fn(b);
          return va < vb ? -1 : va > vb ? 1 : 0;
        });
        return { value: () => sorted };
      },
    };
  },

  set(keyPath, value) {
    const parts = keyPath.split('.');
    let obj = _store;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]]) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    return { write: () => save(_store) };
  },
};

function nextId(table) {
  if (!_store._counters) _store._counters = {};
  const id = (_store._counters[table] || 1);
  _store._counters[table] = id + 1;
  save(_store);
  return id;
}

module.exports = { db, nextId };
