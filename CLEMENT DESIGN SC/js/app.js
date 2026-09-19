(function(){
  const p=location.pathname.split('/').pop()||'index.html';
  document.querySelectorAll('[data-nav]').forEach(a=>{if(a.getAttribute('href')===p)a.classList.add('active')});
  const status=document.querySelector('#config-status');
  if(status) status.textContent=CD.ready?'Supabase connecté':'Mode interface : renseignez config.js pour activer Supabase';
  document.querySelectorAll('[data-demo]').forEach(el=>el.addEventListener('click',()=>alert('Cette action est prête côté interface. Connectez Supabase dans config.js pour enregistrer les données.')));
})();
