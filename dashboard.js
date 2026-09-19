/* Tableau de bord : indicateurs calculés depuis Supabase. */
(function () {
  const CD = window.CD;
  const $ = function (s) { return document.querySelector(s); };
  const fmt = function (n) { return n == null ? '—' : Number(n).toLocaleString('fr-FR'); };

  async function load() {
    if (!CD.ready) return;

    const results = await Promise.all([
      CD.count('labels'),
      CD.count('receptions'),
      CD.select('receptions', 'quantite_scannee', function (q) { return q.limit(20000); }),
      CD.count('activity_logs', function (q) { return q.eq('action', 'Anomalie'); }),
      CD.select('activity_logs', '*', function (q) { return q.order('created_at', { ascending: false }).limit(6); })
    ]);
    const labels = results[0], receptions = results[1], pieces = results[2], anomalies = results[3], recent = results[4];

    $('#k-labels').textContent = fmt(labels);
    $('#k-receptions').textContent = fmt(receptions);
    $('#k-pieces').textContent = pieces ? fmt(pieces.reduce(function (s, x) { return s + (x.quantite_scannee || 0); }, 0)) : '—';
    $('#k-anomalies').textContent = fmt(anomalies);

    $('#recent-list').innerHTML = recent && recent.length
      ? recent.map(function (r) {
          return '<tr class="' + (r.action === 'Anomalie' ? 'row-danger' : '') + '"><td>' + CD.esc(CD.fmtDate(r.created_at)) + '</td><td>' +
            CD.esc(r.action || '') + '</td><td>' + CD.esc(r.ean || '') + '</td><td>' + CD.esc(r.module || '') + '</td></tr>';
        }).join('')
      : '<tr><td colspan="4" class="empty">Aucune activité enregistrée pour le moment.</td></tr>';

    // Une erreur de lecture (table absente, droits…) est affichée dans le bandeau d'état
    window.dispatchEvent(new Event('cd:status'));
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Renvoie d'abord ce qui était en attente, puis affiche les chiffres à jour.
    CD.flush().then(load, load);
  });
})();
