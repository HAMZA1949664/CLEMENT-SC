/* Fabrication spéciale : référence unique liée à l'OF, enregistrée dans Supabase. */
(function () {
  const CD = window.CD;
  const $ = function (s) { return document.querySelector(s); };
  const recent = []; // { created_at, reference, of_num, article, couleur, taille, quantite, faconnier }

  function newReference(of) {
    const clean = of.toUpperCase().replace(/[^A-Z0-9]+/g, '') || 'OF';
    let ref;
    do {
      ref = 'FSP-' + clean + '-' + Math.floor(100000 + Math.random() * 900000);
    } while (CD.fsp.has(ref));
    return ref;
  }

  function renderRecent() {
    $('#fab-list').innerHTML = recent.length
      ? recent.map(function (r) {
          return '<tr><td>' + CD.esc(CD.fmtDate(r.created_at)) + '</td><td><strong>' + CD.esc(r.reference) + '</strong></td><td>' +
            CD.esc(r.of_num) + '</td><td>' + CD.esc(r.article) + '</td><td>' + CD.esc([r.couleur, r.taille].filter(Boolean).join(' / ')) +
            '</td><td>' + CD.esc(r.quantite == null ? '' : r.quantite) + '</td><td>' + CD.esc(r.faconnier || '') + '</td></tr>';
        }).join('')
      : '<tr><td colspan="7" class="empty">Aucune fabrication spéciale enregistrée.</td></tr>';
  }

  async function loadRecent() {
    const rows = await CD.select('fabrications', 'created_at,reference,of_num,article,couleur,taille,quantite,faconnier',
      function (q) { return q.order('created_at', { ascending: false }).limit(20); });
    if (rows) { rows.forEach(function (r) { recent.push(r); if (r.reference) CD.fsp.add(String(r.reference).toUpperCase()); }); }
    renderRecent();
  }

  async function onSubmit(e) {
    e.preventDefault();
    const of = $('#of').value.trim(), article = $('#article').value.trim();
    if (!of || !article) return;
    const qte = parseInt($('#quantite').value, 10);
    const row = {
      reference: newReference(of), of_num: of, article: article,
      couleur: $('#couleur').value.trim() || null, taille: $('#taille').value.trim() || null,
      quantite: isNaN(qte) ? null : qte, faconnier: $('#faconnier').value,
      commentaire: $('#commentaire').value.trim() || null
    };
    const btn = $('#fab-submit');
    btn.disabled = true;
    const res = await CD.insert('fabrications', row);
    CD.addFsp(row.reference);
    CD.log('Fabrication spéciale créée', { ean: row.reference, module: 'Fabrication', details: { of: of, article: article, faconnier: row.faconnier } });

    $('#generated').textContent = row.reference;
    $('#result').classList.remove('hidden');
    CD.say('#fab-msg', res.ok ? 'ok' : 'warn', 'Référence créée. ' + CD.saveNote(res));
    recent.unshift(Object.assign({ created_at: new Date().toISOString() }, row));
    renderRecent();
    btn.disabled = false;
  }

  document.addEventListener('DOMContentLoaded', function () {
    CD.loadFsp().then(loadRecent);
    renderRecent();
    $('#fab-form').addEventListener('submit', onSubmit);
    $('#copy-ref').addEventListener('click', function () {
      const ref = $('#generated').textContent;
      if (!ref) return;
      const done = function () { CD.say('#fab-msg', 'ok', 'Référence copiée : ' + ref); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ref).then(done, function () { CD.say('#fab-msg', 'warn', 'Copie impossible : sélectionnez la référence à la main.'); });
      else CD.say('#fab-msg', 'warn', 'Copie impossible : sélectionnez la référence à la main.');
    });
  });
})();
