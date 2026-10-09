const CACHE='elec-v1';
const ASSETS=['./','./index.html','./style.css','./manifest.json',
'./js/core.js','./js/catalog.js','./js/model.js','./js/plan.js',
'./js/wall.js','./js/ceil.js','./js/three.js','./js/app.js',
'./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim())});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;
e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
caches.open(CACHE).then(c=>c.put(e.request,res.clone()));return res;}).catch(()=>caches.match('./index.html'))))});
