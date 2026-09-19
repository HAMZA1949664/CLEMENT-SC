/* Réception : 1 carton → scanner tous les articles → fermer → carton suivant. */
(function () {
  const CD = window.CD;
  const DRAFT_KEY = 'cd_reception_draft_v1';
  let scans = []; // { ean, status, label, reason }

  const $ = function (s) { return document.querySelector(s); };
  const ofEl = $('#of'), cartonEl = $('#carton'), scanner = $('#scanner');

  function saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ of: ofEl.value, carton: cartonEl.value, scans: scans })); } catch (e) { /* ignore */ }
  }
  function loadDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (!d) return;
      ofEl.value = d.of || '';
      cartonEl.value = d.carton || '';
      scans = Array.isArray(d.scans) ? d.scans : [];
    } catch (e) { /* ignore */ }
  }

  function anomalyCount() { return scans.filter(function (s) { return s.status !== 'ok'; }).length; }

  function badge(s) {
    if (s.status === 'ok') return '<span class="badge ok">Reconnu</span>';
    return '<span class="badge danger">' + CD.esc(s.reason || 'Anomalie') + '</span>';
  }

  function render() {
    $('#scan-count').textContent = scans.length;
    $('#anomaly-count').textContent = anomalyCount();

    $('#scan-list').innerHTML = scans.slice(-100).reverse().map(function (s, i) {
      const n = scans.length - i;
      return '<tr class="' + (s.status === 'ok' ? '' : 'row-danger') + '"><td>' + n + '</td><td>' + CD.esc(s.ean) +
        '</td><td>' + CD.esc(s.label || '') + '</td><td>' + badge(s) + '</td></tr>';
    }).join('');

    const groups = {};
    scans.forEach(function (s) {
      (groups[s.ean] = groups[s.ean] || { ean: s.ean, label: s.label, q: 0, status: s.status }).q++;
    });
    const rows = Object.keys(groups).map(function (k) { return groups[k]; })
      .sort(function (a, b) { return (a.label || 'zzz').localeCompare(b.label || 'zzz') || a.ean.localeCompare(b.ean); });
    $('#carton-summary').innerHTML = rows.length
      ? rows.map(function (g) {
          return '<tr class="' + (g.status === 'ok' ? '' : 'row-danger') + '"><td>' + CD.esc(g.ean) + '</td><td>' +
            CD.esc(g.label || '—') + '</td><td>' + g.q + '</td></tr>';
        }).join('')
      : '<tr><td colspan="3" class="empty">Aucun article scanné dans ce carton.</td></tr>';
  }

  function addScan(value) {
    const v = String(value || '').trim();
    if (!v) return;
    if (!ofEl.value.trim() || !cartonEl.value.trim()) {
      CD.beep('ko');
      CD.say('#reception-msg', 'err', 'Renseignez l\'OF et le N° de carton avant de scanner.');
      (ofEl.value.trim() ? cartonEl : ofEl).focus();
      return; // le code scanné reste dans le champ
    }
    const res = CD.lookup(v);
    const scan = { ean: res.code || v, status: res.status, label: res.label || '', reason: res.reason || '' };
    scans.push(scan);
    saveDraft();
    render();
    scanner.value = '';
    scanner.focus();
    if (res.status === 'ok') {
      CD.beep('ok');
      CD.say('#reception-msg', 'ok', scan.ean + ' — ' + scan.label);
    } else {
      CD.beep('ko');
      CD.say('#reception-msg', 'err', 'Anomalie : ' + scan.ean + ' — ' + scan.reason + '. Annulez le scan si c\'est une erreur de lecture.');
      CD.log('Anomalie', { ean: scan.ean, module: 'Réception', details: { of: ofEl.value.trim(), carton: cartonEl.value.trim(), raison: scan.reason } });
    }
  }

  function nextCarton(v) {
    const m = /^(.*?)(\d+)$/.exec(String(v).trim());
    if (!m) return '';
    const n = String(parseInt(m[2], 10) + 1);
    return m[1] + ('0'.repeat(Math.max(0, m[2].length - n.length))) + n;
  }

  async function closeCarton() {
    const of = ofEl.value.trim(), carton = cartonEl.value.trim();
    if (!of || !carton) { CD.say('#reception-msg', 'err', 'Renseignez l\'OF et le N° de carton.'); return; }
    if (!scans.length) { CD.say('#reception-msg', 'err', 'Ce carton est vide : scannez au moins un article.'); return; }
    const ko = anomalyCount();
    if (ko && !confirm('Ce carton contient ' + ko + ' anomalie(s). Le fermer quand même ?')) return;

    const groups = {};
    scans.forEach(function (s) {
      (groups[s.ean] = groups[s.ean] || { ean: s.ean, q: 0, label: s.label, statut: s.status === 'ok' ? 'ok' : s.reason }).q++;
    });
    const btn = $('#close-carton');
    btn.disabled = true;
    const total = scans.length;
    const res = await CD.insert('receptions', {
      of_num: of, carton: carton, quantite_scannee: total, anomalies: ko,
      statut: 'ferme', lignes: Object.keys(groups).map(function (k) { return groups[k]; }),
      closed_at: new Date().toISOString()
    });
    CD.log('Carton fermé', { module: 'Réception', details: { of: of, carton: carton, pieces: total, anomalies: ko } });

    CD.say('#reception-msg', res.ok ? 'ok' : 'warn',
      'Carton ' + carton + ' fermé : ' + total + ' pièce(s). ' + CD.saveNote(res));
    scans = [];
    cartonEl.value = nextCarton(carton);
    saveDraft();
    render();
    btn.disabled = false;
    scanner.focus();
  }

  document.addEventListener('DOMContentLoaded', function () {
    CD.loadFsp().then(function () { /* les FSP connues sont prises en compte aux scans suivants */ });
    CD.bindSoundToggle('#sound');
    loadDraft();
    render();

    scanner.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addScan(scanner.value); } });
    $('#add-scan').addEventListener('click', function () { addScan(scanner.value); });
    ofEl.addEventListener('input', saveDraft);
    cartonEl.addEventListener('input', saveDraft);
    $('#undo-scan').addEventListener('click', function () {
      if (!scans.length) return;
      const last = scans.pop();
      saveDraft(); render();
      CD.say('#reception-msg', 'warn', 'Dernier scan annulé : ' + last.ean);
      scanner.focus();
    });
    $('#clear-scans').addEventListener('click', function () {
      if (!scans.length) return;
      if (!confirm('Effacer les ' + scans.length + ' scans de ce carton ?')) return;
      scans = []; saveDraft(); render();
      CD.say('#reception-msg', 'warn', 'Scans effacés.');
      scanner.focus();
    });
    $('#close-carton').addEventListener('click', closeCarton);
  });
})();
