(function(){
  const cfg=window.CD_CONFIG||{};
  window.CD={ready:false,client:null,config:cfg};
  if(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase){
    CD.client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);CD.ready=true;
  }
})();
