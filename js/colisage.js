/* Colisage : regroupe les scans par EAN, signale les inconnus, imprime le PDF. */
(function () {
  const CD = window.CD;
  const $ = function (s) { return document.querySelector(s); };
  let current = null;      // dernier colisage généré
  let lastSaved = '';      // évite d'enregistrer deux fois le même colisage

  function build() {
    const lines = $('#packing-input').value.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    const groups = {};
    lines.forEach(function (code) {
      const res = CD.lookup(code);
      const key = res.code || code;
      (groups[key] = groups[key] || { ean: key, q: 0, label: res.label || '', status: res.status, reason: res.reason || '' }).q++;
    });
    const rows = Object.keys(groups).map(function (k) { return groups[k]; })
      .sort(function (a, b) { return (a.status === 'ok' ? 0 : 1) - (b.status === 'ok' ? 0 : 1) || (a.label || '').localeCompare(b.label || '') || a.ean.localeCompare(b.ean); });
    const bad = rows.filter(function (r) { return r.status !== 'ok'; });

    current = {
      reference: $('#packing-ref').value.trim(),
      of: $('#packing-of').value.trim(),
      total: lines.length, rows: rows, bad: bad
    };

    $('#packing-result').innerHTML = rows.length
      ? rows.map(function (r) {
          return '<tr class="' + (r.status === 'ok' ? '' : 'row-danger') + '"><td>' + CD.esc(r.ean) + '</td><td>' +
            CD.esc(r.label || '—') + '</td><td>' + r.q + '</td><td>' +
            (r.status === 'ok' ? '<span class="badge ok">Reconnu</span>' : '<span class="badge danger">' + CD.esc(r.reason) + '</span>') + '</td></tr>';
        }).join('')
      : '<tr><td colspan="4" class="empty">Collez ou scannez des codes-barres, puis cliquez sur « Générer le colisage ».</td></tr>';

    $('#packing-total').textContent = lines.length;
    $('#packing-refs').textContent = rows.length;
    $('#packing-anomalies').textContent = bad.length;

    const box = $('#anomaly-box');
    if (bad.length) {
      box.classList.remove('hidden');
      box.innerHTML = '<strong>' + bad.length + ' anomalie(s) à vérifier avant l\'envoi :</strong> ' +
        bad.map(function (r) { return CD.esc(r.ean) + ' (' + r.q + ' pièce' + (r.q > 1 ? 's' : '') + ' — ' + CD.esc(r.reason) + ')'; }).join(' ; ');
    } else {
      box.classList.add('hidden');
      box.textContent = '';
    }

    // En-tête visible uniquement sur le PDF imprimé
    $('#print-title').textContent = 'Colisage' + (current.reference ? ' ' + current.reference : '');
    $('#print-meta').textContent = (current.of ? 'OF ' + current.of + ' · ' : '') + new Date().toLocaleDateString('fr-FR') +
      ' · ' + current.total + ' pièce(s)';
    return current;
  }

  async function save() {
    if (!current || !current.total) return null;
    const sig = JSON.stringify([current.reference, current.of, current.rows.map(function (r) { return [r.ean, r.q]; })]);
    if (sig === lastSaved) return null;
    lastSaved = sig;
    const res = await CD.insert('colisages', {
      reference: current.reference || null, of_num: current.of || null,
      total: current.total, anomalies: current.bad.length,
      lignes: current.rows.map(function (r) { return { ean: r.ean, q: r.q, label: r.label, statut: r.status === 'ok' ? 'ok' : r.reason }; })
    });
    CD.log('Colisage généré', { module: 'Colisage', details: { reference: current.reference, of: current.of, pieces: current.total, anomalies: current.bad.length } });
    current.bad.forEach(function (r) {
      CD.log('Anomalie', { ean: r.ean, module: 'Colisage', details: { raison: r.reason, quantite: r.q } });
    });
    return res;
  }

  document.addEventListener('DOMContentLoaded', function () {
    CD.loadFsp().then(function () { if ($('#packing-input').value.trim()) build(); });
    build();
    $('#build-packing').addEventListener('click', build);
    $('#print-packing').addEventListener('click', async function () {
      const c = build();
      if (!c.total) { CD.say('#packing-msg', 'err', 'Aucun code à imprimer : collez ou scannez d\'abord les codes-barres.'); return; }
      const res = await save();
      if (res) CD.say('#packing-msg', res.ok ? 'ok' : 'warn', 'Colisage enregistré. ' + CD.saveNote(res));
      window.print();
    });
    $('#reset-packing').addEventListener('click', function () {
      if ($('#packing-input').value.trim() && !confirm('Vider la liste des codes scannés ?')) return;
      $('#packing-input').value = '';
      lastSaved = '';
      build();
      CD.say('#packing-msg', 'warn', 'Colisage vidé.');
    });
  });
})();
