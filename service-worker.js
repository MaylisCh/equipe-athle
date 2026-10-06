const CACHE='equipe-athle-v12';
const SHELL=['/','/index.html','/app.js','/core.mjs','/season.mjs','/community-core.mjs','/style.css','/layout.css','/calendar.css','/community.css','/manifest.webmanifest','/puc-logo.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 event.respondWith(fetch(event.request).then(response=>{
  if(response.ok)event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,response.clone())));
  return response;
 }).catch(()=>caches.match(event.request).then(cached=>cached||Response.error())));
});
