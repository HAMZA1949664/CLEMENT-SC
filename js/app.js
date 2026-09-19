/* Outils communs à toutes les pages (à charger après supabase.js). */
(function () {
  const CD = window.CD;

  // ---------- Menu : met en surbrillance la page courante ----------
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('[data-nav]').forEach(function (a) {
    const file = (a.getAttribute('href') || '').split('/').pop();
    if (file === page) a.classList.add('active');
  });

  // ---------- Bandeau d'état Supabase ----------
  function renderStatus() {
    const el = document.querySelector('#config-status');
    if (!el) return;
    const n = CD.pendingCount();
    let cls = 'st-ok', txt = 'Supabase connecté';
    if (!CD.ready) {
      cls = 'st-warn';
      txt = 'Mode local : Supabase non connecté' + (n ? ' · ' + n + ' en attente' : '');
    } else if (n) {
      cls = 'st-warn';
      txt = 'Supabase connecté · ' + n + ' enregistrement(s) en attente' + (CD.lastError ? ' — ' + CD.lastError : '');
    } else if (CD.lastError) {
      cls = 'st-warn';
      txt = 'Supabase : ' + CD.lastError;
    }
    el.className = 'user ' + cls;
    el.textContent = txt;
  }
  window.addEventListener('cd:status', renderStatus);
  document.addEventListener('DOMContentLoaded', renderStatus);

  // ---------- Petits utilitaires ----------
  CD.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  CD.fmtDate = function (d) {
    try { return new Date(d).toLocaleString('fr-FR'); } catch (e) { return ''; }
  };
  CD.fmtDetails = function (d) {
    if (!d) return '';
    if (typeof d === 'string') return d;
    return Object.keys(d).map(function (k) { return k + ' : ' + d[k]; }).join(' · ');
  };

  // ---------- EAN-13 et recherche dans le catalogue ----------
  CD.eanValid = function (code) {
    if (!/^\d{13}$/.test(code)) return false;
    const d = code.split('').map(Number);
    const sum = d.slice(0, 12).reduce(function (a, x, i) { return a + x * (i % 2 === 0 ? 1 : 3); }, 0);
    return ((10 - (sum % 10)) % 10) === d[12];
  };

  const index = new Map();
  (window.CD_CATALOG || []).forEach(function (r) { index.set(r[4], r); });

  function describe(r) {
    const manche = r[3] ? ' (' + r[3].split(' / ')[0] + ')' : '';
    return r[0] + ' — ' + r[1] + ' — ' + r[2] + manche;
  }

  /* Résultat : { status: 'ok' | 'inconnu' | 'invalide' | 'vide', label, reason } */
  CD.lookup = function (raw) {
    const code = String(raw || '').trim();
    if (!code) return { status: 'vide', code: code };
    const r = index.get(code);
    if (r) return { status: 'ok', code: code, label: describe(r), kind: 'catalogue' };
    const up = code.toUpperCase();
    if (up.indexOf('FSP-') === 0) {
      return CD.fsp.has(up)
        ? { status: 'ok', code: up, label: 'Fabrication spéciale', kind: 'fabrication' }
        : { status: 'inconnu', code: up, label: '', reason: 'Référence FSP inconnue' };
    }
    if (!CD.eanValid(code)) return { status: 'invalide', code: code, label: '', reason: 'Code invalide (EAN-13 attendu)' };
    return { status: 'inconnu', code: code, label: '', reason: 'EAN absent du catalogue' };
  };

  // ---------- Bip sonore (réglable) ----------
  CD.soundOn = function () { try { return localStorage.getItem('cd_sound') !== 'off'; } catch (e) { return true; } };
  CD.setSound = function (on) { try { localStorage.setItem('cd_sound', on ? 'on' : 'off'); } catch (e) { /* ignore */ } };
  CD.beep = function (kind) {
    if (!CD.soundOn()) return;
    try {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!A) return;
      CD._ac = CD._ac || new A();
      const o = CD._ac.createOscillator(), g = CD._ac.createGain();
      o.connect(g); g.connect(CD._ac.destination);
      o.type = kind === 'ok' ? 'sine' : 'square';
      o.frequency.value = kind === 'ok' ? 880 : 220;
      g.gain.value = 0.08;
      o.start();
      o.stop(CD._ac.currentTime + (kind === 'ok' ? 0.08 : 0.35));
    } catch (e) { /* ignore */ }
  };
  CD.bindSoundToggle = function (sel) {
    const box = document.querySelector(sel);
    if (!box) return;
    box.checked = CD.soundOn();
    box.addEventListener('change', function () { CD.setSound(box.checked); });
  };

  // ---------- Message dans la page ----------
  CD.say = function (sel, kind, text) {
    const el = document.querySelector(sel);
    if (!el) return;
    el.className = 'msg ' + kind;
    el.textContent = text;
  };
  CD.saveNote = function (res) {
    return res && res.ok ? 'Enregistré.' : 'Gardé sur cet appareil, envoi dès que Supabase répond' + (res && res.error ? ' (' + res.error + ')' : '') + '.';
  };
})();
