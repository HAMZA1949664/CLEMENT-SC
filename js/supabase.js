/* Couche de données : Supabase + file d'attente locale.
   Si Supabase est injoignable ou mal configuré, rien n'est perdu :
   les enregistrements restent sur l'appareil et repartent automatiquement
   dès que la connexion fonctionne. */
(function () {
  const cfg = window.CD_CONFIG || {};
  const PENDING_KEY = 'cd_pending_v1';
  const FSP_KEY = 'cd_fsp_v1';
  const CD = window.CD = { ready: false, client: null, config: cfg, lastError: '', fsp: new Set() };

  // ---------- Diagnostic lisible des erreurs Supabase ----------
  function explain(err) {
    if (!err) return '';
    const m = err.message || String(err);
    const c = err.code || '';
    if (c === '42703' || c === 'PGRST204' || /Could not find the '.*' column|column .* does not exist/i.test(m))
      return 'Colonne manquante : exécutez supabase-setup.sql dans Supabase.';
    if (c === '42P01' || c === 'PGRST205' || /Could not find the table|relation .* does not exist/i.test(m))
      return 'Table introuvable : exécutez supabase-setup.sql dans Supabase.';
    if (c === '42501' || /row-level security|permission denied/i.test(m))
      return 'Accès refusé : exécutez supabase-setup.sql (droits d\'accès).';
    if (/Failed to fetch|NetworkError|Load failed/i.test(m))
      return 'Réseau indisponible : données gardées sur cet appareil.';
    return m;
  }
  CD.explain = explain;

  function notify() {
    try { window.dispatchEvent(new Event('cd:status')); } catch (e) { /* ignore */ }
  }

  if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase && window.supabase.createClient) {
    try {
      CD.client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      CD.ready = true;
    } catch (e) {
      CD.lastError = explain(e);
      console.warn('[CD] init', e);
    }
  }

  // ---------- File d'attente locale ----------
  function readQ() { try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch (e) { return []; } }
  function writeQ(q) { try { localStorage.setItem(PENDING_KEY, JSON.stringify(q)); } catch (e) { /* ignore */ } }
  function enqueue(table, row) {
    const q = readQ();
    q.push({ table, row: Object.assign({ created_at: new Date().toISOString() }, row) });
    writeQ(q);
  }
  CD.pending = readQ;
  CD.pendingCount = function () { return readQ().length; };

  // ---------- Écriture ----------
  CD.insert = async function (table, row) {
    if (!CD.ready) {
      enqueue(table, row);
      notify();
      return { ok: false, queued: true, error: 'Supabase non connecté' };
    }
    try {
      const { error } = await CD.client.from(table).insert(row);
      if (error) throw error;
      CD.lastError = '';
      return { ok: true };
    } catch (e) {
      CD.lastError = explain(e);
      console.warn('[CD] insert', table, e);
      enqueue(table, row);
      notify();
      return { ok: false, queued: true, error: CD.lastError };
    }
  };

  CD.log = function (action, opts) {
    const o = opts || {};
    return CD.insert('activity_logs', {
      action: action,
      ean: o.ean || null,
      module: o.module || null,
      details: o.details || null
    });
  };

  // ---------- Renvoi des enregistrements en attente ----------
  let flushP = null;
  async function doFlush() {
    let sent = 0;
    try {
      for (;;) {
        const q = readQ();
        if (!q.length) break;
        const it = q[0];
        const { error } = await CD.client.from(it.table).insert(it.row);
        if (error) throw error;
        const cur = readQ(); cur.shift(); writeQ(cur);
        sent++;
      }
      CD.lastError = '';
    } catch (e) {
      CD.lastError = explain(e);
      console.warn('[CD] flush', e);
    }
    notify();
    return sent;
  }
  CD.flush = function () {
    if (!CD.ready) return Promise.resolve(0);
    if (!flushP) flushP = doFlush().then(function (n) { flushP = null; return n; }, function () { flushP = null; return 0; });
    return flushP;
  };

  // ---------- Lecture ----------
  CD.count = async function (table, apply) {
    if (!CD.ready) return null;
    try {
      let q = CD.client.from(table).select('*', { count: 'exact', head: true });
      if (apply) q = apply(q);
      const { count, error } = await q;
      if (error) throw error;
      return count;
    } catch (e) {
      CD.lastError = explain(e);
      console.warn('[CD] count', table, e);
      return null;
    }
  };

  CD.select = async function (table, columns, apply) {
    if (!CD.ready) return null;
    try {
      let q = CD.client.from(table).select(columns || '*');
      if (apply) q = apply(q);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    } catch (e) {
      CD.lastError = explain(e);
      console.warn('[CD] select', table, e);
      return null;
    }
  };

  // ---------- Références « fabrication spéciale » connues (FSP-...) ----------
  try { JSON.parse(localStorage.getItem(FSP_KEY) || '[]').forEach(function (x) { CD.fsp.add(x); }); } catch (e) { /* ignore */ }
  function saveFsp() { try { localStorage.setItem(FSP_KEY, JSON.stringify(Array.from(CD.fsp))); } catch (e) { /* ignore */ } }
  CD.addFsp = function (ref) { CD.fsp.add(String(ref).toUpperCase()); saveFsp(); };
  CD.loadFsp = async function () {
    const rows = await CD.select('fabrications', 'reference', function (q) { return q.limit(5000); });
    if (rows) { rows.forEach(function (r) { if (r.reference) CD.fsp.add(String(r.reference).toUpperCase()); }); saveFsp(); }
  };

  // ---------- Démarrage ----------
  window.addEventListener('online', function () { CD.flush(); });
  document.addEventListener('DOMContentLoaded', function () { CD.flush(); });
})();
