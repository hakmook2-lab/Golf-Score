/* 골프 스코어 v2 - 서비스워커
   - 앱 파일: 버전별 캐시 → 신호 약한 골프장에서도 즉시 실행(오프라인 OK)
   - 새 버전: 백그라운드로 받아 두고, 앱에서 [업데이트]를 누르면 적용
   - 위성사진 타일: 한 번 본 곳은 저장(최대 약 3,000장)
   ※ 앱 파일을 고치면 아래 VERSION 을 반드시 올려 주세요. */
var VERSION='golfscore-v3.12.1';
var TILE_CACHE='golfscore-tiles-v1';
var FILES=['./','index.html','i18n.js','app.js','geo.js','data.js','courses-idx.js','manifest.webmanifest',
  'icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png',
  'leaflet.js','leaflet.css','layers.png','layers-2x.png',
  'marker-icon.png','marker-icon-2x.png','marker-shadow.png'];

self.addEventListener('install',function(e){
  e.waitUntil(caches.open(VERSION).then(function(c){
    return c.addAll(FILES.map(function(f){ return new Request(f,{cache:'reload'}); }));
  }));
});
self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k!==VERSION && k!==TILE_CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('message',function(e){ if(e.data==='skipWaiting'){ self.skipWaiting(); } });

function trimTiles(){
  caches.open(TILE_CACHE).then(function(c){ c.keys().then(function(ks){
    if(ks.length>3000){ for(var i=0;i<ks.length-2500;i++){ c.delete(ks[i]); } }
  }); });
}
self.addEventListener('fetch',function(e){
  var req=e.request; if(req.method!=='GET'){ return; }
  var url=new URL(req.url);
  /* 위성사진 타일: 캐시 우선 */
  if(url.hostname==='server.arcgisonline.com'){
    e.respondWith(caches.open(TILE_CACHE).then(function(c){
      return c.match(req).then(function(hit){
        if(hit){ return hit; }
        return fetch(req).then(function(res){ if(res&&(res.ok||res.type==='opaque')){ c.put(req,res.clone()); if(Math.random()<0.05){ trimTiles(); } } return res; });
      });
    }));
    return;
  }
  if(url.origin!==location.origin){ return; } /* 지도 검색 서버 등은 그대로 통과 */
  /* 앱 파일: 캐시 우선, 없으면 네트워크 */
  e.respondWith(caches.open(VERSION).then(function(c){
    return c.match(req,{ignoreSearch:true}).then(function(hit){
      if(hit){ return hit; }
      return fetch(req).then(function(res){ if(res&&res.ok){ c.put(req,res.clone()); } return res; })
        .catch(function(){ return req.mode==='navigate' ? c.match('index.html') : Response.error(); });
    });
  }));
});
