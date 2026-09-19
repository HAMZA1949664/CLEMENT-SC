/* Historique / traçabilité : journal des actions (activity_logs). */
(function () {
  const CD = window.CD;
  const $ = function (s) { return document.querySelector(s); };
  let rows = []; // { created_at, action, ean, module, details, pending }

  function pendingRows() {
    return CD.pending().filter(function (p) { return p.table === 'activity_logs'; }).map(function (p) {
      return Object.assign({}, p.row, { pending: true });
    });
  }

  async function load() {
    $('#history-list').innerHTML = '<tr><td colspan="5" class="empty">Chargement…</td></tr>';
    const data = await CD.select('activity_logs', '*', function (q) { return q.order('created_at', { ascending: false }).limit(300); });
    const local = pendingRows().reverse();
    rows = local.concat(data || []);
    const sel = $('#h-module');
    const keep = sel.value;
    const modules = Array.from(new Set(rows.map(function (r) { return r.module; }).filter(Boolean))).sort();
    sel.innerHTML = '<option value="">Tous les modules</option>' + modules.map(function (m) { return '<option>' + CD.esc(m) + '</option>'; }).join('');
    if (modules.indexOf(keep) >= 0) sel.value = keep;
    let note = '';
    if (!CD.ready) note = 'Supabase n\'est pas connecté : seules les actions faites sur cet appareil sont visibles.';
    else if (data === null) note = 'Lecture impossible' + (CD.lastError ? ' : ' + CD.lastError : '.');
    CD.say('#history-msg', note ? 'warn' : 'hidden', note);
    render();
  }

  function filtered() {
    const q = $('#h-search').value.trim().toLowerCase();
    const mod = $('#h-module').value;
    return rows.filter(function (r) {
      if (mod && r.module !== mod) return false;
      if (!q) return true;
      return [r.action, r.ean, r.module, CD.fmtDetails(r.details)].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }

  function render() {
    const list = filtered();
    $('#h-count').textContent = list.length;
    $('#history-list').innerHTML = list.length
      ? list.map(function (r) {
          const anomaly = r.action === 'Anomalie';
          return '<tr class="' + (anomaly ? 'row-danger' : '') + '"><td>' + CD.esc(CD.fmtDate(r.created_at)) + '</td><td>' +
            CD.esc(r.action || '') + (r.pending ? ' <span class="badge warn">en attente</span>' : '') + '</td><td>' +
            CD.esc(r.ean || '') + '</td><td>' + CD.esc(r.module || '') + '</td><td>' + CD.esc(CD.fmtDetails(r.details)) + '</td></tr>';
        }).join('')
      : '<tr><td colspan="5" class="empty">Aucune action à afficher.</td></tr>';
  }

  function exportCsv() {
    const list = filtered();
    const q = function (s) { return '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"'; };
    const csv = '\ufeffDate;Action;EAN;Module;Détail\r\n' + list.map(function (r) {
      return [q(CD.fmtDate(r.created_at)), q(r.action), q(r.ean), q(r.module), q(CD.fmtDetails(r.details))].join(';');
    }).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'historique_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  document.addEventListener('DOMContentLoaded', function () {
    load();
    $('#h-search').addEventListener('input', render);
    $('#h-module').addEventListener('change', render);
    $('#h-refresh').addEventListener('click', load);
    $('#h-export').addEventListener('click', exportCsv);
    window.addEventListener('cd:status', function () { /* la liste se met à jour au prochain rafraîchissement */ });
  });
})();
