/* ============================================================
   골프 스코어 v2 - 지도/거리/온라인 코스 다운로드 (OpenStreetMap)
   - 코스 검색: Nominatim(이름), Overpass(내 주변)
   - 코스 다운로드: Overpass → 홀(파·핸디캡·홀 라인), 그린·벙커·해저드·페어웨이
   - 홀 지도: SVG(오프라인 동작) / 위성지도: Leaflet + Esri World Imagery
   ============================================================ */
var GEO = (function(){
'use strict';

var OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];
var GEO_KEY = 'golfscore.geo.';

/* ---------- 기본 계산 ---------- */
var R = 6371008.8;
function rad(d){ return d*Math.PI/180; }
function dist(a,b){ /* [lat,lon] 두 점 사이 거리(m) */
  var dLat=rad(b[0]-a[0]), dLon=rad(b[1]-a[1]);
  var s=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dLon/2)*Math.sin(dLon/2);
  return 2*R*Math.asin(Math.min(1,Math.sqrt(s)));
}
function proj(o){ /* 기준점 o 기준 평면 좌표(m) 변환기 */
  var kx=Math.cos(rad(o[0]))*111320, ky=110540;
  return {
    xy:function(p){ return [(p[1]-o[1])*kx, (p[0]-o[0])*ky]; },
    ll:function(q){ return [o[0]+q[1]/ky, o[1]+q[0]/kx]; }
  };
}
function centroid(poly){
  var x=0,y=0,n=poly.length;
  for(var i=0;i<n;i++){ x+=poly[i][0]; y+=poly[i][1]; }
  return [x/n, y/n];
}
function lineLen(line){ var t=0; for(var i=1;i<line.length;i++){ t+=dist(line[i-1],line[i]); } return t; }
function inPoly(pt, poly){ /* [lat,lon] 점이 다각형 안에 있는지 */
  var x=pt[1], y=pt[0], inside=false;
  for(var i=0,j=poly.length-1;i<poly.length;j=i++){
    var xi=poly[i][1], yi=poly[i][0], xj=poly[j][1], yj=poly[j][0];
    if(((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/((yj-yi)||1e-12)+xi)){ inside=!inside; }
  }
  return inside;
}
function r6(v){ return Math.round(v*1e6)/1e6; }
function edgeDist(p, poly){ /* 점과 다각형 경계 사이 최소 거리(m) */
  var P=proj(p), best=1e9;
  for(var i=0;i<poly.length-1;i++){
    var a=P.xy(poly[i]), b=P.xy(poly[i+1]), dx=b[0]-a[0], dy=b[1]-a[1], L=dx*dx+dy*dy;
    var t=L?Math.max(0,Math.min(1,-(a[0]*dx+a[1]*dy)/L)):0, x=a[0]+t*dx, y=a[1]+t*dy;
    best=Math.min(best, Math.sqrt(x*x+y*y));
  }
  return best;
}
function simplify(g){ if(g.length<=200){ return g; } var k=Math.ceil(g.length/200), o=[]; for(var i=0;i<g.length;i+=k){ o.push(g[i]); } o.push(g[g.length-1]); return o; }
function toM(v, unit){ return unit==='m' ? v : v/0.9144; }
function fmtD(m, unit){ if(m==null||!isFinite(m)){ return '–'; } return Math.round(toM(m,unit)); }

/* 그린 앞·중앙·뒤: 내 위치 → 그린 중심 직선이 그린 경계와 만나는 점 */
function greenFCB(pos, geoHole){
  if(!pos||!geoHole){ return null; }
  var gc = geoHole.gc || (geoHole.line ? geoHole.line[geoHole.line.length-1] : null);
  if(!gc){ return null; }
  var out={c:dist(pos,gc), f:null, b:null};
  var g=geoHole.green;
  if(g && g.length>2){
    var P=proj(gc), p=P.xy(pos), ts=[];
    for(var i=0;i<g.length;i++){
      var a=P.xy(g[i]), b=P.xy(g[(i+1)%g.length]);
      /* 선분 p→(0,0) 연장선과 변 a-b 교점 */
      var dx=-p[0], dy=-p[1], ex=b[0]-a[0], ey=b[1]-a[1];
      var den=dx*ey-dy*ex; if(Math.abs(den)<1e-9){ continue; }
      var t=((a[0]-p[0])*ey-(a[1]-p[1])*ex)/den;
      var u=((a[0]-p[0])*dy-(a[1]-p[1])*dx)/den;
      if(u>=0&&u<=1&&t>0){ ts.push(t); }
    }
    if(ts.length>=2){
      ts.sort(function(x,y){return x-y;});
      var L=Math.sqrt(p[0]*p[0]+p[1]*p[1]);
      out.f=L*ts[0]; out.b=L*ts[ts.length-1];
    }
  }
  return out;
}

/* ---------- 네트워크 ---------- */
function fetchT(url, opt, ms){
  var ctl = (typeof AbortController!=='undefined') ? new AbortController() : null;
  var t = setTimeout(function(){ if(ctl){ ctl.abort(); } }, ms||45000);
  opt = opt||{}; if(ctl){ opt.signal=ctl.signal; }
  return fetch(url, opt).then(function(r){ clearTimeout(t); return r; }, function(e){ clearTimeout(t); throw e; });
}
function overpass(q, onStatus, ms){
  var i=0;
  function tryNext(lastErr){
    if(i>=OVERPASS.length){ return Promise.reject(lastErr||new Error(TR('서버 응답 없음'))); }
    var url=OVERPASS[i++];
    if(onStatus){ onStatus(TR('지도 서버 연결 중 (')+i+'/'+OVERPASS.length+')'); }
    return fetchT(url, {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'}, body:'data='+encodeURIComponent(q)}, ms||25000)
      .then(function(r){
        if(!r.ok){ throw new Error('HTTP '+r.status); }
        return r.text();
      })
      .then(function(t){
        if(t.charAt(0)!=='{'){ throw new Error(TR('서버 혼잡')); }
        return JSON.parse(t);
      })
      .catch(function(e){ return new Promise(function(res){ setTimeout(res, 800); }).then(function(){ return tryNext(e); }); });
  }
  return tryNext();
}
function nameOf(tags){
  if(!tags){ return ''; }
  return tags['name:ko'] || tags.name || tags['name:en'] || '';
}

/* 연습장·스크린 등 제외 판단 */
var NOT_COURSE=/練習場|打ちっぱなし|インドア|シミュレーション|パークゴルフ|연습장|스크린|실내|파크 ?골프|driving|range|indoor|screen|practice|아카데미|academy|파크골프|park ?golf|미니|mini ?golf|footgolf/i;
function diagM(b){ if(!b){ return null; } return Math.round(dist([b.minlat,b.minlon],[b.maxlat,b.maxlon])); }
function inBounds(p,b,m){ m=m||0; return p[0]>=b.minlat-m&&p[0]<=b.maxlat+m&&p[1]>=b.minlon-m&&p[1]<=b.maxlon+m; }

/* 내 주변 골프장 (+ 코스별 홀 데이터 개수 미리 확인) */
function nearby(lat, lon, radius, onStatus){
  var A='(around:'+radius+','+lat+','+lon+')';
  var q='[out:json][timeout:25];(way["leisure"="golf_course"]'+A+';relation["leisure"="golf_course"]'+A+';)->.c;.c out tags center bb;way["golf"="hole"]'+A+';out tags center;';
  return overpass(q, onStatus).then(function(j){
    var els=j.elements||[];
    var holes=els.filter(function(e){ return e.tags&&e.tags.golf==='hole'&&e.center; });
    var list=[];
    els.forEach(function(e){
      if(!e.tags||e.tags.leisure!=='golf_course'){ return; }
      var t=e.tags, nm=nameOf(t), b=e.bounds||null, c=e.center||{lat:e.lat,lon:e.lon};
      var hs=b?holes.filter(function(h){ return inBounds([h.center.lat,h.center.lon],b,0.0005); }):[];
      var nH=hs.length, nPar=hs.filter(function(h){ return h.tags.par; }).length;
      var dg=diagM(b);
      /* 제외: 이름 없는데 홀 데이터도 없음 / 연습장 / 너무 작은 곳(연습장·스크린) */
      if(!nm && nH<9){ return; }
      if(t.golf==='driving_range'||t.golf==='training'||t.golf==='miniature'){ return; }
      if(nm && NOT_COURSE.test(nm) && nH<9){ return; }
      if(dg!=null && dg<350 && nH<9){ return; }
      list.push({type:e.type, id:e.id, name:nm||TR('(이름 미등록 골프장)'), sub:(t.name&&t['name:ko']&&t.name!==t['name:ko'])?t.name:'',
        lat:c.lat, lon:c.lon, bounds:b, dist:dist([lat,lon],[c.lat,c.lon]), nHoles:nH, nPar:nPar, size:dg});
    });
    return list.sort(function(a,b2){ return a.dist-b2.dist; });
  });
}

/* ---------- 이름 검색 ----------
   1) 지역 골프장 목록(인덱스)을 한 번 받아 폰에 저장 → 한글·영문·약칭(CC/GC/컨트리클럽) 모두 즉시 검색
      - 한글 검색: 대한민국 전체 목록 (최초 1회 10~20초, 30일간 저장)
      - 현재 위치를 알면: 주변(약 150km) 목록도 함께 검색
   2) 보조: Nominatim(OSM 주소 검색) */
var IDX_KEY='golfscore.idx.';
var REGIONS={kr:[33.0,124.5,38.7,131.0]};
function hasHangul(s){ return /[ㄱ-힝]/.test(s||''); }
var SUFFIX=/(カントリークラブ|カントリー倶楽部|ゴルフ倶楽部|ゴルフクラブ|ゴルフコース|ゴルフリゾート|ゴルフ場|カントリー|倶楽部|컨트리클럽|컨트리클럽|칸트리클럽|칸트리구락부|컨트리|칸트리|골프앤리조트|골프&리조트|골프리조트|골프클럽|골프장|골프링크스|골프|리조트|클럽|구락부|country ?club|golf ?club|golf ?&? ?resort|golf ?course|golf ?links|golf|club|resort|c\.?c\.?|g\.?c\.?)/gi;
function norm(s){ return String(s||'').toLowerCase().replace(/\(.*?\)/g,' ').replace(/[\s\.\-_·,'’&()]/g,''); }
function core(s){ var c=norm(String(s||'').replace(SUFFIX,' ')); return c||norm(s); }
var CHO='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
function chosung(s){ var o=''; s=String(s||''); for(var i=0;i<s.length;i++){ var c=s.charCodeAt(i); o+=(c>=0xAC00&&c<=0xD7A3)?CHO.charAt(Math.floor((c-0xAC00)/588)):s.charAt(i); } return o; }
function isCho(q){ return /^[ㄱ-ㅎ\s]+$/.test(q||''); }
function idxLoad(key){
  try{ var v=JSON.parse(localStorage.getItem(IDX_KEY+key)||'null'); if(v&&Date.now()-v.t<30*86400000&&v.rows&&v.rows.length){ return v.rows; } }catch(e){}
  if(typeof COURSE_IDX!=='undefined' && COURSE_IDX[key]){ return COURSE_IDX[key]; } /* 앱에 내장된 목록 (인터넷 불필요) */
  return null;
}
function bundled(){ return typeof COURSE_IDX!=='undefined' ? Object.keys(COURSE_IDX) : []; }
function idxSave(key, rows){ try{ localStorage.setItem(IDX_KEY+key, JSON.stringify({t:Date.now(), rows:rows})); }catch(e){} }
function idxFetch(key, bb, onStatus){
  var cached=idxLoad(key); if(cached){ return Promise.resolve(cached); }
  if(onStatus){ onStatus(key==='kr'?TR('대한민국 골프장 목록 받는 중 (최초 1회, 10~20초)'):TR('주변 골프장 목록 받는 중')); }
  var B=bb.join(',');
  var q='[out:json][timeout:90];(way["leisure"="golf_course"]('+B+');relation["leisure"="golf_course"]('+B+'););out tags bb;';
  return overpass(q, onStatus, 50000).then(function(j){
    var rows=[];
    (j.elements||[]).forEach(function(e){
      var t=e.tags||{}, b=e.bounds; if(!b){ return; }
      var nm=t['name:ko']||t.name||''; if(!nm){ return; }
      if(t.golf==='driving_range'||t.golf==='training'||t.golf==='miniature'){ return; }
      if(NOT_COURSE.test(nm)){ return; }
      var bo={minlat:b.minlat,minlon:b.minlon,maxlat:b.maxlat,maxlon:b.maxlon}; if(diagM(bo)<350){ return; }
      var alt=[t.name,t['name:en'],t.alt_name,t.official_name,t.short_name].filter(function(v){ return v&&v!==nm; }).join(' | ');
      rows.push([e.type.charAt(0), e.id, nm, alt, +b.minlat.toFixed(5), +b.minlon.toFixed(5), +b.maxlat.toFixed(5), +b.maxlon.toFixed(5)]);
    });
    if(rows.length){ idxSave(key, rows); }
    return rows;
  });
}
function idxMatch(rows, q, pos){
  var nq=norm(q), cq=core(q); if(!nq){ return []; }
  if(cq.length<2){ cq=nq; } /* 'JGC'처럼 약칭만 남는 경우 전체로 비교 */
  var cho=isCho(q)?nq:null;
  var out=[];
  rows.forEach(function(r){
    var names=[r[2]].concat((r[3]||'').split(' | ')), sc=0;
    names.forEach(function(n){
      if(!n){ return; }
      var nn=norm(n), cn=core(n);
      if(cho){ /* 초성 검색: ㄷㄱ → 대구… */
        var ch=chosung(nn), cc=chosung(cn);
        if(cc===cho){ sc=Math.max(sc,95); } else if(ch.indexOf(cho)===0){ sc=Math.max(sc,85); } else if(cho.length>=2&&ch.indexOf(cho)>=0){ sc=Math.max(sc,65); }
        return;
      }
      if(nn===nq||cn===cq){ sc=Math.max(sc,100); }
      else if(cn.indexOf(cq)===0||nn.indexOf(nq)===0){ sc=Math.max(sc,80); }           /* 앞글자 일치: "대구" → 대구○○CC */
      else if(cq.length>=2 && (nn.indexOf(cq)>=0||cn.indexOf(cq)>=0)){ sc=Math.max(sc,60); } /* 중간 포함 */
      else if(nq.length>=2 && nn.indexOf(nq)>=0){ sc=Math.max(sc,50); }
    });
    if(!sc){ return; }
    var b={minlat:r[4],minlon:r[5],maxlat:r[6],maxlon:r[7]}, c=[(r[4]+r[6])/2,(r[5]+r[7])/2];
    out.push({type:r[0]==='w'?'way':'relation', id:r[1], name:r[2], sub:r[3]?r[3].split(' | ')[0]:'', lat:c[0], lon:c[1], bounds:b, size:diagM(b),
      dist:pos?dist(pos,c):null, score:sc});
  });
  out.sort(function(a,b2){ return (b2.score-a.score)||((a.dist||0)-(b2.dist||0))||(norm(a.name).length-norm(b2.name).length); });
  return out;
}
/* 저장된 목록에서만 즉시 검색 (입력하는 동안) */
function quick(q, pos){
  var all=[], seen={};
  bundled().concat(pos&&!inBundle(pos)?[regionKey(pos)]:[]).forEach(function(k){
    var rows=idxLoad(k); if(!rows){ return; }
    idxMatch(rows,q,pos).forEach(function(x){ var id=x.type.charAt(0)+x.id; if(!seen[id]){ seen[id]=1; all.push(x); } });
  });
  all.sort(function(a,b){ return (b.score-a.score)||((a.dist||0)-(b.dist||0)); });
  return all.slice(0,30);
}
function nominatim(q){
  var url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=20&accept-language=ko,en&q='+encodeURIComponent(q);
  return fetchT(url, {headers:{'Accept':'application/json'}}, 8000).then(function(r){
    if(!r.ok){ throw new Error('HTTP '+r.status); }
    return r.json();
  }).then(function(arr){
    var out=[];
    (arr||[]).forEach(function(x){
      if(x.osm_type!=='way' && x.osm_type!=='relation'){ return; }
      if(!(x.category==='leisure'&&x.type==='golf_course')){ return; }
      if(NOT_COURSE.test(x.name||'')){ return; }
      var bb=x.boundingbox, b=bb?{minlat:+bb[0],maxlat:+bb[1],minlon:+bb[2],maxlon:+bb[3]}:null;
      if(b && diagM(b)<350){ return; }
      out.push({type:x.osm_type, id:x.osm_id, name:(x.name||x.display_name.split(',')[0]), sub:x.display_name, lat:+x.lat, lon:+x.lon, bounds:b, size:diagM(b), score:40});
    });
    return out;
  });
}
/* 통합 검색: pos = 현재/마지막 위치(없으면 null)
   onPartial(list): 결과가 하나씩 도착할 때마다 바로 화면에 보여 주기 위한 콜백 */
function search(q, pos, onStatus, onPartial){
  var jobs=[], seen={}, all=[];
  function publish(){ all.sort(function(a,b){ return (b.score-a.score)||((a.dist||0)-(b.dist||0)); }); if(onPartial){ onPartial(all.slice(0,30)); } }
  function add(list){ list.forEach(function(x){ var k=x.type.charAt(0)+x.id; if(!seen[k]){ seen[k]=1; all.push(x); } }); publish(); }
  add(quick(q,pos)); /* 저장된 목록: 즉시 */
  if(prefetching){ jobs.push(prefetching.then(function(){ add(quick(q,pos)); })); }
  if(pos && !inBundle(pos) && !prefetching){
    var key=regionKey(pos);
    if(!idxLoad(key)){ jobs.push(idxFetch(key, regionBB(pos), onStatus).then(function(rows){ add(idxMatch(rows,q,pos)); }).catch(function(){})); }
  }
  if(!isCho(q)){
    jobs.push(nominatim(q).then(add).catch(function(){}));
    if(!hasHangul(q)){ jobs.push(nominatim(q+' golf').then(add).catch(function(){})); }
  }
  return Promise.all(jobs).then(function(){ publish(); return all.slice(0,30); });
}
function inKR(p){ return p[0]>33&&p[0]<38.7&&p[1]>124.5&&p[1]<131; }
function inSEA(p){ return p[0]>-11&&p[0]<7&&p[1]>94&&p[1]<142; }
function inBundle(p){ return inKR(p)||inSEA(p); }
function regionKey(p){ return 'p'+Math.round(p[0])+'_'+Math.round(p[1]); }
function regionBB(p){ return [p[0]-1.4,p[1]-1.4,p[0]+1.4,p[1]+1.4].map(function(v){ return +v.toFixed(3); }); }
/* 앱 시작 시 백그라운드로 목록 미리 받기 (한 번 받으면 30일 저장) */
var prefetching=null;
function prefetch(pos){
  if(prefetching){ return prefetching; }
  var jobs=[];
  if(pos && !inBundle(pos) && !idxLoad(regionKey(pos))){ jobs.push(idxFetch(regionKey(pos), regionBB(pos)).catch(function(){})); }
  prefetching=Promise.all(jobs).then(function(){ prefetching=null; });
  return prefetching;
}
function isPrefetching(){ return !!prefetching; }
/* 내장 목록에서 주변 골프장 (인터넷 불필요) */
function nearIdx(lat, lon, radius){
  var pos=[lat,lon], out=[], seen={};
  bundled().concat([regionKey(pos)]).forEach(function(k){
    (idxLoad(k)||[]).forEach(function(r){
      var id=r[0]+r[1]; if(seen[id]){ return; }
      var c=[(r[4]+r[6])/2,(r[5]+r[7])/2], d=dist(pos,c); if(d>radius){ return; }
      seen[id]=1;
      out.push({type:r[0]==='w'?'way':'relation', id:r[1], name:r[2], sub:r[3]?r[3].split(' | ')[0]:'', lat:c[0], lon:c[1],
        bounds:{minlat:r[4],minlon:r[5],maxlat:r[6],maxlon:r[7]}, dist:d});
    });
  });
  return out.sort(function(a,b){ return a.dist-b.dist; });
}
function idxInfo(){ var n=0; bundled().forEach(function(k){ n+=(idxLoad(k)||[]).length; }); return n; }

/* ---------- 코스 다운로드 ----------
   코스 범위(bbox)로 빠르게 받은 뒤, 코스 경계 안에 있는 것만 남김 (이웃 골프장 섞임 방지) */
function download(type, id, center, bounds, onStatus){
  var sel=type+'('+id+')';
  function run(b){
    var m=0.0015, bb=[b.minlat-m,b.minlon-m,b.maxlat+m,b.maxlon+m].map(function(v){ return v.toFixed(6); }).join(',');
    var q='[out:json][timeout:40];(way["golf"]('+bb+');relation["golf"]('+bb+');node["golf"="pin"]('+bb+');way["natural"="water"]('+bb+');)->.f;.f out geom;'+sel+';out geom tags;';
    return overpass(q, onStatus).then(function(j){ return parse(j.elements||[], type, id, center, b); });
  }
  if(bounds){ return run(bounds); }
  /* 범위를 모르면 먼저 코스 범위만 조회 */
  return overpass('[out:json][timeout:20];'+sel+';out tags center bb;', onStatus).then(function(j){
    var e=(j.elements||[])[0];
    if(e&&e.bounds){ if(!center&&e.center){ center=[e.center.lat,e.center.lon]; } return run(e.bounds); }
    if(!center){ throw new Error(TR('범위 없음')); }
    var d=0.009; return run({minlat:center[0]-d,maxlat:center[0]+d,minlon:center[1]-d*1.2,maxlon:center[1]+d*1.2});
  });
}

function geomOf(e){ /* way/relation → 다각형·선 목록 */
  var out=[];
  if(e.type==='way' && e.geometry){ out.push(e.geometry.map(function(p){ return [r6(p.lat), r6(p.lon)]; })); }
  if(e.type==='relation' && e.members){
    e.members.forEach(function(m){
      if(m.type==='way' && m.geometry && m.role!=='inner'){ out.push(m.geometry.map(function(p){ return [r6(p.lat), r6(p.lon)]; })); }
    });
  }
  return out;
}
function refOf(tags){
  var s=(tags.ref||'')+'';
  var m=s.match(/\d+/);
  if(!m && tags.name){ m=(tags.name+'').match(/(\d+)/); }
  return m?parseInt(m[1]||m[0],10):null;
}
var FT={bunker:'b', water_hazard:'w', lateral_water_hazard:'w', fairway:'f', green:'g', tee:'t'};

function parse(els, type, id, center, bnd){
  var info=null, holes=[], feats=[], pins=[], outline=[];
  els.forEach(function(e){
    var t=e.tags||{};
    if(e.type===type && e.id===id){ info=e; outline=geomOf(e); return; }
    if(t.golf==='hole' && e.type==='way' && e.geometry){
      holes.push({ref:refOf(t), par:parseInt(t.par,10)||null, si:parseInt(t.handicap,10)||null,
        line:e.geometry.map(function(p){ return [r6(p.lat), r6(p.lon)]; }), name:t.name||''});
      return;
    }
    if(t.golf==='pin' && e.type==='node'){ pins.push({ref:refOf(t), p:[r6(e.lat), r6(e.lon)]}); return; }
    var k = t.golf ? FT[t.golf] : (t.natural==='water' ? 'w' : null);
    if(!k){ return; }
    geomOf(e).forEach(function(g){ if(g.length>2){ feats.push({t:k, g:g}); } });
  });
  /* 이 골프장 경계 안의 것만 (경계 50m 여유) */
  var polys=outline.filter(function(g){ return g.length>3; });
  function near(p){
    if(polys.length){ return polys.some(function(g){ return inPoly(p,g) || edgeDist(p,g)<50; }); }
    return bnd ? inBounds(p,bnd,0.0005) : true;
  }
  holes=holes.filter(function(h){ var mid=h.line[Math.floor(h.line.length/2)]; return near(mid); });
  feats=feats.filter(function(f){ return near(centroid(f.g)); });
  pins=pins.filter(function(p){ return near(p.p); });
  var name = info ? nameOf(info.tags) : '';
  var c = center || (info && info.center ? [info.center.lat, info.center.lon] : null);
  if(!c && bnd){ c=[r6((bnd.minlat+bnd.maxlat)/2), r6((bnd.minlon+bnd.maxlon)/2)]; }
  if(!c && holes.length){ c=holes[0].line[0]; }

  /* 홀 번호 정리 */
  var noRef = holes.filter(function(h){ return h.ref==null; }).length;
  if(noRef){ /* 번호 없는 홀은 뒤에 차례로 번호 부여 */
    var used={}; holes.forEach(function(h){ if(h.ref!=null){ used[h.ref]=1; } });
    var n=1; holes.forEach(function(h){ if(h.ref==null){ while(used[n]){ n++; } h.ref=n; used[n]=1; h.guessRef=true; } });
  }
  var byRef={};
  holes.forEach(function(h){ if(!byRef[h.ref]){ byRef[h.ref]=h; } });

  /* 그린 연결 */
  var greens=feats.filter(function(f){ return f.t==='g'; });
  Object.keys(byRef).forEach(function(k){
    var h=byRef[k], end=h.line[h.line.length-1], best=null, bd=1e9;
    greens.forEach(function(g){
      if(inPoly(end,g.g)){ best=g; bd=0; return; }
      var d=dist(end, centroid(g.g)); if(d<bd){ bd=d; best=g; }
    });
    if(best && bd<70){ h.green=best.g; h.gc=centroid(best.g).map(r6); }
    else { h.gc=end; }
    var pin=pins.filter(function(p){ return p.ref===h.ref; })[0];
    if(pin){ h.gc=pin.p; }
    h.len=Math.round(lineLen(h.line));
    if(!h.par){ h.par = h.len<=230 ? 3 : (h.len<=430 ? 4 : 5); h.parEst=true; }
  });

  /* 파일 크기 줄이기: 홀 주변 없는 지형은 제외 */
  var box=null;
  holes.forEach(function(h){ h.line.forEach(function(p){
    if(!box){ box=[p[0],p[1],p[0],p[1]]; }
    box[0]=Math.min(box[0],p[0]); box[1]=Math.min(box[1],p[1]); box[2]=Math.max(box[2],p[0]); box[3]=Math.max(box[3],p[1]);
  }); });
  if(box){
    var m=0.004;
    feats=feats.filter(function(f){ return f.g.some(function(p){ return p[0]>box[0]-m&&p[0]<box[2]+m&&p[1]>box[1]-m&&p[1]<box[3]+m; }); });
  }
  return {src:'osm', osmType:type, osmId:id, name:name, center:c, fetched:Date.now(), outline:polys.map(simplify),
    holes:byRef, refs:Object.keys(byRef).map(Number).sort(function(a,b){return a-b;}), feats:feats, noRef:noRef};
}

/* 다운로드 결과 → 앱 코스 객체 */
function toCourse(g, idHint, nameHint){
  var refs=g.refs, max=refs.length?refs[refs.length-1]:0, n=refs.length;
  var c={id:idHint||('osm'+g.osmType.charAt(0)+g.osmId), name:nameHint||g.name||TR('다운로드한 골프장'), area:TR('OSM 지도 데이터'), custom:true, osm:true,
    ll:g.center, geoRefBase:1, src:''};
  var warn=[];
  function H(r){ return g.holes[r]; }
  function parArr(rs){ return rs.map(function(r){ return H(r)?H(r).par:4; }); }
  var estCount=refs.filter(function(r){ return H(r).parEst; }).length;
  if(n===0){
    c.par=PAR_STD.slice(); c.si=null; c.unverified=true;
    warn.push(TR('홀 데이터가 없는 골프장입니다. 위성지도만 사용 가능하며, 파는 표준 배치로 넣었습니다.'));
  } else if(max>18 && n>=19){
    var k=Math.ceil(max/9), NM='ABCDEFGH';
    c.nines=[];
    for(var i=0;i<k;i++){
      var rs=[]; for(var j=1;j<=9;j++){ rs.push(i*9+j); }
      var p=parArr(rs), si=rs.map(function(r){ return H(r)&&H(r).si; });
      var si9=null;
      if(si.every(function(v){ return v; })){
        var srt=si.slice().sort(function(a,b){return a-b;});
        si9=si.map(function(v){ return srt.indexOf(v)+1; });
        if(new Set(si9).size!==9){ si9=null; }
      }
      c.nines.push({k:NM.charAt(i), name:(i+1)+TR('코스 (')+(i*9+1)+'~'+(i*9+9)+TR('번)'), par:p, si9:si9, geoRefs:rs,
        unverified: rs.some(function(r){ return !H(r)||H(r).parEst; })});
    }
    warn.push(k*9+TR('홀 골프장으로 받아 9홀 코스 ')+k+TR('개로 나눴습니다. 코스 이름은 실제 카드를 보고 확인해 주세요.'));
  } else {
    var r18=[]; for(var z=1;z<=18;z++){ r18.push(z); }
    if(max<=9){ /* 9홀 골프장: 두 바퀴 */
      r18=r18.map(function(z){ return z>9?z-9:z; });
      warn.push(TR('9홀 골프장이라 10~18번은 1~9번을 한 번 더 도는 것으로 넣었습니다.'));
    }
    c.par=parArr(r18);
    c.geoRefs=r18;
    var si18=r18.map(function(r){ return H(r)&&H(r).si; });
    c.si = (max>9 && si18.every(function(v){return v;}) && new Set(si18).size===18) ? si18 : null;
    var miss=r18.filter(function(r){ return !H(r); });
    if(miss.length){ warn.push(TR('지도에 없는 홀(')+miss.filter(function(v,i,a){return a.indexOf(v)===i;}).join(', ')+TR('번)은 파4로 넣었습니다.')); }
    c.unverified = estCount>0 || miss.length>0;
    c.yd={map:r18.map(function(r){ return H(r)?Math.round(H(r).len/0.9144):null; })};
  }
  if(estCount){ warn.push(TR('파 정보가 없는 ')+estCount+TR('개 홀은 지도상 길이로 파를 추정했습니다(⚠).')); }
  if(g.noRef){ warn.push(TR('홀 번호가 없는 ')+g.noRef+TR('개 홀은 순서를 추정했습니다.')); }
  if(n && !c.si && !c.nines){ warn.push(TR('홀 핸디캡 정보가 없어 네트 계산은 총 핸디캡 차감 방식으로만 됩니다.')); }
  c.src=TR('OpenStreetMap 기여자 데이터 (')+new Date(g.fetched).toISOString().slice(0,10)+TR(' 다운로드)');
  c.warn=warn;
  return c;
}

/* ---------- 저장 ---------- */
function saveGeo(courseId, g){
  try{ localStorage.setItem(GEO_KEY+courseId, JSON.stringify(g)); return true; }
  catch(e){ return false; }
}
var cache={};
function loadGeo(courseId){
  if(!courseId){ return null; }
  if(cache[courseId]!==undefined){ return cache[courseId]; }
  var g=null; try{ g=JSON.parse(localStorage.getItem(GEO_KEY+courseId)||'null'); }catch(e){}
  cache[courseId]=g; return g;
}
function dropGeo(courseId){ try{ localStorage.removeItem(GEO_KEY+courseId); }catch(e){} delete cache[courseId]; }
function setCache(courseId,g){ cache[courseId]=g; }

/* ---------- 홀 지도 (SVG) ---------- */
function holeSVG(geo, ref, o){
  o=o||{};
  var h = geo && geo.holes ? geo.holes[ref] : null;
  if(!h){ return null; }
  var unit=o.unit||'yd';
  var tee=h.line[0], gc=o.pin||h.gc||h.line[h.line.length-1];
  var P=proj(tee);
  var g=P.xy(gc), b=Math.atan2(g[0], g[1]); /* 방위각 */
  var cs=Math.cos(b), sn=Math.sin(b);
  function T(ll){ var q=P.xy(ll); return [q[0]*cs - q[1]*sn, q[0]*sn + q[1]*cs]; }
  function Tinv(q){ var x=q[0]*cs + q[1]*sn, y=-q[0]*sn + q[1]*cs; return P.ll([x,y]); }
  var pts=h.line.map(T).concat((h.green||[]).map(T)); pts.push(T(gc));
  var minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;
  pts.forEach(function(p){ minX=Math.min(minX,p[0]); maxX=Math.max(maxX,p[0]); minY=Math.min(minY,p[1]); maxY=Math.max(maxY,p[1]); });
  var halfW=Math.max(60,(maxX-minX)/2+45), cx=(minX+maxX)/2;
  minX=cx-halfW; maxX=cx+halfW; minY-=25; maxY+=35;
  var W=maxX-minX, Hh=maxY-minY;
  function S(p){ return [(p[0]-minX).toFixed(1), (maxY-p[1]).toFixed(1)]; }
  function inside(p){ return p[0]>minX-40&&p[0]<maxX+40&&p[1]>minY-40&&p[1]<maxY+40; }
  var order={f:1,t:2,w:3,b:4,g:5}, col={f:'var(--fair)',t:'var(--tee)',w:'var(--water)',b:'var(--sand)',g:'var(--green)'};
  var shapes=(geo.feats||[]).map(function(f){ return {t:f.t, p:f.g.map(T)}; })
    .filter(function(f){ return f.p.some(inside); })
    .sort(function(a,b2){ return order[a.t]-order[b2.t]; });
  var s='<svg viewBox="0 0 '+W.toFixed(1)+' '+Hh.toFixed(1)+'" style="max-height:46vh" preserveAspectRatio="xMidYMid meet" data-holemap="1">';
  s+='<rect width="100%" height="100%" fill="var(--rough)"/>';
  shapes.forEach(function(f){
    s+='<polygon points="'+f.p.map(function(p){ return S(p).join(','); }).join(' ')+'" fill="'+col[f.t]+'" stroke="rgba(0,0,0,.25)" stroke-width="0.6"/>';
  });
  /* 그린 기준 거리 원 (100·150·200) */
  var G=S(T(gc)), step=unit==='m'?1:0.9144;
  [100,150,200].forEach(function(d){
    var rr=d*step;
    s+='<circle cx="'+G[0]+'" cy="'+G[1]+'" r="'+rr.toFixed(1)+'" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="0.8" stroke-dasharray="4 4"/>';
    var ly=(+G[1]+rr); if(ly<Hh-4){ s+='<text x="'+(+G[0]+3)+'" y="'+(ly-2).toFixed(1)+'" font-size="9" fill="#fff" opacity=".85">'+d+'</text>'; }
  });
  s+='<polyline points="'+h.line.map(function(p){ return S(T(p)).join(','); }).join(' ')+'" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="5 4" opacity=".9"/>';
  var Tt=S(T(tee));
  s+='<rect x="'+(Tt[0]-5)+'" y="'+(Tt[1]-3)+'" width="10" height="6" rx="1.5" fill="#fff"/>';
  s+='<line x1="'+G[0]+'" y1="'+G[1]+'" x2="'+G[0]+'" y2="'+(G[1]-16)+'" stroke="#fff" stroke-width="1.2"/><polygon points="'+G[0]+','+(G[1]-16)+' '+(+G[0]+9)+','+(G[1]-12.5)+' '+G[0]+','+(G[1]-9)+'" fill="#e53935"/>';
  if(o.pos){
    var pp=T(o.pos);
    if(inside(pp)){ var Q=S(pp); s+='<circle cx="'+Q[0]+'" cy="'+Q[1]+'" r="5" fill="#1e88e5" stroke="#fff" stroke-width="2"/>'; }
  }
  s+='<g id="tapMark"></g></svg>';
  return {svg:s, len:h.len, par:h.par, meta:{Tinv:Tinv, T:T, S:S, minX:minX, maxY:maxY, gc:gc, tee:tee}};
}
/* SVG 탭 → 좌표 */
function svgTapLL(svg, evt, meta){
  var pt=svg.createSVGPoint(); pt.x=evt.clientX; pt.y=evt.clientY;
  var m=svg.getScreenCTM(); if(!m){ return null; }
  var q=pt.matrixTransform(m.inverse());
  var local=[q.x+meta.minX, meta.maxY-q.y];
  return {ll:meta.Tinv(local), sx:q.x, sy:q.y};
}

/* ---------- 위성지도 (Leaflet) ---------- */
var LM=null, layers=null, posMarker=null, clickCb=null;
function sat(el){
  if(typeof L==='undefined'){ return null; }
  if(LM){ return LM; }
  LM=L.map(el,{zoomControl:true, attributionControl:true, maxZoom:20});
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {maxNativeZoom:19, maxZoom:20, attribution:'Esri, Maxar, Earthstar Geographics'}).addTo(LM);
  layers=L.layerGroup().addTo(LM);
  LM.on('click', function(e){ if(clickCb){ clickCb([e.latlng.lat, e.latlng.lng]); } });
  return LM;
}
function satShow(o){
  var m=sat(o.el); if(!m){ return false; }
  setTimeout(function(){ m.invalidateSize(); }, 60);
  layers.clearLayers();
  var col={f:'#b6f5a0',t:'#ffffff',w:'#64b5f6',b:'#ffe082',g:'#76ff03'};
  var geo=o.geo, h=geo&&o.ref!=null?geo.holes[o.ref]:null;
  if(geo && geo.outline){ geo.outline.forEach(function(g){ L.polyline(g,{color:'#ffffff',weight:2,opacity:0.7,interactive:false}).addTo(layers); }); }
  if(geo && geo.feats){
    geo.feats.forEach(function(f){
      L.polygon(f.g,{color:col[f.t], weight:1, fillOpacity:f.t==='g'?0.25:0.08, interactive:false}).addTo(layers);
    });
  }
  if(h){
    L.polyline(h.line,{color:'#fff', weight:2, dashArray:'6 6', interactive:false}).addTo(layers);
    var b=L.latLngBounds(h.line); if(h.green){ b.extend(h.green); }
    m.fitBounds(b.pad(0.25));
  } else if(geo && geo.outline && geo.outline.length && !o.zoom){
    m.fitBounds(L.latLngBounds([].concat.apply([],geo.outline)).pad(0.05));
  } else if(o.center){
    m.setView(o.center, o.zoom||16);
  }
  if(o.pin){ L.circleMarker(o.pin,{radius:7,color:'#fff',weight:2,fillColor:'#e53935',fillOpacity:1}).addTo(layers); }
  clickCb=o.onClick||null;
  return true;
}
function satPos(p){
  if(!LM){ return; }
  if(!p){ if(posMarker){ LM.removeLayer(posMarker); posMarker=null; } return; }
  if(!posMarker){ posMarker=L.circleMarker(p,{radius:7,color:'#fff',weight:2,fillColor:'#1e88e5',fillOpacity:1}).addTo(LM); }
  else { posMarker.setLatLng(p); }
}
function satMark(p, txt){
  if(!LM||!layers){ return; }
  if(satMark._m){ layers.removeLayer(satMark._m); }
  satMark._m=L.circleMarker(p,{radius:6,color:'#000',weight:1,fillColor:'#ffeb3b',fillOpacity:1}).addTo(layers);
  if(txt){ satMark._m.bindTooltip(txt,{permanent:true,direction:'top'}).openTooltip(); }
}
function satCenter(p){ if(LM){ LM.panTo(p); } }

return {nearIdx:nearIdx, inBundle:inBundle, prefetch:prefetch, isPrefetching:isPrefetching, quick:quick, chosung:chosung, isCho:isCho, hasHangul:hasHangul, idxInfo:idxInfo, norm:norm, core:core, idxMatch:idxMatch, dist:dist, fmtD:fmtD, toM:toM, greenFCB:greenFCB, nearby:nearby, search:search, download:download, toCourse:toCourse,
  saveGeo:saveGeo, loadGeo:loadGeo, dropGeo:dropGeo, setCache:setCache, holeSVG:holeSVG, svgTapLL:svgTapLL,
  satShow:satShow, satPos:satPos, satMark:satMark, satCenter:satCenter, lineLen:lineLen};
})();
