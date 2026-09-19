/* Contrôle : chaque code scanné est vérifié dans le catalogue. */
(function () {
  const CD = window.CD;
  const $ = function (s) { return document.querySelector(s); };
  let total = 0, ok = 0, ko = 0;

  function updateStats() {
    $('#c-total').textContent = total;
    $('#c-ok').textContent = ok;
    $('#c-ko').textContent = ko;
  }

  function control(value) {
    const v = String(value || '').trim();
    if (!v) return;
    const res = CD.lookup(v);
    const good = res.status === 'ok';
    const code = res.code || v;
    total++; good ? ok++ : ko++;
    updateStats();

    const tr = document.createElement('tr');
    if (!good) tr.className = 'row-danger';
    tr.innerHTML = '<td>' + new Date().toLocaleTimeString('fr-FR') + '</td><td>' + CD.esc(code) + '</td><td>' +
      CD.esc(good ? res.label : '—') + '</td><td>' +
      (good ? '<span class="badge ok">Conforme</span>' : '<span class="badge danger">' + CD.esc(res.reason) + '</span>') + '</td>';
    $('#control-list').prepend(tr);
    while ($('#control-list').children.length > 200) $('#control-list').lastElementChild.remove();

    CD.beep(good ? 'ok' : 'ko');
    CD.say('#control-msg', good ? 'ok' : 'err', good ? code + ' — ' + res.label : 'Anomalie : ' + code + ' — ' + res.reason);
    CD.log(good ? 'Contrôle conforme' : 'Anomalie', {
      ean: code, module: 'Contrôle', details: good ? { designation: res.label } : { raison: res.reason }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    CD.loadFsp();
    CD.bindSoundToggle('#sound');
    const input = $('#control-input');
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); control(input.value); input.value = ''; input.focus(); }
    });
    updateStats();
  });
})();
