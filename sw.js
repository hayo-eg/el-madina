const C='madina-v1';
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin)return;
  if(u.pathname.includes('/download/')){return;}
  if(u.pathname.endsWith('version.json')){e.respondWith(fetch(r).catch(()=>caches.match(r)));return;}
  // network first, fall back to cache (always latest when online, works offline)
  e.respondWith(fetch(r).then(res=>{if(res.ok){const c=res.clone();caches.open(C).then(k=>k.put(r,c));}return res;}).catch(()=>caches.match(r,{ignoreSearch:false}).then(m=>m||caches.match(r,{ignoreSearch:true}))));
});
