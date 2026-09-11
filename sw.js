const CACHE='pet-shell-v2';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./','./index.html','./style.css','./study.css','./core.js','./audio.js','./study.js','./vocabulary.json','./materials.json','./manifest.webmanifest'])));});
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));});
