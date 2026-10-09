/* ============================================================
   골프 스코어 v2 - 앱 본체
   ============================================================ */
(function(){
'use strict';
var VERSION='3.5.0';

/* ================= 상태 ================= */
var KEY='golfscore.v1';
var S={ver:2,current:null,rounds:[],pars:{},custom:[],names:[],hcps:[],lastCourse:null,lastN:1,greens:{},
  set:{unit:'yd',contrast:'normal',theme:'auto',wake:true,voice:true,fx:true,cur:'IDR',hideInstall:false,lastBackup:0,backupCount:0,gps:false,mapOn:true,me:'',badgeGap:'auto'}};
var UI={tab:'round',setup:null,openHist:null,openCourse:null,modal:null,pos:null,acc:null,search:null,dl:null,statP:'all',tap:null,gp:0};
var modalCbs=[];

function load(){
  try{
    var v=JSON.parse(localStorage.getItem(KEY)||'null');
    if(v){ for(var k in v){ if(k==='set'){ for(var s in v.set){ S.set[s]=v.set[s]; } } else { S[k]=v[k]; } } }
  }catch(e){}
  migrate();
}
function migrate(){
  /* v1 → v2: Rainbow Hills 3개 조합 → 27홀 모듈 */
  if(S.pars['rh-fm'] && !S.pars['rh:F']){ S.pars['rh:F']=S.pars['rh-fm'].slice(0,9); }
  else if(S.pars['rh-sf'] && !S.pars['rh:F']){ S.pars['rh:F']=S.pars['rh-sf'].slice(9,18); }
  ['rh-ms','rh-fm','rh-sf','lotuslakes'].forEach(function(k){ if(S.pars[k] && k!=='lotuslakes'){ delete S.pars[k]; } });
  if(S.pars.lotuslakes && S.pars.lotuslakes.length===18){ delete S.pars.lotuslakes; }
  if(S.lastCourse && /^rh-/.test(S.lastCourse)){ S.lastCourse='rh'; }
  if(!S.greens){ S.greens={}; }
  if(!S.hcps){ S.hcps=[]; }
  (S.rounds||[]).forEach(fixRound);
  if(S.current){ fixRound(S.current); }
  S.ver=2;
}
function fixRound(r){ /* v1 기록 호환 */
  if(!r.order){ r.order=[]; for(var i=0;i<18;i++){ r.order.push(i); } }
  if(!r.holesN){ r.holesN=r.order.length; }
  if(!r.labels){ r.labels=[]; for(var j=0;j<18;j++){ r.labels.push(''+(j+1)); } }
  if(!r.putts){ r.putts=r.players.map(function(){ return new Array(18).fill(null); }); }
  if(!r.fir){ r.fir=new Array(18).fill(null); }
  if(!r.pen){ r.pen=new Array(18).fill(null); }
  if(!r.hcp){ r.hcp=r.players.map(function(){ return null; }); }
  if(!r.bet){ r.bet={mode:'none',unit:10000,net:false}; }
  if(!r.cost){ r.cost={}; }
  if(!r.cur){ r.cur='IDR'; }
  if(!r.undo){ r.undo=[]; }
}
var saveT=null;
function save(){
  try{ localStorage.setItem(KEY, JSON.stringify(S)); }
  catch(e){ toast(TR('저장 공간이 부족합니다. 코스 지도 데이터를 일부 지워 주세요.')); }
}

/* ================= 유틸 ================= */
function $(s){ return document.querySelector(s); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function sum(a){ var t=0; for(var i=0;i<a.length;i++){ t+=(a[i]||0); } return t; }
function today(){ var d=new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); }
function fmtDiff(d){ return d===0?'E':(d>0?'+'+d:''+d); }
function money(v, cur){ if(v==null||isNaN(v)){ return '–'; } var s=Math.round(Math.abs(v)).toString().replace(/\B(?=(\d{3})+(?!\d))/g,','); return (v<0?'-':'')+s+(cur==='KRW'?TR('원'):(cur==='JPY'?TR('엔'):' Rp')); }
function num(s){ var d=String(s||'').replace(/[^0-9]/g,''); return d?parseInt(d,10):null; }
/* ================= 축하 효과 (파 이하) ================= */
/* 단계: 1 파 → 작은 꽃가루 / 2 버디 → 양쪽 꽃가루 대포 / 3 이글 → 불꽃놀이 / 4 알바트로스·홀인원 → 대형 불꽃 + 금빛 비 */
var FX={timer:null, raf:null, cv:null, parts:[], rockets:[], until:0};
function fxTier(s,par){ if(s==null){ return 0; } var d=s-par; if(s===1||d<=-3){ return 4; } if(d===-2){ return 3; } if(d===-1){ return 2; } if(d===0){ return 1; } return 0; }
function queueFx(r,p,h,delay){
  clearTimeout(FX.timer);
  FX.timer=setTimeout(function(){
    if(S.set.fx===false){ return; }
    var s=r.scores[p]&&r.scores[p][h]; var t=fxTier(s,r.par[h]); if(!t){ return; }
    if(!r.fx){ r.fx={}; }
    var k=p+'-'+h; if(r.fx[k]===s){ return; }   /* 같은 홀·같은 점수는 한 번만 */
    r.fx[k]=s; save();
    celebrate(t, relName(s-r.par[h],s,r.par[h]), r.players.length>1?r.players[p]:'');
  }, delay==null?60:delay);
}
function celebrate(tier,word,who){
  var reduce=false; try{ reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}
  try{ if(navigator.vibrate){ navigator.vibrate([[30],[40,60,40],[60,80,60,80,120],[80,60,80,60,80,60,200]][tier-1]); } }catch(e){}
  fxBanner(tier,word,who);
  if(reduce){ return; }
  var cv=FX.cv;
  if(!cv){ cv=FX.cv=document.createElement('canvas'); cv.id='fxCanvas'; document.body.appendChild(cv); }
  var dpr=Math.min(2,window.devicePixelRatio||1), W=window.innerWidth, H=window.innerHeight;
  cv.width=W*dpr; cv.height=H*dpr; cv.style.display='block';
  var g=cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0);
  var COL=['#ffd23f','#3b82f6','#ef4444','#22c55e','#a855f7','#f97316','#ffffff'], GOLD=['#ffd700','#ffcc33','#fff2a8','#e6b800'];
  function conf(x,y,ang,spd,cols){ FX.parts.push({x:x,y:y,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,g:0.18,dr:0.985,w:6+Math.random()*5,h:4+Math.random()*4,rot:Math.random()*6,vr:(Math.random()-.5)*0.4,c:cols[(Math.random()*cols.length)|0],life:90+Math.random()*60,t:0,k:'c'}); }
  function spark(x,y,c,n,spd){ for(var i=0;i<n;i++){ var a=Math.PI*2*i/n+Math.random()*0.2, v=spd*(0.6+Math.random()*0.5); FX.parts.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,g:0.06,dr:0.975,r:2+Math.random()*1.5,c:c,life:55+Math.random()*30,t:0,k:'s'}); } }
  function rocket(delay,cols){ FX.rockets.push({x:W*(0.15+Math.random()*0.7),y:H+10,vy:-(H*0.018+Math.random()*4),ty:H*(0.15+Math.random()*0.3),d:delay,c:cols[(Math.random()*cols.length)|0]}); }
  var i;
  if(tier===1){ for(i=0;i<45;i++){ conf(W/2,H*0.62,-Math.PI/2+(Math.random()-.5)*1.4,6+Math.random()*6,COL); } }
  if(tier>=2){ var n=tier===2?70:90; for(i=0;i<n;i++){ conf(0,H*0.75,-Math.PI/3+(Math.random()-.5)*0.7,9+Math.random()*8,tier===4?GOLD.concat(COL):COL); conf(W,H*0.75,-Math.PI*2/3+(Math.random()-.5)*0.7,9+Math.random()*8,tier===4?GOLD.concat(COL):COL); } }
  if(tier===3){ for(i=0;i<5;i++){ rocket(i*14,COL); } }
  if(tier===4){ for(i=0;i<12;i++){ rocket(i*10,GOLD.concat(['#ef4444','#3b82f6','#ffffff'])); } for(i=0;i<120;i++){ FX.parts.push({x:Math.random()*W,y:-20-Math.random()*H*0.6,vx:(Math.random()-.5)*1.5,vy:2+Math.random()*2,g:0.03,dr:0.995,w:6+Math.random()*5,h:4+Math.random()*4,rot:Math.random()*6,vr:(Math.random()-.5)*0.3,c:GOLD[(Math.random()*GOLD.length)|0],life:200+Math.random()*80,t:0,k:'c'}); } }
  FX.until=Date.now()+[0,1600,2400,3400,5200][tier];
  if(FX.raf){ return; }
  (function loop(){
    g.clearRect(0,0,W,H);
    for(var j=FX.rockets.length-1;j>=0;j--){
      var k=FX.rockets[j]; if(k.d>0){ k.d--; continue; }
      k.y+=k.vy; k.vy*=0.985;
      g.fillStyle=k.c; g.beginPath(); g.arc(k.x,k.y,3,0,7); g.fill();
      g.fillStyle='rgba(255,255,255,.35)'; g.fillRect(k.x-1,k.y+4,2,12);
      if(k.y<=k.ty||k.vy>-1.5){ spark(k.x,k.y,k.c,tier===4?80:60,tier===4?7:6); spark(k.x,k.y,'#ffffff',16,3); FX.rockets.splice(j,1); }
    }
    for(var q=FX.parts.length-1;q>=0;q--){
      var o=FX.parts[q]; o.t++; o.vx*=o.dr; o.vy=o.vy*o.dr+o.g; o.x+=o.vx; o.y+=o.vy;
      var al=Math.max(0,1-o.t/o.life); if(al<=0||o.y>H+40){ FX.parts.splice(q,1); continue; }
      g.globalAlpha=al; g.fillStyle=o.c;
      if(o.k==='c'){ o.rot+=o.vr; g.save(); g.translate(o.x,o.y); g.rotate(o.rot); g.fillRect(-o.w/2,-o.h/2,o.w,o.h*Math.abs(Math.cos(o.rot*1.7))+1); g.restore(); }
      else { g.beginPath(); g.arc(o.x,o.y,o.r,0,7); g.fill(); }
      g.globalAlpha=1;
    }
    if(FX.parts.length||FX.rockets.length||Date.now()<FX.until){ FX.raf=requestAnimationFrame(loop); }
    else { FX.raf=null; g.clearRect(0,0,W,H); cv.style.display='none'; }
  })();
}
function fxBanner(tier,word,who){
  var old=document.getElementById('fxBanner'); if(old){ old.parentNode.removeChild(old); }
  var b=document.createElement('div'); b.id='fxBanner'; b.className='t'+tier;
  var ic=['','⛳','🐦','🦅','🏆'][tier], ex=['','!','!','!!','!!!'][tier];
  b.innerHTML=(who?'<small>'+esc(who)+'</small>':'')+'<span class="ic">'+ic+'</span><b>'+esc(word)+ex+'</b>';
  document.body.appendChild(b);
  setTimeout(function(){ if(b.parentNode){ b.className+=' out'; setTimeout(function(){ if(b.parentNode){ b.parentNode.removeChild(b); } },400); } }, [0,1100,1700,2600,4200][tier]);
}
/* ================= 홀 결과 한마디 (화면 표시) ================= */
/* 다음 홀로 넘어갈 때: 첫 번째 플레이어(나) 점수로 한마디 */
function cheerMsg(d){
  if(d<=-1){ return TR('와우 대박입니다'); }
  if(d===0){ return TR('축하합니다'); }
  if(d===1){ return TR('나쁘지 않습니다'); }
  if(d===2){ return TR('분발하세요'); }
  return TR('연습이 필요합니다.');
}
function cheerHole(r,h,showToast){
  var s=r.scores[0]&&r.scores[0][h]; if(s==null){ return; }
  if(!r.cheered){ r.cheered={}; }
  if(r.cheered[h]===s){ return; }  /* 같은 점수로 이미 말했으면 반복하지 않음 */
  r.cheered[h]=s;
  var m=cheerMsg(s-r.par[h]);
  if(showToast){ toast((s-r.par[h]<=-1?'🎉 ':'')+m,1800); }
}
/* ================= 하단 고정 이전/다음 버튼 ================= */
function renderDock(){
  var bar=$('#actBar'); if(!bar){ return; }
  var r=S.current, on=UI.tab==='round'&&!!r;
  document.body.classList.toggle('dock',on);
  if(!on){ bar.style.display='none'; bar.innerHTML=''; layoutDock(); return; }
  var N=r.order.length, last=r.idx===N-1, h=r.order[r.idx];
  bar.innerHTML='<button class="btn ghost" data-act="prev"'+(r.idx===0?' disabled':'')+TR('>◀ 이전</button>')+
    '<button class="btn" data-act="'+(last?'finish':'next')+'"'+(last?' data-cheer="1"':'')+'>'+(last?TR('라운드 종료 ✔'):TR('다음 홀 ▶'))+
    '<small>'+esc(r.labels[h])+' / '+N+'</small></button>';
  bar.style.display='grid';
  layoutDock();
}
function layoutDock(){
  var bar=$('#actBar'), tabs=$('#tabs'); if(!bar||!tabs){ return; }
  var fromBottom=Math.max(0,window.innerHeight-tabs.getBoundingClientRect().top);
  bar.style.bottom=fromBottom+'px';
  var dock=fromBottom+(bar.style.display==='none'?0:bar.offsetHeight);
  document.documentElement.style.setProperty('--dock',dock+'px');
}
window.addEventListener('resize',function(){ layoutDock(); });
function toast(m,ms){ var t=$('#toast'); t.textContent=m; t.className=UI.modal?'on top':'on'; clearTimeout(toast._t); toast._t=setTimeout(function(){ t.className=''; }, ms||2000); }
function buzz(){ try{ if(navigator.vibrate){ navigator.vibrate(8); } }catch(e){} }
function range(a,b){ var o=[]; for(var i=a;i<b;i++){ o.push(i); } return o; }
function unitName(){ return S.set.unit==='m'?'m':'yd'; }

/* ================= 코스 ================= */
function allCourses(){ return COURSES.concat(S.custom||[]); }
function courseOf(id){ var a=allCourses(); for(var i=0;i<a.length;i++){ if(a[i].id===id){ return a[i]; } } return null; }
function parsOf(c){ return (S.pars && S.pars[c.id]) ? S.pars[c.id] : c.par; }
function ninePar(c,n){ var k=c.id+':'+n.k; return (S.pars && S.pars[k]) ? S.pars[k] : n.par; }
function nineEdited(c,n){ return !!(S.pars && S.pars[c.id+':'+n.k]); }
function courseWarn(c){
  if(c.nines){ return c.nines.some(function(n){ return n.unverified && !nineEdited(c,n); }); }
  return !!(c.unverified && !(S.pars && S.pars[c.id]));
}
function coursePar(c){
  if(c.nines){ return c.nines.map(function(n){ return n.name+' '+sum(ninePar(c,n)); }).join(' · '); }
  return 'Par '+sum(parsOf(c));
}
function grpOf(c){ return c.fav?'fav':(c.gg?'gg':(c.osm?'osm':(c.custom?'custom':'etc'))); }
var GRP_NAME={fav:TR('★ 자주 가는 코스'),gg:TR('GoGolf 프로모션 코스'),etc:TR('기타 코스'),osm:TR('🌐 다운로드한 골프장'),custom:TR('직접 추가한 코스')};
var GRP_ORDER={fav:0,gg:1,osm:2,custom:3,etc:4};
function sortedCourses(){
  return allCourses().slice().sort(function(a,b){ return GRP_ORDER[grpOf(a)]-GRP_ORDER[grpOf(b)]; });
}
function mapUrl(c){
  var g=GEO.loadGeo(c.id), ll=c.ll||(g&&g.center);
  if(ll){ return 'https://www.google.com/maps/@'+ll[0]+','+ll[1]+',17z/data=!3m1!1e3'; }
  return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent((c.name||'')+' golf');
}

/* 라운드용 18칸 데이터 만들기 */
function buildLayout(c, s){
  var out={par:[],si:null,yd:null,labels:[],geoRefs:[],nineNames:null};
  if(c.nines){
    var f=c.nines.filter(function(n){ return n.k===s.front; })[0]||c.nines[0];
    var b=c.nines.filter(function(n){ return n.k===s.back; })[0]||c.nines[1]||c.nines[0];
    var fi=c.nines.indexOf(f), bi=c.nines.indexOf(b);
    out.par=ninePar(c,f).concat(ninePar(c,b));
    out.si=(f.si9&&b.si9)? f.si9.map(function(v){ return v*2-1; }).concat(b.si9.map(function(v){ return v*2; })) : null;
    out.labels=range(0,9).map(function(i){ return f.k+(i+1); }).concat(range(0,9).map(function(i){ return b.k+(i+1); }));
    out.geoRefs=(f.geoRefs||range(fi*9+1,fi*9+10)).concat(b.geoRefs||range(bi*9+1,bi*9+10));
    out.nineNames=[f.name,b.name];
    if(f.yd&&b.yd){ out.yd={}; for(var t in f.yd){ if(b.yd[t]){ out.yd[t]=f.yd[t].concat(b.yd[t]); } } }
  } else {
    out.par=parsOf(c).slice(); out.si=c.si?c.si.slice():null; out.yd=c.yd||null;
    out.labels=range(0,18).map(function(i){ return ''+(i+1); });
    out.geoRefs=c.geoRefs?c.geoRefs.slice():range(1,19);
  }
  return out;
}

/* ================= 점수 계산 ================= */
function relName(d,score,par){
  if(score===1){ return TR('홀인원'); }
  if(d<=-3){ return TR('알바트로스'); }
  if(d===-2){ return TR('이글'); }
  if(d===-1){ return TR('버디'); }
  if(d===0){ return TR('파'); }
  if(d===1){ return TR('보기'); }
  if(d===2){ return TR('더블보기'); }
  var dp=(par!=null&&score===par*2);
  if(d===3){ return dp?TR('트리플보기 · 더블파'):TR('트리플보기'); }
  if(dp){ return TR('더블파'); }
  if(d===4){ return TR('쿼드러플보기'); }
  return '';
}
function relCls(d){ if(d<=-2){ return 'e'; } if(d===-1){ return 'b'; } if(d===0){ return 'p'; } if(d===1){ return 'g'; } return 'd'; }

/* 핸디캡 타수 배분 (플레이한 홀의 홀 핸디캡 순) */
function strokes(r,p){
  var hc=r.hcp&&r.hcp[p]; var out=new Array(18).fill(0);
  if(hc==null||!r.si){ return null; }
  var H=r.holesN===9?Math.round(hc/2):hc;
  var hs=r.order.slice().sort(function(a,b){ return r.si[a]-r.si[b]; }), n=hs.length;
  hs.forEach(function(h,i){ out[h]=Math.floor(H/n)+(i<(H%n)?1:0); });
  return out;
}
function stats(r,p){
  var o={tot:0,parSum:0,n:0,putts:0,pn:0,sf:0,nsf:null,e:0,b:0,p:0,g:0,d:0,net:null,gir:0,girN:0,fir:0,firN:0,pen:0};
  var st=strokes(r,p); if(st){ o.nsf=0; }
  r.order.forEach(function(h){
    var s=r.scores[p][h];
    if(s!=null){
      var d=s-r.par[h];
      o.tot+=s; o.parSum+=r.par[h]; o.n++; o.sf+=Math.max(0,2-d);
      if(st){ o.nsf+=Math.max(0,2-(d-st[h])); }
      o[relCls(d)]++;
      var pt=r.putts[p][h];
      if(pt!=null){ o.girN++; if(s-pt<=r.par[h]-2){ o.gir++; } }
    }
    var pt2=r.putts[p][h]; if(pt2!=null){ o.putts+=pt2; o.pn++; }
    if(p===0){
      if(r.fir[h]!=null && r.par[h]>3){ o.firN++; if(r.fir[h]==='hit'){ o.fir++; } }
      if(r.pen[h]){ o.pen+=r.pen[h]; }
    }
  });
  o.diff=o.tot-o.parSum;
  var hc=r.hcp&&r.hcp[p];
  if(hc!=null && o.n){
    if(st){ var rec=0; r.order.forEach(function(h){ if(r.scores[p][h]!=null){ rec+=st[h]; } }); o.net=o.tot-rec; }
    else { o.net=o.tot-(r.holesN===9?Math.round(hc/2):hc); }
  }
  return o;
}
function half(r,p,a,b){
  var t=0,n=0;
  for(var h=a;h<=b;h++){ if(r.order.indexOf(h)<0){ continue; } var s=r.scores[p][h]; if(s!=null){ t+=s; n++; } }
  return n?t:null;
}
function blocks(r){ var b=[]; if(r.order.some(function(h){return h<9;})){ b.push(0); } if(r.order.some(function(h){return h>=9;})){ b.push(1); } return b; }

/* 내기 정산 */
function betCalc(r){
  var n=r.players.length, bal=new Array(n).fill(0), bet=r.bet||{mode:'none'}, unit=bet.unit||0, pairs=[], note='';
  if(bet.mode==='none'||n<2){ return null; }
  var st=r.players.map(function(_,p){ return bet.net?strokes(r,p):null; });
  if(bet.net && st.some(function(x){ return !x; })){ note=TR('네트 적용: 핸디캡 또는 홀 핸디캡 정보가 없는 플레이어는 그로스로 계산'); }
  function sc(p,h){ var s=r.scores[p][h]; if(s==null){ return null; } return s-(st[p]?st[p][h]:0); }
  var done=r.order.filter(function(h){ for(var p=0;p<n;p++){ if(r.scores[p][h]==null){ return false; } } return true; });
  if(bet.mode==='stroke'){
    for(var i=0;i<n;i++){ for(var j=i+1;j<n;j++){
      var D=0; done.forEach(function(h){ D+=sc(j,h)-sc(i,h); });
      bal[i]+=D*unit; bal[j]-=D*unit; pairs.push({a:i,b:j,d:D});
    } }
  } else if(bet.mode==='skins'){
    var carry=1, won=new Array(n).fill(0);
    done.forEach(function(h){
      var best=1e9, who=[];
      for(var p=0;p<n;p++){ var v=sc(p,h); if(v<best){ best=v; who=[p]; } else if(v===best){ who.push(p); } }
      if(who.length===1){ var w=who[0]; won[w]+=carry; bal[w]+=(n-1)*unit*carry; for(var q=0;q<n;q++){ if(q!==w){ bal[q]-=unit*carry; } } carry=1; }
      else { carry++; }
    });
    pairs=won; if(carry>1){ note=(note?note+' · ':'')+TR('마지막 ')+(carry-1)+TR('홀 무승부 이월분은 미정산'); }
  }
  return {bal:bal, pairs:pairs, done:done.length, note:note, mode:bet.mode};
}

/* ================= 설치 / 환경 ================= */
var deferredPrompt=null;
var UA=navigator.userAgent||'';
function isIOS(){ return /iPad|iPhone|iPod/.test(UA)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1); }
function isAndroid(){ return /Android/i.test(UA); }
function isKakao(){ return /KAKAOTALK/i.test(UA); }
function isInApp(){ return isKakao()||/NAVER\(inapp|Line\/|FBAN|FBAV|Instagram|DaumApps|Claude|; wv\)|WhatsApp|Telegram/i.test(UA); }
function isSafariIOS(){ return isIOS()&&/Safari\//.test(UA)&&!/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(UA)&&!isInApp(); }
function isOtherIOSBrowser(){ return isIOS()&&/CriOS|FxiOS|EdgiOS/.test(UA)&&!isInApp(); }
function isStandalone(){ try{ return navigator.standalone===true||window.matchMedia('(display-mode: standalone)').matches||window.matchMedia('(display-mode: fullscreen)').matches; }catch(e){ return false; } }
function appUrl(){ return location.href.split('#')[0].split('?')[0]; }

window.addEventListener('beforeinstallprompt',function(e){ e.preventDefault(); deferredPrompt=e; showInstallBar(); });
window.addEventListener('appinstalled',function(){ deferredPrompt=null; hideInstallBar(); toast(TR('홈 화면에 설치되었어요')); askPersist(); });

function showInstallBar(){
  if(isStandalone()||S.set.hideInstall||location.protocol==='file:'){ return; }
  if(deferredPrompt||isIOS()||isInApp()){ $('#installBar').style.display='block'; }
}
function hideInstallBar(){ $('#installBar').style.display='none'; }
function updateInstallBtn(){ var b=$('#installBtn'); if(b){ b.style.display=isStandalone()?'none':''; } }

function doInstall(){
  var url=appUrl();
  if(isStandalone()){ toast(TR('이미 홈 화면 앱으로 실행 중이에요')); return; }
  if(location.protocol==='file:'){
    openModal(TR('설치하려면 웹 주소가 필요해요'),TR('<p>파일로 연 상태에서는 설치가 되지 않습니다. 앱 폴더를 웹(https)에 올린 뒤 그 주소로 열어 주세요. (README 참고)</p>'),[{label:TR('닫기')}]); return;
  }
  /* 1) 안드로이드 Chrome·삼성인터넷·PC Chrome/Edge: 바로 설치 창 */
  if(deferredPrompt){
    var dp=deferredPrompt; deferredPrompt=null;
    dp.prompt();
    if(dp.userChoice){ dp.userChoice.then(function(r){ toast(r&&r.outcome==='accepted'?TR('설치 중이에요'):TR('설치를 취소했어요')); if(r&&r.outcome==='accepted'){ hideInstallBar(); } }); }
    return;
  }
  /* 2) 카카오톡 인앱 브라우저 → 외부 브라우저로 열기 */
  if(isKakao()){
    location.href='kakaotalk://web/openExternal?url='+encodeURIComponent(url);
    setTimeout(function(){ toast(TR('Safari/Chrome에서 열린 화면에서 다시 [앱 설치]를 누르세요'),3500); },600);
    return;
  }
  /* 2-1) LINE 인앱 브라우저 → 외부 브라우저로 열기 (LINE 공식 파라미터) */
  if(/Line\//i.test(UA)){
    location.href=location.origin+location.pathname+'?openExternalBrowser=1';
    setTimeout(function(){ toast(TR('Safari/Chrome에서 열린 화면에서 다시 [앱 설치]를 누르세요'),3500); },600);
    return;
  }
  /* 3) 안드로이드 기타 인앱 브라우저 → Chrome으로 열기 */
  if(isAndroid() && isInApp()){
    location.href='intent://'+location.host+location.pathname+'#Intent;scheme=https;package=com.android.chrome;end';
    return;
  }
  /* 4) 아이폰 */
  if(isIOS()){
    if(isSafariIOS()){ showIosGuide('safari'); return; }
    if(isOtherIOSBrowser()){ showIosGuide('other'); return; }
    openModal(TR('Safari에서 열어 주세요'),TR('<p>지금 화면(앱 안의 브라우저)에서는 홈 화면 설치가 안 됩니다.</p><ol><li><b>링크 복사</b>를 누릅니다.</li><li><b>Safari</b>를 열고 주소창에 붙여 넣습니다.</li><li>이 앱의 <b>[📲 앱 설치]</b> 버튼을 누르고 안내를 따릅니다.</li></ol>'),
      [{label:TR('닫기'),cls:'ghost'},{label:TR('링크 복사'),fn:function(){ copyText(url); }}]);
    return;
  }
  /* 5) 안드로이드: 설치 창이 준비 안 된 경우 */
  if(isAndroid()){
    var samsung=/SamsungBrowser/i.test(UA);
    openModal(TR('홈 화면에 설치'),
      samsung?TR('<ol><li>하단 <b>≡ 메뉴</b>를 누릅니다.</li><li><b>현재 페이지 추가 → 홈 화면</b>을 누릅니다.</li></ol>')
             :TR('<ol><li>오른쪽 위 <b>⋮ 메뉴</b>를 누릅니다.</li><li><b>앱 설치</b> 또는 <b>홈 화면에 추가 → 설치</b>를 누릅니다.</li></ol><p class="note">메뉴에 "앱 설치"가 없으면 이미 설치되어 있거나, 페이지를 새로고침한 뒤 몇 초 후 다시 시도하세요.</p>'),
      [{label:TR('확인')}]);
    return;
  }
  openModal(TR('PC에 설치'),TR('<p>Chrome/Edge 주소창 오른쪽의 <b>설치 아이콘(⊕)</b>을 누르세요. 폰에 설치하려면 이 주소를 폰에서 여세요.</p>'),
    [{label:TR('닫기'),cls:'ghost'},{label:TR('링크 복사'),fn:function(){ copyText(url); }}]);
}
function showIosGuide(kind){
  var g=$('#iosGuide');
  var ver=(UA.match(/OS (\d+)_/)||[])[1]; ver=ver?parseInt(ver,10):0;
  var steps;
  if(kind==='other'){
    steps=TR('<li>주소창 오른쪽 <span class="shareic">↑</span> <b>공유</b> 버튼을 누릅니다.</li><li><b>홈 화면에 추가</b>를 누릅니다. (없으면 목록을 아래로 내리거나 "더 보기")</li><li>오른쪽 위 <b>추가</b>를 누르면 끝.</li>');
  } else {
    steps=(ver>=26?TR('<li>화면 아래 <b>···</b> 버튼(또는 <span class="shareic">↑</span> 공유)을 누릅니다.</li><li><b>공유</b> → 목록을 아래로 내려 <b>홈 화면에 추가</b>를 누릅니다.</li>')
                  :TR('<li>화면 아래 가운데 <span class="shareic">↑</span> <b>공유</b> 버튼을 누릅니다.</li><li>목록을 아래로 내려 <b>홈 화면에 추가</b>를 누릅니다.</li>'))+
      TR('<li><b>"웹 앱으로 열기"</b>가 켜져 있으면 그대로, 오른쪽 위 <b>추가</b>를 누르면 끝.</li>');
  }
  g.innerHTML=(kind==='other'?'<div class="arrow right">⬆︎</div>':'')+
    TR('<div class="box"><b>📲 아이폰 홈 화면에 설치 (10초)</b><ol>')+steps+'</ol>'+
    TR('<p class="note" style="margin:8px 0 0">Apple 정책상 웹 앱은 버튼 한 번으로 자동 설치할 수 없어, 공유 메뉴에서 한 번만 눌러 주시면 됩니다. 설치 후에는 <b>홈 화면 아이콘</b>으로 여세요(기록이 안전하게 보관됩니다).</p>')+
    TR('<div class="row" style="margin-top:10px"><button class="btn block" data-act="iosGuideClose">알겠어요</button></div></div>')+
    (kind!=='other'?(ver>=26?'<div class="arrow right">⬇︎</div>':'<div class="arrow">⬇︎</div>'):'');
  g.style.display='flex';
}
function askPersist(){
  try{ if(navigator.storage&&navigator.storage.persist){ navigator.storage.persist().then(function(ok){ S.set.persisted=!!ok; save(); }); } }catch(e){}
}

/* ================= 화면 꺼짐 방지 ================= */
var wakeLock=null;
function wantWake(){ return S.set.wake && S.current && document.visibilityState==='visible'; }
function syncWake(){
  if(!('wakeLock' in navigator)){ return; }
  if(wantWake()){
    if(!wakeLock){ navigator.wakeLock.request('screen').then(function(l){ wakeLock=l; l.addEventListener('release',function(){ wakeLock=null; }); }).catch(function(){}); }
  } else if(wakeLock){ try{ wakeLock.release(); }catch(e){} wakeLock=null; }
}
document.addEventListener('visibilitychange', syncWake);

/* ================= GPS ================= */
var watchId=null;
function gpsOn(){
  if(!navigator.geolocation){ toast(TR('이 기기는 위치 기능을 지원하지 않아요')); return; }
  if(watchId!=null){ return; }
  watchId=navigator.geolocation.watchPosition(function(p){
    UI.pos=[p.coords.latitude,p.coords.longitude]; UI.acc=p.coords.accuracy;
    GEO.satPos(UI.pos); liveUpdate();
  }, function(err){
    toast(err.code===1?TR('위치 권한이 거부되었어요. 브라우저 설정에서 허용해 주세요.'):TR('위치를 가져오지 못했어요'),3000);
    gpsOff(true);
  }, {enableHighAccuracy:true, maximumAge:3000, timeout:20000});
  S.set.gps=true; save();
}
function gpsOff(keep){ if(watchId!=null){ navigator.geolocation.clearWatch(watchId); watchId=null; } UI.pos=null; GEO.satPos(null); if(!keep){ S.set.gps=false; save(); } else { S.set.gps=false; save(); } }
var liveT=0;
function liveUpdate(){
  var now=Date.now(); if(now-liveT<1500){ return; } liveT=now;
  if(UI.tab!=='round'||!S.current||UI.modal){ return; }
  var d=$('#distPanel'); if(d){ d.innerHTML=distHtml(S.current); }
  var m=$('#holeMapBox'); if(m){ m.innerHTML=holeMapInner(S.current); }
}

/* ================= 지도 보조 ================= */
function geoOf(r){ return GEO.loadGeo(r.courseId); }
function refOf(r,h){ return r.geoRefs ? r.geoRefs[h] : h+1; }
function pinOf(courseId, ref){ return (S.greens[courseId]||{})[ref]||null; }
function geoHole(r,h){ var g=geoOf(r); return g&&g.holes ? g.holes[refOf(r,h)] : null; }
function distHtml(r){
  var h=r.order[r.idx], gh=geoHole(r,h), pin=pinOf(r.courseId, refOf(r,h));
  if(!gh && !pin){
    return UI.pos ? TR('<button class="btn ghost block sm" style="margin-top:10px" data-act="pinHere">📍 지금 그린 위라면 → 여기를 ')+esc(r.labels[h])+TR('번 그린으로 저장</button><div class="note" style="text-align:center;margin-top:4px">한 번 저장하면 다음 라운드부터 이 홀 거리가 나옵니다.</div>') : '';
  }
  var u=S.set.unit;
  if(!UI.pos){
    return TR('<button class="btn sec block sm" style="margin-top:10px" data-act="gpsToggle">📍 GPS 켜고 그린까지 거리 보기</button>')+
      (gh?TR('<div class="note" style="text-align:center;margin-top:6px">지도상 티→그린 약 ')+GEO.fmtD(gh.len,u)+unitName()+'</div>':'');
  }
  var t = pin ? {c:GEO.dist(UI.pos,pin),f:null,b:null} : GEO.greenFCB(UI.pos, gh);
  if(!t){ return ''; }
  if(t.c>3000){ return TR('<div class="note" style="text-align:center;margin-top:10px">📍 코스에서 떨어져 있어요 (그린까지 ')+(t.c/1000).toFixed(1)+'km)</div>'; }
  return '<div class="dist"><div><b>'+GEO.fmtD(t.f,u)+TR('</b><span>앞</span></div><div><b>')+GEO.fmtD(t.c,u)+TR('</b><span>그린 중앙 (')+unitName()+')</span></div><div><b>'+GEO.fmtD(t.b,u)+TR('</b><span>뒤</span></div></div>')+
    TR('<div class="note" style="text-align:center;margin-top:4px">GPS 오차 약 ±')+Math.round(GEO.toM(UI.acc||0,u))+unitName()+(pin?TR(' · 직접 지정한 그린 위치 기준 <button class="xbtn" data-act="pinHere">현재 위치로 다시 저장</button>'):'')+'</div>';
}
function holeMapInner(r){
  var h=r.order[r.idx], g=geoOf(r), ref=refOf(r,h);
  if(!g||!g.holes||!g.holes[ref]){ return ''; }
  var res=GEO.holeSVG(g, ref, {unit:S.set.unit, pos:UI.pos, pin:pinOf(r.courseId,ref)});
  if(!res){ return ''; }
  UI.holeMeta=res.meta;
  return '<div class="holemap">'+res.svg+TR('<div class="lg"><span style="color:var(--fair)">■</span>페어웨이 <span style="color:var(--sand)">■</span>벙커 <span style="color:var(--water)">■</span>해저드 · 점선 원: 그린까지 100/150/200')+unitName()+'</div><div class="tapinfo" id="tapInfo"></div></div>'+
    TR('<div class="note" style="margin-top:4px">지도를 누르면 그 지점까지 거리가 나옵니다. 지도: © OpenStreetMap 기여자</div>');
}
function yardText(r,h){
  if(!r.yd){ return ''; }
  var t=r.tee||'white';
  if(r.yd[t]&&r.yd[t][h]){ return TEES[t]+' <b>'+r.yd[t][h]+'</b>y'; }
  if(r.yd.black&&r.yd.black[h]){ return TR('블랙 <b>')+r.yd.black[h]+'</b>y'; }
  if(r.yd.map&&r.yd.map[h]){ return TR('지도상 <b>')+r.yd.map[h]+'</b>y'; }
  return '';
}
function teeLabel(r){ return (r&&r.tee&&TEES[r.tee])?TEES[r.tee]+TR(' 티'):''; }
function linkRow(c){
  return '<div class="row wrap" style="margin-top:8px">'+
    '<button class="iconbtn" data-act="satCourse" data-id="'+esc(c.id)+TR('">🛰 위성지도</button>')+
    '<a class="iconbtn" href="'+esc(mapUrl(c))+TR('" target="_blank" rel="noopener">🗺 구글 지도</a>')+
    (c.gps?'<a class="iconbtn" href="'+esc(c.gps)+TR('" target="_blank" rel="noopener">📍 GPS 코스맵 앱</a>'):'')+'</div>';
}

/* ================= 뷰: 라운드 설정 ================= */
function initSetup(){
  var cs=sortedCourses();
  var names=(S.names||[]).slice(0,4); while(names.length<4){ names.push(''); }
  var hc=(S.hcps||[]).slice(0,4); while(hc.length<4){ hc.push(''); }
  var cid=courseOf(S.lastCourse)?S.lastCourse:cs[0].id, c=courseOf(cid);
  UI.setup={courseId:cid,date:today(),n:S.lastN||1,names:names,hcps:hc,start:0,tee:'white',holesN:18,
    front:c.nines?c.nines[0].k:null, back:c.nines?(c.nines[1]||c.nines[0]).k:null};
}
function courseBadge(c){
  if(c.osm&&!courseWarn(c)){ return TR('<span class="badge">🌐 지도 데이터</span>'); }
  if(courseWarn(c)){ return TR('<span class="badge warn">⚠ 홀별 파 미확인 포함</span>'); }
  if(c.custom){ return TR('<span class="badge">사용자 추가</span>'); }
  if(S.pars[c.id]){ return TR('<span class="badge">사용자 수정본</span>'); }
  return TR('<span class="badge">✓ 홀별 파 확인</span>');
}
function courseInfoHtml(c){
  var g=GEO.loadGeo(c.id);
  var t='<div class="row wrap" style="margin-top:10px">'+courseBadge(c)+'<span class="note">'+esc(coursePar(c))+'</span>'+
    (g&&g.refs&&g.refs.length?TR('<span class="badge">🗺 홀 지도 ')+g.refs.length+TR('홀</span>'):'')+'</div>';
  if(courseWarn(c)){ t+=TR('<div class="warnbox">⚠ 표시 홀은 표준 배치/추정값입니다. 실제 스코어카드와 다르면 <b>코스 탭</b>에서 수정해 주세요. (한 번 수정하면 계속 저장)</div>'); }
  t+=linkRow(c);
  return t;
}
function vSetup(){
  if(!UI.setup){ initSetup(); }
  var s=UI.setup, c=courseOf(s.courseId);
  if(!c){ initSetup(); s=UI.setup; c=courseOf(s.courseId); }
  var opts='', lastG='';
  sortedCourses().forEach(function(x){
    var g=grpOf(x);
    if(g!==lastG){ if(lastG){ opts+='</optgroup>'; } opts+='<optgroup label="'+GRP_NAME[g]+'">'; lastG=g; }
    opts+='<option value="'+esc(x.id)+'"'+(x.id===s.courseId?' selected':'')+'>'+esc(x.name)+(courseWarn(x)?' ⚠':'')+'</option>';
  });
  if(lastG){ opts+='</optgroup>'; }
  var nineSel='';
  if(c.nines){
    var mk=function(key,label){
      return '<label class="f">'+label+'</label><div class="row wrap">'+c.nines.map(function(n){
        return '<button class="chip'+(s[key]===n.k?' on':'')+'" data-act="nine" data-k="'+key+'" data-v="'+esc(n.k)+'">'+esc(n.name)+(n.unverified&&!nineEdited(c,n)?' ⚠':'')+'</button>'; }).join('')+'</div>';
    };
    nineSel=mk('front', s.holesN===9?TR('플레이할 9홀 코스'):TR('전반 9홀 코스'))+(s.holesN===18?mk('back',TR('후반 9홀 코스')):'');
  }
  var lay=buildLayout(c,s);
  var teeBtns=['black','blue','white','red'].map(function(k){ return '<button class="chip'+(s.tee===k?' on':'')+'" data-act="tee" data-v="'+k+'">'+TEES[k]+'</button>'; }).join('');
  var nChips=[1,2,3,4].map(function(i){ return '<button class="chip'+(s.n===i?' on':'')+'" data-act="n" data-v="'+i+'">'+i+TR('명</button>'); }).join('');
  var hN=[18,9].map(function(i){ return '<button class="chip'+(s.holesN===i?' on':'')+'" data-act="holesN" data-v="'+i+'">'+i+TR('홀</button>'); }).join('');
  var maxStart=(c.nines&&s.holesN===9)?9:18; if(s.start>=maxStart){ s.start=0; }
  var startBtns=''; for(var sh=0;sh<maxStart;sh++){ startBtns+='<button class="chip'+(s.start===sh?' on':'')+'" data-act="start" data-v="'+sh+'">'+esc(lay.labels[sh])+'</button>'; }
  var inputs='';
  for(var i=0;i<s.n;i++){
    inputs+='<div class="row" style="margin-top:6px"><input class="grow" type="text" data-field="name" data-i="'+i+'" value="'+esc(s.names[i])+'" placeholder="'+(i===0?TR('나'):TR('플레이어 ')+(i+1))+'" maxlength="20">'+
      '<input type="number" inputmode="numeric" data-field="hcp" data-i="'+i+'" value="'+esc(s.hcps[i])+TR('" placeholder="핸디" min="0" max="54" style="width:84px"></div>');
  }
  return TR('<div class="card"><h2>새 라운드</h2>')+
    TR('<label class="f">골프장</label><select data-field="course">')+opts+'</select>'+courseInfoHtml(c)+
    TR('<label class="f">홀 수</label><div class="row wrap">')+hN+'</div>'+nineSel+
    TR('<label class="f">날짜</label><input type="date" data-field="date" value="')+esc(s.date)+'">'+
    TR('<label class="f">플레이어 · 핸디캡(선택)</label><div class="row wrap">')+nChips+'</div>'+inputs+
    TR('<div class="note" style="margin-top:4px">핸디캡을 넣으면 네트 타수·네트 스테이블포드·네트 내기 계산이 됩니다.</div>')+
    TR('<label class="f">티 색상 (기본: 화이트)</label><div class="row wrap">')+teeBtns+'</div>'+
    TR('<label class="f">시작 홀</label><div class="g6">')+startBtns+'</div>'+
    TR('<div class="note" style="margin-top:6px">선택한 홀부터 ')+s.holesN+TR('홀을 순서대로 진행합니다.</div>')+
    TR('<button class="btn block" style="margin-top:18px" data-act="begin">라운드 시작 ▶</button></div>')+
    (S.rounds.length?'':TR('<div class="card"><h2>처음 사용하시나요?</h2><p class="note">① 오른쪽 위 <b>📲 앱 설치</b>로 홈 화면에 설치 → ② 골프장 선택 → ③ 라운드 시작. 목록에 없는 골프장은 <b>코스 탭 → 🌐 골프장 검색·다운로드</b>에서 현장에서 바로 받을 수 있습니다.</p></div>'));
}

/* ================= 뷰: 홀 입력 ================= */
/* 점수 원터치 버튼 (pre='' 본 화면, 'p' 홀 팝업) */
function scoreChips(s,par,p,pre){
  return [['e',TR('이글'),-2],['b',TR('버디'),-1],['p',TR('파'),0],['g',TR('보기'),1],['d',TR('더블보기'),2],['t',TR('트리플보기'),3],['dp',TR('더블파'),null]].map(function(x){
    var on='';
    if(s!=null){
      var dd=s-par;
      if(x[0]==='dp'){ on=(s===par*2)?' on':''; }
      else if(x[0]==='t'){ on=(dd===3&&s!==par*2)?' on':''; }
      else if(x[0]==='d'){ on=(dd===2&&s!==par*2)?' on':''; }
      else { on=(dd===x[2])?' on':''; }
    }
    return '<button class="chip'+on+'" data-act="'+pre+'chip" data-p="'+p+'" data-off="'+(x[0]==='dp'?'dp':x[2])+'">'+x[1]+'</button>';
  }).join('')+'<button class="chip" data-act="'+pre+'clear" data-p="'+p+'"'+(s==null?' disabled style="opacity:.4"':'')+TR('>지우기</button>');
}
function scoreLab(s,par){
  if(s==null){ return {lab:'',cls:''}; }
  var d=s-par; return {lab:relName(d,s,par)+(d!==0&&s!==1?' ('+fmtDiff(d)+')':''), cls:relCls(d)};
}
/* 홀 번호를 눌렀을 때 뜨는 점수 입력 팝업 */
function holePopBody(){
  var r=S.current, o=UI.pop; if(!r||!o){ return ''; }
  var h=r.order[o.i], par=r.par[h], p=o.p, s=r.scores[p][h], L=scoreLab(s,par);
  return '<div class="stepper"><button class="sb" data-act="pinc" data-d="-1">−</button>'+
    '<div class="val"><div class="num">'+(s==null?'–':s)+'</div><div class="lab '+L.cls+'">'+esc(L.lab||TR('첫 탭 = 파'))+'</div></div>'+
    '<button class="sb" data-act="pinc" data-d="1">＋</button></div>'+
    '<div class="chips">'+scoreChips(s,par,p,'p')+'</div>';
}
function gotoIdx(r,i){
  if(i!==r.idx){ cheerHole(r,r.order[r.idx],true); }
  r.idx=i; save(); render(); window.scrollTo(0,0);
}

/* 전 홀 결과 타일: 버튼 자체에 타수·색으로 결과 표시 */
function holeGrid(r){
  var N=r.order.length, P=r.players.length;
  var gp=(UI.gp!=null&&UI.gp<P)?UI.gp:0;
  var out='';
  if(P>1){
    out+='<div class="gpsel">'+r.players.map(function(nm,p){
      return '<button class="chip'+(p===gp?' on':'')+'" data-act="gp" data-v="'+p+'">'+esc(nm)+'</button>'; }).join('')+'</div>';
  }
  var st=stats(r,gp);
  var big=st.n?fmtDiff(st.diff):'–';
  var bigCls=!st.n?'':(st.diff<0?' under':(st.diff===0?' even':' over'));
  var cnt=[['e',TR('이글+ '),st.e],['b',TR('버디 '),st.b],['p',TR('파 '),st.p],['g',TR('보기 '),st.g],['d',TR('더블+ '),st.d]].filter(function(x){ return x[2]; })
    .map(function(x){ return '<span class="cc r-'+x[0]+'">'+esc(x[1].trim())+' <b>'+x[2]+'</b></span>'; });
  out+='<div class="hsum"><div class="big'+bigCls+'">'+big+'</div><div class="txt">'+
    '<div class="l1">'+(st.n?'<b>'+st.tot+'</b>'+TR('타'):'<b class="sm">'+TR('기록 전')+'</b>')+'<span class="dv">·</span><b>'+st.n+'</b>/'+N+TR('홀')+
    (st.net!=null?'<span class="dv">·</span>'+TR(' · 네트 ').replace(/[·\s]/g,'')+' <b>'+st.net+'</b>':'')+'</div>'+
    (cnt.length?'<div class="cnts">'+cnt.join('')+'</div>':'<div class="hint">'+TR('홀 버튼을 누르면 그 홀로 이동합니다')+'</div>')+'</div></div>';
  out+='<div class="hgrid">';
  for(var s0=0;s0<N;s0+=9){
    var t=0,pp=0,n=0;
    for(var i=s0;i<Math.min(N,s0+9);i++){
      var hh=r.order[i], sc=r.scores[gp][hh], pr=r.par[hh];
      var cntP=0; for(var q=0;q<P;q++){ if(r.scores[q][hh]!=null){ cntP++; } }
      var cls='ht'+(sc!=null?' r-'+relCls(sc-pr):' empty')+(i===r.idx?' cur':'')+(P>1&&cntP>0&&cntP<P?' part':'');
      if(sc!=null){ t+=sc; pp+=pr; n++; }
      out+='<button class="'+cls+'" data-act="holePop" data-i="'+i+'" aria-label="'+esc(r.labels[hh])+TR('번 홀')+(sc!=null?' '+sc+TR('타'):'')+'">'+
        '<span class="hl">'+esc(r.labels[hh])+'</span><span class="hp">P'+pr+'</span><b>'+(sc!=null?sc:'–')+'</b></button>';
    }
    var lbl=N<=9?TR('합계'):(s0===0?TR('전반'):TR('후반'));
    out+='<div class="ht tot"><span class="hl">'+lbl+'</span><b>'+(n?t:'–')+'</b><span class="hd">'+(n?fmtDiff(t-pp):'')+'</span></div>';
  }
  out+=TR('</div><div class="hleg"><span><i class="r-e"></i>이글+</span><span><i class="r-b"></i>버디</span><span><i class="r-p"></i>파</span><span><i class="r-g"></i>보기</span><span><i class="r-d"></i>더블+</span>')+
    (P>1?TR('<span><i class="dotm"></i>동반자 미입력</span>'):'')+'</div>';
  return out;
}
function vHole(r){
  var h=r.order[r.idx], par=r.par[h], si=r.si?r.si[h]:null, N=r.order.length;
  var dots=holeGrid(r);
  var g=geoOf(r), gh=geoHole(r,h);
  var tools='<div class="toolrow">'+
    (gh?'<button class="iconbtn'+(S.set.mapOn?' on':'')+TR('" data-act="mapToggle">🗺 홀 지도</button>'):'')+
    TR('<button class="iconbtn" data-act="satHole">🛰 위성지도</button>')+
    '<button class="iconbtn'+(watchId!=null?' on':'')+'" data-act="gpsToggle">📍 GPS</button>'+
    '<button class="iconbtn" data-act="undo"'+(r.undo&&r.undo.length?'':' disabled style="opacity:.4"')+TR('>↶ 실행취소</button></div>');
  var yt=yardText(r,h);
  var out='<div class="card"><div class="hole hrow"><div class="n">'+esc(r.labels[h])+TR('<small>번 홀</small></div>')+
    '<div class="hm"><div class="meta">PAR <b>'+par+'</b>'+(si?' · HCP <b>'+si+'</b>':'')+'</div>'+
    '<div class="no">'+(yt?yt+' · ':(teeLabel(r)?teeLabel(r)+' · ':''))+(r.idx+1)+' / '+N+'</div></div></div>'+
    dots+tools+
    '<div id="distPanel">'+distHtml(r)+'</div>'+
    (gh&&S.set.mapOn?'<div id="holeMapBox">'+holeMapInner(r)+'</div>':'')+
    (!g?TR('<button class="btn ghost block sm" style="margin-top:10px" data-act="geoGetRound">🗺 이 코스 홀 지도 받기 (현재 지도 없음)</button>'):'')+
    '</div>';
  for(var p=0;p<r.players.length;p++){
    var s=r.scores[p][h], pt=r.putts[p][h], st=stats(r,p);
    var lab='', cls='';
    if(s!=null){ var d=s-par; lab=relName(d,s,par)+(d!==0&&s!==1?' ('+fmtDiff(d)+')':''); cls=relCls(d); }
    var chips=scoreChips(s,par,p,'');
    var sumTxt=st.n?(TR('누적 ')+st.tot+TR('타 (')+fmtDiff(st.diff)+')'+(st.net!=null?TR(' · 네트 ')+st.net:'')+' · '+st.n+TR('홀')):TR('아직 입력 없음');
    out+='<div class="card"><div class="pname"><b>'+esc(r.players[p])+(r.hcp[p]!=null?TR(' <small class="note">핸디 ')+r.hcp[p]+'</small>':'')+'</b><span>'+sumTxt+'</span></div>'+
      '<div class="stepper"><button class="sb" data-act="inc" data-p="'+p+TR('" data-d="-1" aria-label="한 타 빼기">−</button>')+
      '<div class="val"><div class="num">'+(s==null?'–':s)+'</div><div class="lab '+cls+'">'+esc(lab||TR('첫 탭 = 파'))+'</div></div>'+
      '<button class="sb" data-act="inc" data-p="'+p+TR('" data-d="1" aria-label="한 타 더하기">＋</button></div>')+
      '<div class="chips">'+chips+'</div></div>';
  }
  var last=r.idx===N-1;
  out+=TR('<div class="row sb" style="margin-top:14px"><button class="xbtn" data-act="finish">지금까지 저장하고 종료</button>')+
    TR('<button class="xbtn" data-act="cancelRound">라운드 삭제</button></div>');
  return out;
}

/* ================= 뷰: 스코어카드 ================= */
function cell(r,p,h){
  var s=r.scores[p][h];
  if(s==null){ return '<td>·</td>'; }
  var c=relCls(s-r.par[h]);
  return '<td>'+(c==='p'?s:'<span class="mk '+c+'">'+s+'</span>')+'</td>';
}
function cardTable(r){
  var bl=blocks(r), head=TR('<tr><th class="sticky">홀</th>'), parR='<tr class="parrow"><td class="sticky">PAR</td>', siR='<tr class="parrow"><td class="sticky">HCP</td>';
  var body='';
  bl.forEach(function(b){
    var a=b*9;
    for(var h=a;h<a+9;h++){ head+='<th>'+esc(r.labels[h])+'</th>'; parR+='<td>'+r.par[h]+'</td>'; siR+='<td>'+(r.si?r.si[h]:'')+'</td>'; }
    head+='<th>'+(b===0?'OUT':'IN')+'</th>'; parR+='<td class="sum">'+sum(r.par.slice(a,a+9))+'</td>'; siR+='<td></td>';
  });
  if(bl.length===2){ head+='<th>TOT</th>'; parR+='<td class="sum">'+sum(r.par)+'</td>'; siR+='<td></td>'; }
  for(var p=0;p<r.players.length;p++){
    body+='<tr><td class="sticky"><b>'+esc(r.players[p])+'</b></td>';
    var tot=null;
    bl.forEach(function(b){
      var a=b*9; for(var h=a;h<a+9;h++){ body+=(r.order.indexOf(h)<0?'<td></td>':cell(r,p,h)); }
      var hv=half(r,p,a,a+8); if(hv!=null){ tot=(tot||0)+hv; }
      body+='<td class="sum">'+(hv==null?'–':hv)+'</td>';
    });
    if(bl.length===2){ body+='<td class="sum">'+(tot==null?'–':tot)+'</td>'; }
    body+='</tr>';
  }
  return '<div class="tw"><table class="sc" style="min-width:'+(bl.length*400+80)+'px"><thead>'+head+'</thead><tbody>'+parR+'</tr>'+(r.si?siR+'</tr>':'')+body+'</tbody></table></div>'+
    TR('<div class="note" style="margin-top:6px">◎ 이글 이하(진파랑) · ● 버디(파랑) · ■ 보기(노랑) · ▣ 더블보기 이상(빨강)</div>');
}
function summaryHtml(r){
  var out='';
  for(var p=0;p<r.players.length;p++){
    var st=stats(r,p);
    out+='<div class="pl">'+esc(r.players[p])+(r.hcp[p]!=null?TR(' <small class="note">핸디 ')+r.hcp[p]+'</small>':'')+'</div><div class="sumgrid">'+
      '<div><b>'+(st.n?st.tot:'–')+TR('</b><span>총타수</span></div>')+
      '<div><b>'+(st.n?fmtDiff(st.diff):'–')+TR('</b><span>파 대비</span></div>')+
      '<div><b>'+(st.net!=null?st.net:'–')+TR('</b><span>네트</span></div>')+
      '<div><b>'+(st.pn?st.putts:'–')+TR('</b><span>퍼트</span></div>')+
      '<div><b>'+(st.n?st.sf:'–')+TR('</b><span>스테이블포드(그로스)</span></div>')+
      '<div><b>'+(st.nsf!=null&&st.n?st.nsf:'–')+TR('</b><span>스테이블포드(네트)</span></div>')+
      '<div><b>'+st.b+'/'+st.e+TR('</b><span>버디/이글+</span></div>')+
      '<div><b>'+st.p+'/'+(st.g+st.d)+TR('</b><span>파/보기+</span></div></div>');
    if(p===0 && (st.girN||st.firN||st.pen)){
      out+='<div class="note" style="margin-top:6px">GIR '+(st.girN?Math.round(st.gir/st.girN*100)+'% ('+st.gir+'/'+st.girN+')':'–')+
        TR(' · 페어웨이 ')+(st.firN?Math.round(st.fir/st.firN*100)+'% ('+st.fir+'/'+st.firN+')':'–')+TR(' · 벌타 ')+st.pen+'</div>';
    }
  }
  return out;
}
function betHtml(r, rid){
  var b=r.bet, n=r.players.length;
  if(n<2){ return ''; }
  var modes=[['none',TR('안 함')],['stroke',TR('타당')],['skins',TR('스킨스')]].map(function(x){
    return '<button class="chip'+(b.mode===x[0]?' on':'')+'" data-act="betMode" data-rid="'+esc(rid)+'" data-v="'+x[0]+'">'+x[1]+'</button>'; }).join('');
  var out=TR('<div class="card"><h2>💰 내기 정산</h2><div class="row wrap">')+modes+'</div>';
  if(b.mode!=='none'){
    out+='<div class="row wrap" style="margin-top:8px">'+['IDR','KRW','JPY'].map(function(k){
      return '<button class="chip'+(r.cur===k?' on':'')+'" data-act="curSet" data-rid="'+esc(rid)+'" data-v="'+k+'">'+(k==='IDR'?TR('루피아(Rp)'):(k==='KRW'?TR('원(₩)'):TR('엔(¥)')))+'</button>'; }).join('')+'</div>';
    out+='<label class="f">'+(b.mode==='stroke'?TR('1타당 금액'):TR('1스킨(홀)당 금액'))+' ('+(r.cur==='KRW'?TR('원'):(r.cur==='JPY'?TR('엔'):'Rp'))+')</label>'+
      '<div class="row"><input type="text" inputmode="numeric" data-bet="unit" data-rid="'+esc(rid)+'" value="'+(b.unit||'')+'" class="grow">'+
      '<button class="chip'+(b.net?' on':'')+'" data-act="betNet" data-rid="'+esc(rid)+TR('">네트 적용</button></div>');
    var c=betCalc(r);
    if(c){
      out+='<table class="kv" style="margin-top:10px">'+r.players.map(function(nm,p){
        var v=c.bal[p]; return '<tr><td>'+esc(nm)+(c.mode==='skins'?' <span class="note">('+c.pairs[p]+TR('스킨)</span>'):'')+'</td><td class="'+(v>0?'pos':(v<0?'neg':''))+'">'+(v>0?'+':'')+money(v,r.cur)+'</td></tr>'; }).join('')+'</table>';
      if(c.mode==='stroke' && n>2){
        out+='<div class="note" style="margin-top:6px">'+c.pairs.map(function(x){ return esc(r.players[x.a])+'↔'+esc(r.players[x.b])+' '+(x.d===0?TR('동타'):Math.abs(x.d)+TR('타 차')); }).join(' · ')+'</div>';
      }
      out+=TR('<div class="note" style="margin-top:6px">전원 입력 완료 ')+c.done+TR('홀 기준')+(c.note?' · '+esc(c.note):'')+'</div>';
    }
  }
  return out+'</div>';
}
function roundDetail(r, rid){
  return cardTable(r)+summaryHtml(r)+
    '<div class="row" style="margin-top:14px"><button class="btn sec grow sm" data-act="share" data-rid="'+esc(rid)+TR('">💬 공유 텍스트</button>')+
    '<button class="btn sec grow sm" data-act="shareImg" data-rid="'+esc(rid)+TR('">🖼 스코어카드 이미지</button></div>');
}
function vCard(){
  var r=S.current;
  if(!r){ return TR('<div class="card"><h2>스코어카드</h2><p class="note">진행 중인 라운드가 없습니다. 라운드 탭에서 새 라운드를 시작하거나, 기록 탭에서 지난 라운드를 확인하세요.</p></div>'); }
  return '<div class="card"><h2>'+esc(r.courseName)+' · '+esc(r.date)+(teeLabel(r)?' · '+teeLabel(r):'')+'</h2>'+roundDetail(r,'cur')+'</div>'+betHtml(r,'cur');
}

/* ================= 뷰: 기록 ================= */
function shareText(r){
  var lines=['⛳ '+r.courseName+' ('+r.date+')'+(teeLabel(r)?' · '+teeLabel(r):'')+(r.holesN===9?TR(' · 9홀'):'')];
  for(var p=0;p<r.players.length;p++){
    var st=stats(r,p), o=half(r,p,0,8), n=half(r,p,9,17);
    lines.push(r.players[p]+' : '+(st.n?st.tot+TR('타 (')+fmtDiff(st.diff)+')':'-')+(st.net!=null?TR(' · 네트 ')+st.net:'')+
      (o!=null?'  OUT '+o:'')+(n!=null?' / IN '+n:'')+(st.pn?TR(' · 퍼트 ')+st.putts:''));
  }
  var c=betCalc(r);
  if(c){ lines.push('💰 '+(c.mode==='stroke'?TR('타당 '):TR('스킨스 '))+money(r.bet.unit,r.cur)+(r.bet.net?TR(' (네트)'):'')); r.players.forEach(function(nm,p){ lines.push('  '+nm+' '+(c.bal[p]>0?'+':'')+money(c.bal[p],r.cur)); }); }
  return lines.join('\n');
}
function findRound(id){
  if(id==='cur'){ return S.current; }
  for(var i=0;i<S.rounds.length;i++){ if(S.rounds[i].id===id){ return S.rounds[i]; } }
  return null;
}
function vHistory(){
  var out='';
  if(!S.rounds.length){ out+=TR('<div class="card"><h2>기록</h2><p class="note">저장된 라운드가 없습니다.</p></div>'); }
  S.rounds.forEach(function(r){
    var open=UI.openHist===r.id;
    var totals=r.players.map(function(nm,p){ var st=stats(r,p); return esc(nm)+' '+(st.n?st.tot+' ('+fmtDiff(st.diff)+')':'-'); }).join(' · ');
    out+='<div class="card"><div class="li" data-act="hist" data-id="'+esc(r.id)+'"><div><div class="t">'+esc(r.courseName)+'</div>'+
      '<div class="s">'+esc(r.date)+(teeLabel(r)?' · '+teeLabel(r):'')+' · '+r.players.length+TR('명 · ')+r.holesN+TR('홀')+(r.partial?TR(' · 일부 홀만 기록'):'')+'</div><div class="s">'+totals+'</div></div><div class="r">'+(open?'▲':'▼')+'</div></div>';
    if(open){
      out+='<div style="margin-top:12px">'+roundDetail(r,r.id)+'</div></div>'+betHtml(r,r.id)+
        '<div class="card"><button class="btn danger block sm" data-act="delHist" data-id="'+esc(r.id)+TR('">이 기록 삭제</button>');
    }
    out+='</div>';
  });
  var since=S.set.lastBackup?Math.floor((Date.now()-S.set.lastBackup)/86400000):null;
  out+=TR('<div class="card"><h2>💾 데이터 백업 / 복원</h2>')+
    TR('<p class="note">기록은 이 폰 안에만 저장됩니다. 폰 교체·앱 삭제에 대비해 백업 파일을 보관하세요. 마지막 백업: <b>')+(since==null?TR('없음'):(since===0?TR('오늘'):since+TR('일 전')))+'</b>'+(S.set.persisted?TR(' · 영구 보관 설정됨'):'')+'</p>'+
    TR('<div class="row"><button class="btn sec grow sm" data-act="backupSave">💾 백업 파일 저장</button><button class="btn sec grow sm" data-act="backupShare">📤 백업 파일 보내기</button></div>')+
    TR('<button class="btn ghost block sm" style="margin-top:8px" data-act="restoreFile">📂 백업 파일에서 복원</button>')+
    TR('<details style="margin-top:10px"><summary class="note">텍스트로 백업/복원 (예전 방식)</summary>')+
    TR('<button class="btn ghost block sm" style="margin-top:8px" data-act="backupCopy">백업 텍스트 복사</button>')+
    TR('<textarea id="restoreBox" style="margin-top:8px" placeholder="백업 텍스트 붙여넣기"></textarea>')+
    TR('<button class="btn ghost block sm" style="margin-top:8px" data-act="restoreText">텍스트로 복원</button></details></div>');
  return out;
}

/* ================= 뷰: 통계 ================= */
function vStats(){
  var list=S.rounds.slice().sort(function(a,b){ return (a.date<b.date)?-1:(a.date>b.date?1:(a.endedAt||0)-(b.endedAt||0)); });
  var yr=today().slice(0,4);
  if(UI.statP==='year'){ list=list.filter(function(r){ return (r.date||'').slice(0,4)===yr; }); }
  var chips=[['all',TR('전체')],['year',yr+TR('년')],['last10',TR('최근 10라운드')]].map(function(x){
    return '<button class="chip'+(UI.statP===x[0]?' on':'')+'" data-act="statP" data-v="'+x[0]+'">'+x[1]+'</button>'; }).join('');
  var full=list.filter(function(r){ return r.holesN===18 && stats(r,0).n===18; });
  if(UI.statP==='last10'){ full=full.slice(-10); list=list.slice(-10); }
  var out=TR('<div class="card"><h2>📊 내 통계 <span class="note">(각 라운드 첫 번째 플레이어 기준)</span></h2><div class="row wrap">')+chips+'</div>';
  if(!list.length){ return out+TR('<p class="note" style="margin-top:10px">아직 기록이 없습니다.</p></div>'); }
  var sc=full.map(function(r){ return stats(r,0); });
  var avg=function(a){ return a.length?(sum(a)/a.length):null; };
  var f1=function(v){ return v==null?'–':(Math.round(v*10)/10); };
  var best=null; full.forEach(function(r,i){ if(best==null||sc[i].tot<best.tot){ best={tot:sc[i].tot,r:r}; } });
  var byPar={3:[],4:[],5:[]}, girA=0,girN=0,firA=0,firN=0,pen=0,birdie=0,puttR=[];
  list.forEach(function(r){
    var st=stats(r,0); girA+=st.gir; girN+=st.girN; firA+=st.fir; firN+=st.firN; pen+=st.pen; birdie+=st.b+st.e;
    r.order.forEach(function(h){ var s=r.scores[0][h]; if(s!=null&&byPar[r.par[h]]){ byPar[r.par[h]].push(s); } });
  });
  full.forEach(function(r,i){ if(sc[i].pn===18){ puttR.push(sc[i].putts); } });
  out+='<div class="statgrid" style="margin-top:12px">'+
    '<div><b>'+list.length+TR('</b><span>라운드 수</span></div>')+
    '<div><b>'+f1(avg(sc.map(function(s){ return s.tot; })))+TR('</b><span>평균 타수(18홀)</span></div>')+
    '<div><b>'+(best?best.tot:'–')+TR('</b><span>베스트</span></div>')+
    '<div><b>'+f1(avg(byPar[3]))+TR('</b><span>파3 평균</span></div>')+
    '<div><b>'+f1(avg(byPar[4]))+TR('</b><span>파4 평균</span></div>')+
    '<div><b>'+f1(avg(byPar[5]))+TR('</b><span>파5 평균</span></div>')+
    '<div><b>'+f1(avg(puttR))+TR('</b><span>평균 퍼트</span></div>')+
    '<div><b>'+(girN?Math.round(girA/girN*100)+'%':'–')+'</b><span>GIR</span></div>'+
    '<div><b>'+(firN?Math.round(firA/firN*100)+'%':'–')+TR('</b><span>페어웨이 안착</span></div>')+
    '<div><b>'+birdie+TR('</b><span>버디 이상</span></div>')+
    '<div><b>'+(list.length?f1(pen/list.length):'–')+TR('</b><span>라운드당 벌타</span></div>')+
    '<div><b>'+f1(avg(sc.map(function(s){ return s.net; }).filter(function(v){ return v!=null; })))+TR('</b><span>평균 네트</span></div></div>');
  if(best){ out+=TR('<div class="note" style="margin-top:8px">베스트: ')+esc(best.r.courseName)+' ('+esc(best.r.date)+')</div>'; }
  /* 추이 그래프 */
  var tr=full.slice(-12).map(function(r){ return stats(r,0).tot; });
  if(tr.length>=2){
    var mn=Math.min.apply(null,tr)-2, mx=Math.max.apply(null,tr)+2, W=300, Hh=90;
    var pts=tr.map(function(v,i){ return [(i/(tr.length-1))*(W-20)+10, Hh-10-((v-mn)/(mx-mn))*(Hh-20)]; });
    out+=TR('<div class="pl">최근 18홀 타수 추이</div><svg viewBox="0 0 ')+W+' '+Hh+'" style="width:100%;height:auto;display:block">'+
      '<polyline points="'+pts.map(function(p){ return p[0].toFixed(1)+','+p[1].toFixed(1); }).join(' ')+'" fill="none" stroke="var(--acc)" stroke-width="2.5"/>'+
      pts.map(function(p,i){ return '<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="3.5" fill="var(--acc)"/><text x="'+p[0].toFixed(1)+'" y="'+(p[1]-7).toFixed(1)+'" font-size="10" text-anchor="middle" fill="var(--ink)">'+tr[i]+'</text>'; }).join('')+'</svg>';
  }
  out+='</div>';
  /* 코스별 */
  var bc={};
  list.forEach(function(r){ var st=stats(r,0); var k=r.courseName; if(!bc[k]){ bc[k]={n:0,t:[],best:null}; } bc[k].n++; if(r.holesN===18&&st.n===18){ bc[k].t.push(st.tot); bc[k].best=bc[k].best==null?st.tot:Math.min(bc[k].best,st.tot); } });
  out+=TR('<div class="card"><h2>코스별 기록</h2><table class="kv"><tr><td class="note">코스</td><td class="note" style="text-align:right">횟수 · 평균 · 베스트</td></tr>')+
    Object.keys(bc).sort(function(a,b){ return bc[b].n-bc[a].n; }).map(function(k){ var x=bc[k];
      return '<tr><td>'+esc(k)+'</td><td>'+x.n+TR('회 · ')+f1(avg(x.t))+' · '+(x.best==null?'–':x.best)+'</td></tr>'; }).join('')+'</table></div>';
  /* 내기 */
  var bet={};
  list.forEach(function(r){ var b=betCalc(r); if(b){ bet[r.cur]=(bet[r.cur]||0)+b.bal[0]; } });
  if(Object.keys(bet).length){
    out+=TR('<div class="card"><h2>내기</h2><table class="kv">')+
      Object.keys(bet).map(function(k){ var v=bet[k]; return TR('<tr><td>내기 누적</td><td class="')+(v>0?'pos':(v<0?'neg':''))+'">'+(v>0?'+':'')+money(v,k)+'</td></tr>'; }).join('')+'</table></div>';
  }
  return out;
}

/* ================= 뷰: 코스 ================= */
function parGrid(pr, si, key, base){
  var hn='',pc='',sc='';
  for(var i=0;i<9;i++){
    hn+='<div class="hn">'+(base+i+1)+'</div>';
    pc+='<button class="pcell" data-act="cyc" data-key="'+esc(key)+'" data-h="'+i+'">'+pr[i]+'</button>';
    sc+='<div class="si">'+(si?si[i]:'')+'</div>';
  }
  return '<div class="g9">'+hn+'</div><div class="g9" data-base="'+base+'" style="margin:2px 0">'+pc+'</div>'+(si?'<div class="g9">'+sc+'</div>':'');
}
function geoSection(c){
  var g=GEO.loadGeo(c.id);
  if(c.pending&&bgDl[c.id]){ return TR('<div class="infobox"><span class="spin"></span> 홀 지도 받는 중… (기다리지 않고 라운드를 시작해도 됩니다)</div>'); }
  if(c.geoFail&&!g){ return TR('<div class="warnbox">지도 서버가 혼잡해 홀 지도를 받지 못했습니다. 스코어 기록에는 지장 없습니다.</div><button class="btn sec block sm" style="margin-top:8px" data-act="geoGet" data-id="')+esc(c.id)+TR('">🗺 홀 지도 다시 받기</button>'); }
  if(g){
    var nb=(g.feats||[]).filter(function(f){ return f.t==='b'; }).length, nw=(g.feats||[]).filter(function(f){ return f.t==='w'; }).length, ng=(g.feats||[]).filter(function(f){ return f.t==='g'; }).length;
    return TR('<div class="infobox">🗺 홀 지도 데이터: <b>')+(g.refs||[]).length+TR('홀</b> · 그린 ')+ng+TR(' · 벙커 ')+nb+TR(' · 해저드 ')+nw+' ('+new Date(g.fetched).toISOString().slice(0,10)+')<br>'+
      TR('<span class="note">홀 화면에서 코스 모양·벙커·해저드와 GPS 거리가 표시됩니다.</span></div>')+
      '<div class="row wrap" style="margin-top:8px"><button class="btn ghost sm" data-act="geoGet" data-id="'+esc(c.id)+TR('">다시 받기</button><button class="btn ghost sm" data-act="geoDrop" data-id="')+esc(c.id)+TR('">지도 데이터 지우기</button></div>');
  }
  return TR('<div class="infobox">🗺 이 코스의 홀 지도(코스 모양·벙커·해저드)와 GPS 거리 데이터를 인터넷에서 받을 수 있습니다. (OpenStreetMap, 무료)</div>')+
    '<button class="btn sec block sm" style="margin-top:8px" data-act="geoGet" data-id="'+esc(c.id)+TR('">🗺 홀 지도 데이터 받기</button>');
}
function vCourseDetail(c){
  var out='<div class="card"><div class="row sb"><h2 style="margin:0">'+esc(c.name)+TR('</h2><button class="iconbtn" data-act="courseClose">닫기</button></div>')+courseInfoHtml(c)+
    '<p class="note" style="margin-top:8px">'+esc(c.src||'')+'</p>';
  if(c.warn&&c.warn.length){ out+='<div class="warnbox">'+c.warn.map(esc).join('<br>')+'</div>'; }
  if(c.custom){ out+=TR('<label class="f">코스 이름</label><div class="row"><input class="grow" type="text" id="renameIn" value="')+esc(c.name)+TR('" maxlength="40"><button class="btn sec sm" data-act="rename">변경</button></div>'); }
  if(c.nines){
    c.nines.forEach(function(n){
      var pr=ninePar(c,n);
      out+='<div class="pl">'+esc(n.name)+TR(' · 파 ')+sum(pr)+(n.unverified&&!nineEdited(c,n)?TR(' <span class="badge warn">⚠ 미확인</span>'):'')+'</div>'+parGrid(pr,n.si9,c.id+':'+n.k,0)+
        '<div class="row" style="margin-top:4px"><input type="text" inputmode="numeric" data-parstr="'+esc(c.id+':'+n.k)+TR('" placeholder="9홀 파 숫자 9개 (예: 454345344)" class="grow"><button class="btn sec sm" data-act="parApply" data-key="')+esc(c.id+':'+n.k)+TR('" data-len="9">적용</button>')+
        (nineEdited(c,n)?'<button class="btn ghost sm" data-act="resetPar" data-key="'+esc(c.id+':'+n.k)+TR('">원래대로</button>'):'')+'</div>';
    });
    out+=TR('<p class="note" style="margin-top:8px">27홀 코스는 라운드 시작 때 전반·후반 9홀 코스를 각각 고릅니다. 작은 숫자는 9홀 안 난이도 순위입니다.</p>');
  } else {
    var pr=parsOf(c);
    out+=TR('<div class="pl">OUT (1–9) · 파 ')+sum(pr.slice(0,9))+'</div>'+parGrid(pr.slice(0,9),c.si?c.si.slice(0,9):null,c.id,0)+
      TR('<div class="pl">IN (10–18) · 파 ')+sum(pr.slice(9))+'</div>'+parGrid(pr.slice(9),c.si?c.si.slice(9):null,c.id,9)+
      TR('<label class="f">18홀 파 한 번에 입력 (숫자 18개)</label>')+
      '<div class="row"><input type="text" inputmode="numeric" data-parstr="'+esc(c.id)+TR('" placeholder="스코어카드의 파를 1번부터" class="grow"><button class="btn sec sm" data-act="parApply" data-key="')+esc(c.id)+TR('" data-len="18">적용</button></div>')+
      (S.pars[c.id]&&!c.custom?'<button class="btn ghost sm" style="margin-top:8px" data-act="resetPar" data-key="'+esc(c.id)+TR('">기본값 복원</button>'):'');
  }
  out+=TR('<p class="note" style="margin-top:8px">파 칸을 누르면 3 → 4 → 5 → 6 순서로 바뀝니다. 진행 중이거나 저장된 라운드에는 영향이 없습니다.</p>')+
    TR('<div class="pl">홀 지도</div>')+geoSection(c)+
    TR('<div class="row wrap" style="margin-top:14px"><button class="btn grow" data-act="useCourse">이 코스로 라운드 시작</button>')+
    (c.custom?TR('<button class="btn danger" data-act="delCourse">코스 삭제</button>'):'')+'</div></div>';
  return out;
}
function vSearch(){
  var s=UI.search||{};
  var out=TR('<div class="card"><h2>🌐 골프장 검색 · 다운로드 (전 세계)</h2>')+
    (s.attach?'<div class="infobox">「'+esc((courseOf(s.attach)||{}).name)+TR('」에 붙일 지도 데이터를 고르세요. <button class="xbtn" data-act="attachCancel">취소</button></div>'):
      TR('<p class="note">한국·일본·태국 등 어느 골프장이든, 현장에서 바로 코스(홀별 파·핸디캡)와 홀 지도를 받아 목록에 추가합니다.</p>'))+
    '<button class="btn block" style="margin-top:8px" data-act="nearby"'+(s.busy?' disabled':'')+TR('>📍 내 주변 골프장 찾기</button>')+
    TR('<div class="row" style="margin-top:8px"><input type="search" id="searchIn" placeholder="골프장 이름 또는 초성 (예: 대구, 남서울, ㄹㅇㅋ)" value="')+esc(s.q||'')+'" class="grow"><button class="btn sec" data-act="searchGo"'+(s.busy?' disabled':'')+TR('>검색</button></div>');
  if(s.busy){ out+='<div class="infobox"><span class="spin"></span> '+esc(s.msg||TR('검색 중…'))+'</div>'; }
  if(s.err){ out+='<div class="warnbox">'+esc(s.err)+'</div>'; }
  out+='<div id="searchResults">'+resultsHtml(s)+'</div>';
  out+=TR('<p class="note" style="margin-top:10px">데이터 출처: OpenStreetMap 기여자(무료 공개 지도). 골프장마다 입력 수준이 달라 <b>홀 정보가 없거나 파가 추정값</b>일 수 있습니다. 받은 뒤 실제 스코어카드와 한 번 대조해 주세요.</p></div>');
  return out;
}
function resultsHtml(s){
  var out='';
  if(s.results){
    if(s.results.length){ out+=TR('<p class="note" style="margin-top:10px">골프장을 누르면 받습니다. 🗺 표시가 있는 곳은 홀 지도·홀별 파까지 받아집니다.</p>'); }
    if(!s.results.length){ out+=TR('<p class="note" style="margin-top:10px">결과가 없습니다. 영문 이름이나 지역명을 함께 넣어 보세요. (예: "Lakeside Yongin golf")</p>'); }
    s.results.forEach(function(x,i){
      var have=courseOf('osm'+x.type.charAt(0)+x.id);
      out+='<div class="li lirow" data-act="pick" data-i="'+i+'"><div><div class="t">'+esc(x.name)+'</div><div class="s">'+esc(x.sub?x.sub.slice(0,60):'')+(x.dist!=null?(x.sub?' · ':'')+(x.dist/1000).toFixed(1)+'km':'')+holeCountText(x)+(have?TR(' · ✓ 받음'):'')+'</div></div><div class="r">⬇︎</div></div>';
    });
  }
  return out;
}
function vCourses(){
  var out='';
  if(UI.openCourse){ var c=courseOf(UI.openCourse); if(c){ out+=vCourseDetail(c); } }
  out+=vSearch();
  out+=TR('<div class="card"><h2>골프장 목록</h2>');
  var lastGrp='';
  sortedCourses().forEach(function(c){
    var gk=grpOf(c);
    if(gk!==lastGrp){ out+='<div class="pl" style="margin:14px 0 2px">'+GRP_NAME[gk]+'</div>'; lastGrp=gk; }
    var g=GEO.loadGeo(c.id);
    out+='<div class="li lirow" data-act="courseOpen" data-id="'+esc(c.id)+'"><div><div class="t">'+(c.fav?'★ ':'')+esc(c.name)+'</div><div class="s">'+esc(c.area||'')+(courseWarn(c)?TR(' · ⚠ 미확인 포함'):' · ✓')+(g?TR(' · 🗺 지도'):'')+'</div></div><div class="r" style="font-size:13px">'+esc(c.nines?c.nines.length*9+TR('홀'):coursePar(c))+'</div></div>';
  });
  out+=TR('</div><div class="card"><h2>코스 직접 추가</h2><input type="text" id="newCourse" placeholder="골프장 이름" maxlength="40">')+
    TR('<button class="btn sec block" style="margin-top:8px" data-act="addCourse">추가 후 홀별 파 입력</button></div>');
  return out;
}

/* ================= 설정 ================= */
function settingsBody(){
  var ch=function(key,vals){ return '<div class="row wrap">'+vals.map(function(v){ return '<button class="chip'+(S.set[key]===v[0]?' on':'')+'" data-act="setv" data-k="'+key+'" data-v="'+v[0]+'">'+v[1]+'</button>'; }).join('')+'</div>'; };
  return TR('<label class="f">언어 / 言語</label><div class="row wrap">')+[['ko',TR('한국어')],['ja','日本語']].map(function(x){
      return '<button class="chip'+(I18N.lang===x[0]?' on':'')+'" data-act="lang" data-v="'+x[0]+'">'+x[1]+'</button>'; }).join('')+'</div>'+
    TR('<label class="f">거리 단위</label>')+ch('unit',[['yd',TR('야드')],['m',TR('미터')]])+
    TR('<label class="f">야외 고대비 모드 (햇빛 아래 잘 보이게)</label>')+ch('contrast',[['normal',TR('보통')],['high',TR('고대비')]])+
    TR('<label class="f">화면 테마</label>')+ch('theme',[['auto',TR('자동')],['light',TR('밝게')],['dark',TR('어둡게')]])+
    TR('<label class="f">라운드 중 화면 꺼짐 방지</label>')+ch('wake',[[true,TR('켜기')],[false,TR('끄기')]])+
    TR('<label class="f">축하 효과 (파 이하 기록 시 꽃가루·불꽃)</label>')+ch('fx',[[true,TR('켜기')],[false,TR('끄기')]])+

    TR('<label class="f">기본 통화 (내기)</label>')+ch('cur',[['IDR',TR('루피아')],['KRW',TR('원')],['JPY',TR('엔')]])+
    TR('<label class="f">아래 탭 올리기 (화면 아래 배지가 탭을 가릴 때)</label>')+ch('badgeGap',[['auto',TR('자동')],['on',TR('올리기')],['off',TR('안 함')]])+
    TR('<p class="note" style="margin-top:14px">버전 ')+VERSION+' · '+(isStandalone()?TR('홈 화면 앱으로 실행 중'):TR('브라우저에서 실행 중'))+TR(' · 저장공간 ')+(S.set.persisted?TR('영구 보관'):TR('일반'))+'</p>'+
    TR('<p class="note">지도 데이터 © OpenStreetMap 기여자 (ODbL) · 위성사진 © Esri, Maxar</p>');
}
function applyTheme(){
  var d=document.documentElement;
  if(S.set.theme==='auto'){ d.removeAttribute('data-theme'); } else { d.setAttribute('data-theme',S.set.theme); }
  if(S.set.contrast==='high'){ d.setAttribute('data-contrast','high'); } else { d.removeAttribute('data-contrast'); }
}

/* ================= 렌더 ================= */
function render(){
  var m=$('#main');
  if(UI.tab==='round'){ m.innerHTML=S.current?vHole(S.current):vSetup(); }
  else if(UI.tab==='card'){ m.innerHTML=vCard(); }
  else if(UI.tab==='history'){ m.innerHTML=vHistory(); }
  else if(UI.tab==='stats'){ m.innerHTML=vStats(); }
  else { m.innerHTML=vCourses(); }
  var bs=document.querySelectorAll('#tabs button');
  for(var i=0;i<bs.length;i++){ bs[i].className=(bs[i].getAttribute('data-tab')===UI.tab)?'on':''; }
  var mr=$('#modalRoot');
  if(UI.modal){
    var mo=UI.modal;
    if(typeof mo.body==='function'){ mo.html=mo.body(); }
    mr.innerHTML='<div class="ov" data-act="modalBg"><div class="sheet"><h3>'+esc(mo.title)+'</h3><div class="body">'+(mo.html||mo.body)+'</div><div class="row btns">'+
      mo.btns.map(function(b,i){ return '<button class="btn '+(b.cls||'')+' grow" data-act="modal" data-i="'+i+'">'+esc(b.label)+'</button>'; }).join('')+'</div></div></div>';
  } else { mr.innerHTML=''; }
  $('#subTitle').textContent=S.current?(TR('진행 중: ')+S.current.courseName):TR('홀 종료 시마다 기록 · 자동 저장');
  renderDock();
  syncWake();
}
function openModal(title,body,btns){ modalCbs=btns.map(function(b){ return b.fn; }); UI.modal={title:title,body:body,btns:btns}; render(); }
function closeModal(){ UI.modal=null; modalCbs=[]; render(); }
function go(tab){ UI.tab=tab; render(); window.scrollTo(0,0); }

/* ================= 라운드 동작 ================= */
function beginRound(){
  var s=UI.setup, c=courseOf(s.courseId), i;
  var names=[], hc=[];
  for(i=0;i<s.n;i++){
    var nm=(s.names[i]||'').trim(); names.push(nm||(i===0?TR('나'):TR('플레이어 ')+(i+1)));
    var hv=parseInt(s.hcps[i],10); hc.push(isNaN(hv)?null:Math.max(0,Math.min(54,hv)));
  }
  if(c.nines && s.holesN===9){ s.back=s.front; }
  var lay=buildLayout(c,s), order=[];
  if(s.holesN===18){ for(i=0;i<18;i++){ order.push((s.start+i)%18); } }
  else if(c.nines){ for(i=0;i<9;i++){ order.push((s.start+i)%9); } }
  else { for(i=0;i<9;i++){ order.push((s.start+i)%18); } }
  var mk=function(){ return names.map(function(){ return new Array(18).fill(null); }); };
  var cname=c.name+(lay.nineNames?(' ('+(s.holesN===9?lay.nineNames[0]:lay.nineNames.join('·'))+')'):'');
  S.current={id:'r'+Date.now(),courseId:c.id,courseName:cname,date:s.date||today(),tee:s.tee||'white',players:names,hcp:hc,holesN:s.holesN,
    par:lay.par,si:lay.si,yd:lay.yd,labels:lay.labels,geoRefs:lay.geoRefs,order:order,idx:0,scores:mk(),putts:mk(),
    fir:new Array(18).fill(null),pen:new Array(18).fill(null),bet:{mode:'none',unit:S.set.cur==='KRW'?1000:(S.set.cur==='JPY'?100:10000),net:false},cost:{},cur:S.set.cur,undo:[],startedAt:Date.now()};
  S.names=s.names.slice(); S.hcps=s.hcps.slice(); S.lastN=s.n; S.lastCourse=c.id;
  save(); render(); window.scrollTo(0,0);
  if(S.set.gps && GEO.loadGeo(c.id)){ gpsOn(); }
}
function snap(r,h){
  r.undo.push({h:h,idx:r.idx,s:r.scores.map(function(a){ return a[h]; }),pt:r.putts.map(function(a){ return a[h]; }),f:r.fir[h],pn:r.pen[h]});
  if(r.undo.length>40){ r.undo.shift(); }
}
function undo(r){
  var u=r.undo.pop(); if(!u){ return; }
  u.s.forEach(function(v,p){ r.scores[p][u.h]=v; }); u.pt.forEach(function(v,p){ r.putts[p][u.h]=v; });
  r.fir[u.h]=u.f; r.pen[u.h]=u.pn; r.idx=r.order.indexOf(u.h); if(r.idx<0){ r.idx=u.idx; }
  save(); render(); toast(TR('되돌렸어요'));
}
function finishRound(){
  var r=S.current, any=false;
  for(var p=0;p<r.players.length;p++){ if(stats(r,p).n>0){ any=true; } }
  if(!any){ toast(TR('입력된 점수가 없어 저장하지 않았어요')); S.current=null; UI.setup=null; save(); render(); return; }
  var cnt=0;
  r.order.forEach(function(h){ var full=true; for(var q=0;q<r.players.length;q++){ if(r.scores[q][h]==null){ full=false; } } if(full){ cnt++; } });
  r.partial=cnt<r.order.length; r.finished=true; r.endedAt=Date.now(); r.undo=[];
  S.rounds.unshift(r); S.current=null; UI.setup=null; UI.openHist=r.id;
  save(); UI.tab='history'; render(); window.scrollTo(0,0); toast(TR('라운드가 저장되었어요'));
  if(S.rounds.length-(S.set.backupCount||0)>=3){
    setTimeout(function(){
      openModal(TR('백업을 권장합니다'),TR('<p>백업하지 않은 라운드가 <b>')+(S.rounds.length-(S.set.backupCount||0))+TR('개</b> 있습니다. 폰 교체나 앱 삭제 시 기록이 사라지지 않도록 백업 파일을 보관하세요.</p>'),
        [{label:TR('나중에'),cls:'ghost'},{label:TR('📤 백업 파일 보내기'),fn:function(){ backupOut(true); }}]);
    },600);
  }
}

/* ================= 복사 / 공유 / 파일 ================= */
function copyText(t){
  var done=function(){ toast(TR('복사되었습니다')); };
  var fb=function(){
    try{ var ta=document.createElement('textarea'); ta.value=t; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); done(); }
    catch(e){ toast(TR('복사에 실패했어요')); }
  };
  try{ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(t).then(done,fb); } else { fb(); } }catch(e){ fb(); }
}
function shareOrDownload(blob, name, title, preferShare){
  var file=null; try{ file=new File([blob], name, {type:blob.type}); }catch(e){}
  if(preferShare && file && navigator.canShare && navigator.canShare({files:[file]})){
    return navigator.share({files:[file], title:title}).then(function(){ return true; }).catch(function(e){ if(e&&e.name==='AbortError'){ return false; } download(blob,name); return true; });
  }
  download(blob,name); return Promise.resolve(true);
}
function download(blob,name){
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  toast(TR('파일을 저장했어요 (')+name+')', 2600);
}
function backupObj(){
  var geo={};
  try{ for(var i=0;i<localStorage.length;i++){ var k=localStorage.key(i); if(k&&k.indexOf('golfscore.geo.')===0){ geo[k.slice(14)]=JSON.parse(localStorage.getItem(k)); } } }catch(e){}
  return {app:'golfscore', v:2, exported:new Date().toISOString(),
    data:{rounds:S.rounds, current:S.current, pars:S.pars, custom:S.custom, greens:S.greens, names:S.names, hcps:S.hcps, set:S.set}, geo:geo};
}
function backupOut(share){
  var d=today().replace(/-/g,'');
  var blob=new Blob([JSON.stringify(backupObj())],{type:'application/json'});
  shareOrDownload(blob,'golfscore-backup-'+d+'.json',TR('골프 스코어 백업'),share).then(function(ok){
    if(ok){ S.set.lastBackup=Date.now(); S.set.backupCount=S.rounds.length; save(); if(UI.tab==='history'){ render(); } }
  });
}
function restoreData(obj){
  var d=obj&&obj.data?obj.data:obj; if(!d||(!d.rounds&&!d.custom)){ throw new Error('bad'); }
  var have={}; S.rounds.forEach(function(x){ have[x.id]=1; });
  var added=0;
  (d.rounds||[]).forEach(function(x){ if(x&&x.id&&x.scores&&x.players&&!have[x.id]){ fixRound(x); S.rounds.push(x); added++; } });
  S.rounds.sort(function(x,y){ return (y.endedAt||0)-(x.endedAt||0); });
  for(var k in (d.pars||{})){ S.pars[k]=d.pars[k]; }
  (d.custom||[]).forEach(function(c){ if(!courseOf(c.id)){ S.custom.push(c); } });
  for(var g in (d.greens||{})){ S.greens[g]=Object.assign({}, S.greens[g]||{}, d.greens[g]); }
  var geoN=0; for(var id in (obj.geo||{})){ if(!GEO.loadGeo(id)){ if(GEO.saveGeo(id,obj.geo[id])){ GEO.setCache(id,obj.geo[id]); geoN++; } } }
  if(!S.current && d.current && d.current.scores){ fixRound(d.current); S.current=d.current; }
  migrate(); save(); render();
  toast(TR('복원 완료: 기록 ')+added+TR('건')+(geoN?TR(' · 지도 ')+geoN+TR('개'):''),3000);
}

/* 스코어카드 이미지 */
function cardImage(r){
  var bl=blocks(r), cols=[]; bl.forEach(function(b){ for(var h=b*9;h<b*9+9;h++){ cols.push({h:h}); } cols.push({sum:b}); }); if(bl.length===2){ cols.push({tot:1}); }
  var cw=46, nw=150, rh=46, top=120, W=nw+cols.length*cw+30, rows=2+(r.si?1:0)+r.players.length, Hh=top+rows*rh+40+r.players.length*30+40;
  var cv=document.createElement('canvas'), k=2; cv.width=W*k; cv.height=Hh*k; var g=cv.getContext('2d'); g.scale(k,k);
  g.fillStyle='#ffffff'; g.fillRect(0,0,W,Hh);
  g.fillStyle='#1e7a40'; g.fillRect(0,0,W,78);
  g.fillStyle='#fff'; g.font='bold 26px system-ui,-apple-system,sans-serif'; g.fillText('⛳ '+r.courseName,16,38);
  g.font='16px system-ui,-apple-system,sans-serif'; g.fillText(r.date+(teeLabel(r)?' · '+teeLabel(r):'')+' · '+r.holesN+TR('홀'),16,64);
  var y=top-20;
  function row(label, vals, opt){
    opt=opt||{};
    if(opt.bg){ g.fillStyle=opt.bg; g.fillRect(12,y,W-24,rh); }
    g.fillStyle=opt.color||'#17251b'; g.font=(opt.bold?'bold ':'')+'17px system-ui,-apple-system,sans-serif'; g.textAlign='left';
    g.fillText(label.length>9?label.slice(0,9)+'…':label,20,y+rh/2+6);
    g.textAlign='center';
    vals.forEach(function(v,i){
      var x=nw+i*cw+cw/2;
      if(v&&v.mk){
        var c={e:'#1d4ed8',b:'#3b82f6',g:'#fcd34d',d:'#ef4444'}[v.mk];
        if(c){ g.fillStyle=c; if(v.mk==='e'||v.mk==='b'){ g.beginPath(); g.arc(x,y+rh/2,15,0,7); g.fill(); } else { g.fillRect(x-15,y+rh/2-15,30,30); } }
        g.fillStyle='#17251b';
      }
      if(v&&v.sum){ g.fillStyle='#eef3ef'; g.fillRect(nw+i*cw,y,cw,rh); g.fillStyle='#17251b'; g.font='bold 17px system-ui,sans-serif'; }
      else { g.font=(opt.bold?'bold ':'')+'17px system-ui,sans-serif'; g.fillStyle=opt.color||'#17251b'; }
      if(v&&(v.mk==='e'||v.mk==='b'||v.mk==='d')){ g.fillStyle='#ffffff'; g.font='bold 17px system-ui,sans-serif'; }
      g.fillText(v==null?'':(v.t!=null?v.t:v),x,y+rh/2+6);
    });
    g.strokeStyle='#dbe3dc'; g.beginPath(); g.moveTo(12,y+rh); g.lineTo(W-12,y+rh); g.stroke();
    y+=rh;
  }
  row(TR('홀'), cols.map(function(c){ return c.h!=null?r.labels[c.h]:{t:c.sum!=null?(c.sum===0?'OUT':'IN'):'TOT',sum:1}; }), {bg:'#e3f1e7',color:'#1e7a40',bold:true});
  row('PAR', cols.map(function(c){ return c.h!=null?r.par[c.h]:{t:c.sum!=null?sum(r.par.slice(c.sum*9,c.sum*9+9)):sum(r.par),sum:1}; }), {color:'#5f6f64'});
  if(r.si){ row('HCP', cols.map(function(c){ return c.h!=null?r.si[c.h]:{t:'',sum:1}; }), {color:'#5f6f64'}); }
  r.players.forEach(function(nm,p){
    row(nm, cols.map(function(c){
      if(c.h!=null){ var s=r.scores[p][c.h]; if(s==null||r.order.indexOf(c.h)<0){ return ''; } var cl=relCls(s-r.par[c.h]); return {t:s,mk:cl==='p'?null:cl}; }
      var v=c.sum!=null?half(r,p,c.sum*9,c.sum*9+8):(function(){ var o=half(r,p,0,8),n=half(r,p,9,17); return (o==null&&n==null)?null:(o||0)+(n||0); })();
      return {t:v==null?'–':v,sum:1};
    }), {bold:true});
  });
  y+=26; g.textAlign='left';
  r.players.forEach(function(nm,p){
    var st=stats(r,p);
    g.fillStyle='#17251b'; g.font='16px system-ui,sans-serif';
    g.fillText(nm+' : '+(st.n?st.tot+TR('타 (')+fmtDiff(st.diff)+')':'-')+(st.net!=null?TR(' · 네트 ')+st.net:'')+(st.pn?TR(' · 퍼트 ')+st.putts:'')+TR(' · 버디 ')+(st.b+st.e), 20, y); y+=30;
  });
  g.fillStyle='#8a9a8f'; g.font='12px system-ui,sans-serif'; g.fillText(TR('골프 스코어 앱'), 20, Hh-16);
  return new Promise(function(res){ cv.toBlob(res,'image/png'); });
}

/* ================= 온라인 코스 ================= */
function setSearch(o){ UI.search=Object.assign({}, UI.search||{}, o); if(UI.tab==='courses'){ render(); } }
function doNearby(){
  if(!navigator.geolocation){ setSearch({err:TR('이 기기는 위치 기능을 지원하지 않아요')}); return; }
  setSearch({busy:true,msg:TR('현재 위치 확인 중…'),err:null,results:null});
  navigator.geolocation.getCurrentPosition(function(p){
    S.set.lastPos=[+p.coords.latitude.toFixed(3),+p.coords.longitude.toFixed(3)]; save();
    var la=p.coords.latitude, lo=p.coords.longitude, quickList=GEO.nearIdx(la,lo,20000);
    if(quickList.length){ setSearch({busy:false,results:quickList.slice(0,25)}); }
    if(GEO.inBundle([la,lo]) && quickList.length){ return; } /* 내장 목록으로 충분 → 서버 안 기다림 */
    GEO.nearby(la,lo,20000,function(m){ if(!quickList.length){ setSearch({msg:m}); } }).then(function(list){
      setSearch({busy:false,results:list.slice(0,25)});
    }).catch(function(){ if(!quickList.length){ setSearch({busy:false,err:TR('지도 서버가 혼잡하거나 인터넷 연결이 약합니다. 이름으로 검색해 보세요.')}); } });
  }, function(e){ setSearch({busy:false,err:e.code===1?TR('위치 권한이 필요합니다. 브라우저 설정에서 위치를 허용해 주세요.'):TR('위치를 가져오지 못했어요')}); },
  {enableHighAccuracy:false,timeout:12000,maximumAge:300000});
}
function doSearch(q){
  clearTimeout(onInput._st); /* 입력 중 즉시검색 타이머가 서버 결과를 덮어쓰지 않게 */
  if(!q){ toast(TR('골프장 이름을 입력하세요')); return; }
  var pos=UI.pos||S.set.lastPos||null;
  setSearch({q:q,busy:true,msg:TR('인터넷 검색 결과 추가 확인 중… (위 결과는 바로 선택 가능)'),err:null,results:GEO.quick(q,pos)});
  GEO.search(q, pos, function(m){ setSearch({msg:m}); }, function(list){
    UI.search.results=list; var box=document.getElementById('searchResults'); if(box){ box.innerHTML=resultsHtml(UI.search); }
  }).then(function(list){
    setSearch({busy:false,results:list});
  }).catch(function(){ setSearch({busy:false,err:TR('검색 서버에 연결하지 못했습니다. 인터넷 연결을 확인하세요.')}); });
}
/* 다운로드 진행 창 */
var dlTimer=null;
function dlStatus(m){ if(UI.dl){ UI.dl.msg=m; } var e=document.getElementById('dlMsg'); if(e){ e.textContent=m; } }
function dlOpen(name){
  UI.dl={token:Date.now(), msg:TR('지도 서버 연결 중…'), t0:Date.now(), name:name};
  openModal(TR('코스 데이터 받는 중'), function(){
    return '<p><b>'+esc(UI.dl?UI.dl.name:'')+'</b></p><div class="infobox"><span class="spin"></span> <span id="dlMsg">'+esc(UI.dl?UI.dl.msg:'')+'</span> · <span id="dlSec">'+(UI.dl?Math.round((Date.now()-UI.dl.t0)/1000):0)+TR('</span>초</div>')+
      TR('<p class="note">보통 5~20초 걸립니다. 서버가 혼잡하면 예비 서버로 자동 전환합니다(최대 약 1분).</p>');
  }, [{label:TR('취소'),cls:'ghost',fn:function(){ UI.dl=null; clearInterval(dlTimer); toast(TR('다운로드를 취소했어요')); }}]);
  clearInterval(dlTimer);
  dlTimer=setInterval(function(){ var e=document.getElementById('dlSec'); if(e&&UI.dl){ e.textContent=Math.round((Date.now()-UI.dl.t0)/1000); } if(!UI.dl){ clearInterval(dlTimer); } },1000);
  return UI.dl.token;
}
function dlDone(token){ if(!UI.dl||UI.dl.token!==token){ return false; } UI.dl=null; clearInterval(dlTimer); if(UI.modal){ UI.modal=null; modalCbs=[]; } return true; }
function holeCountText(x){
  if(x.nHoles==null){ return ''; }
  if(x.nHoles>=9){ return TR(' · 🗺 홀 지도 ')+x.nHoles+TR('홀')+(x.nPar<x.nHoles?TR('(파 일부 없음)'):''); }
  return TR(' · 코스 윤곽만(홀 정보 없음)');
}
/* 검색 결과 선택: 코스를 즉시 추가하고, 홀 지도는 뒤에서 받음 (기다리지 않음) */
var bgDl={};
function applyGeo(id, g, x){
  var c=courseOf(id); if(!c){ return; }
  if(!GEO.saveGeo(id,g)){ toast(TR('저장 공간이 부족해 홀 지도를 저장하지 못했어요'),3000); return; }
  GEO.setCache(id,g);
  if(c.osm && g.refs.length){
    var oc=GEO.toCourse(g, id, c.name), userPar=Object.keys(S.pars).some(function(k){ return k===id||k.indexOf(id+':')===0; });
    if(!userPar){
      delete c.par; delete c.si; delete c.nines; delete c.geoRefs; delete c.yd;
      ['par','si','nines','geoRefs','yd','unverified','warn'].forEach(function(k){ if(oc[k]!==undefined){ c[k]=oc[k]; } });
    } else if(oc.geoRefs){ c.geoRefs=oc.geoRefs; }
    c.src=oc.src;
  }
  c.pending=false; c.geoFail=false; save();
  if(UI.tab==='courses'||UI.tab==='round'){ if(!UI.modal){ render(); } }
  toast(g.refs.length?('🗺 「'+c.name+TR('」 홀 지도 ')+g.refs.length+TR('홀 받음')):('「'+c.name+TR('」 공개 지도에 홀 정보는 없습니다(코스 윤곽만)')),3000);
}
function bgDownload(id, x){
  if(bgDl[id]){ return; }
  bgDl[id]=true;
  GEO.download(x.type,x.id,(x.lat!=null?[x.lat,x.lon]:null),x.bounds||null,null).then(function(g){
    bgDl[id]=false; applyGeo(id,g,x);
  }).catch(function(){
    bgDl[id]=false; var c=courseOf(id); if(c){ c.pending=false; c.geoFail=true; save(); if(UI.tab==='courses'&&!UI.modal){ render(); } }
  });
}
function pickResult(x){
  var attach=UI.search&&UI.search.attach;
  if(attach){ /* 기본 코스에 지도 붙이기: 역시 뒤에서 */
    var ac=courseOf(attach); ac.pending=true; save();
    UI.search={}; UI.openCourse=attach; UI.tab='courses'; render();
    toast(TR('홀 지도 받는 중… 다른 작업을 하셔도 됩니다'),2500);
    bgDl[attach]=false; bgDownload(attach, x); return;
  }
  var id='osm'+x.type.charAt(0)+x.id, c=courseOf(id);
  if(!c){
    c={id:id, name:x.name, area:TR('골프장 목록에서 추가'), custom:true, osm:true, ll:[+(+x.lat).toFixed(5), +(+x.lon).toFixed(5)],
      bounds:x.bounds||null, par:PAR_STD.slice(), si:null, unverified:true, src:TR('OpenStreetMap 골프장 목록'), warn:[]};
    S.custom.push(c);
  }
  c.pending=true; save();
  UI.search={}; UI.openCourse=id; UI.tab='courses'; window.scrollTo(0,0);
  bgDownload(id, x);
  UI._qp='';
  var startFn=function(){ initSetup(); UI.setup.courseId=id; if(c.nines){ UI.setup.front=c.nines[0].k; UI.setup.back=(c.nines[1]||c.nines[0]).k; } go('round'); };
  openModal(TR('코스를 추가했습니다'),'<p><b>'+esc(c.name)+'</b></p>'+
    TR('<p class="note">홀 지도·홀별 파는 뒤에서 받고 있습니다. 기다리지 않고 바로 시작해도 됩니다. (한국 골프장은 대부분 공개 지도에 홀 정보가 없습니다)</p>')+
    TR('<p style="margin-top:10px"><b>스코어카드의 파 18개</b>를 알면 넣어 주세요 (선택)</p>')+
    TR('<input type="text" inputmode="numeric" id="quickPar" placeholder="예: 454345344 435434435" style="margin-top:4px">'),
    [{label:TR('나중에'),cls:'ghost'},{label:TR('이 코스로 시작'),fn:function(){
      var d=(UI._qp||'').replace(/[^0-9]/g,'');
      if(d.length===18 && d.split('').every(function(v){ return v>=3&&v<=6; })){ S.pars[id]=d.split('').map(Number); c.unverified=false; save(); toast(TR('파 ')+sum(S.pars[id])+TR(' 저장')); }
      else if(d.length){ toast(TR('숫자 18개(3~6)가 아니어서 파는 저장하지 않았어요'),3000); }
      startFn();
    }}]);
}
function geoGetFor(id){
  var c=courseOf(id); if(!c){ return; }
  UI.search={attach:id}; UI.tab='courses'; UI.openCourse=id;
  var g=GEO.loadGeo(id), ll=c.ll||(g&&g.center);
  if(g&&g.osmType&&g.osmId){ pickResult({type:g.osmType,id:g.osmId,name:c.name,lat:ll?ll[0]:null,lon:ll?ll[1]:null,bounds:null}); return; }
  var m=/^osm([wr])(\d+)$/.exec(id);
  if(m){ c.pending=true; save(); UI.search={}; render(); bgDl[id]=false; bgDownload(id,{type:m[1]==='w'?'way':'relation',id:+m[2],lat:ll?ll[0]:null,lon:ll?ll[1]:null,bounds:c.bounds||null}); toast(TR('홀 지도 다시 받는 중…')); return; }
  if(ll){
    setSearch({busy:true,msg:TR('코스 위치 주변 골프장 찾는 중…')});
    GEO.nearby(ll[0],ll[1],2500,function(m){ setSearch({msg:m}); }).then(function(list){
      if(list.length===1||(list.length&&list[0].dist<400&&(!list[1]||list[1].dist>1200))){ setSearch({busy:false,results:list}); pickResult(list[0]); }
      else { setSearch({busy:false,results:list}); if(!list.length){ setSearch({err:TR('이 코스 위치에서 골프장 지도를 찾지 못했습니다. 이름으로 검색해 보세요.')}); } }
    }).catch(function(){ setSearch({busy:false,err:TR('지도 서버가 혼잡합니다. 잠시 후 다시 시도해 주세요.')}); });
  } else {
    doSearch(c.name.replace(/\(.*?\)/g,'').trim());
  }
  window.scrollTo(0,0);
}

/* ================= 위성지도 ================= */
var satState=null;
function openSat(o){
  if(typeof L==='undefined'){ toast(TR('지도 모듈을 불러오지 못했어요')); return; }
  satState=o; satState.pinMode=false;
  $('#mapFull').style.display='flex'; $('#mapTitle').textContent=o.title||TR('위성지도');
  $('#mapPinBtn').style.display=o.ref!=null?'':'none'; $('#mapPinBtn').className='';
  $('#mapGpsBtn').className=watchId!=null?'on':'';
  $('#mapInfo').textContent=navigator.onLine===false?TR('오프라인: 위성사진은 한 번 본 곳만 보입니다. 홀 지도(🗺)는 오프라인에서도 됩니다.'):TR('지도를 누르면 거리가 표시됩니다.');
  GEO.satShow({el:$('#lmap'), geo:o.geo, ref:o.ref, center:o.center, pin:o.pin, onClick:satClick});
  if(UI.pos){ GEO.satPos(UI.pos); }
}
function satClick(ll){
  var o=satState; if(!o){ return; }
  var u=S.set.unit;
  if(o.pinMode){
    S.greens[o.courseId]=S.greens[o.courseId]||{}; S.greens[o.courseId][o.ref]=[+ll[0].toFixed(6),+ll[1].toFixed(6)];
    save(); o.pin=S.greens[o.courseId][o.ref]; o.pinMode=false; $('#mapPinBtn').className='';
    GEO.satShow({el:$('#lmap'), geo:o.geo, ref:o.ref, center:ll, zoom:18, pin:o.pin, onClick:satClick});
    $('#mapInfo').textContent=TR('그린 위치를 저장했습니다. 다음부터 이 홀 거리 계산에 사용됩니다.');
    return;
  }
  var gh=o.geo&&o.ref!=null?o.geo.holes[o.ref]:null, gc=o.pin||(gh&&gh.gc);
  var from=UI.pos, fromTxt=TR('내 위치');
  if(!from&&gh){ from=gh.line[0]; fromTxt=TR('티'); }
  var t=[];
  if(from){ t.push(fromTxt+TR('→여기 ')+GEO.fmtD(GEO.dist(from,ll),u)+unitName()); }
  if(gc){ t.push(TR('여기→그린 ')+GEO.fmtD(GEO.dist(ll,gc),u)+unitName()); }
  var txt=t.join(' · ')||TR('위치: ')+ll[0].toFixed(5)+', '+ll[1].toFixed(5);
  $('#mapInfo').textContent=txt; GEO.satMark(ll, t.length?t[t.length-1].replace(/^.*?\s/,''):'');
}
function closeSat(){ $('#mapFull').style.display='none'; satState=null; if(UI.tab==='round'){ render(); } }

/* ================= 클릭 처리 ================= */
function onClick(e){
  /* 홀 지도(SVG) 탭 → 거리 */
  var svg=e.target.closest&&e.target.closest('svg[data-holemap]');
  if(svg && UI.holeMeta && S.current){ holeTap(svg,e); return; }
  var el=e.target.closest('[data-act]');
  if(!el){ return; }
  var a=el.getAttribute('data-act'), r=S.current;
  var p=parseInt(el.getAttribute('data-p'),10);
  if(a==='modalBg'){ if(e.target===el){ closeModal(); } return; }
  if(a==='modal'){ var cb=modalCbs[parseInt(el.getAttribute('data-i'),10)]; closeModal(); if(cb){ cb(); } return; }
  if(a==='tab'){ go(el.getAttribute('data-tab')); return; }
  if(a==='install'){ doInstall(); return; }
  if(a==='hideInstallBar'){ S.set.hideInstall=true; save(); hideInstallBar(); toast(TR('설치는 오른쪽 위 [📲 앱 설치]로 언제든 할 수 있어요'),3000); return; }
  if(a==='iosGuideClose'){ if(e.target===el||el.tagName==='BUTTON'){ $('#iosGuide').style.display='none'; } return; }
  if(a==='applyUpdate'){ applyUpdate(); return; }
  if(a==='settings'){ openModal(TR('설정'), settingsBody, [{label:TR('닫기')}]); return; }
  if(a==='langToggle'){ I18N.set(I18N.lang==='ja'?'ko':'ja'); return; }
  if(a==='lang'){ I18N.set(el.getAttribute('data-v')); return; }
  if(a==='setv'){ var k=el.getAttribute('data-k'), v=el.getAttribute('data-v'); S.set[k]=(v==='true')?true:(v==='false'?false:v); save(); applyTheme(); checkBadge(); render(); return; }
  /* 설정 화면 */
  if(a==='n'){ UI.setup.n=parseInt(el.getAttribute('data-v'),10); render(); return; }
  if(a==='start'){ UI.setup.start=parseInt(el.getAttribute('data-v'),10); render(); return; }
  if(a==='tee'){ UI.setup.tee=el.getAttribute('data-v'); render(); return; }
  if(a==='holesN'){ UI.setup.holesN=parseInt(el.getAttribute('data-v'),10); UI.setup.start=0; render(); return; }
  if(a==='nine'){ UI.setup[el.getAttribute('data-k')]=el.getAttribute('data-v'); render(); return; }
  if(a==='begin'){ beginRound(); return; }
  /* 점수 입력 */
  if(r&&(a==='inc'||a==='chip'||a==='putt'||a==='clear'||a==='fir'||a==='pen')){
    var h=r.order[r.idx], par=r.par[h];
    snap(r,h);
    if(a==='inc'){
      var cur=r.scores[p][h], d=parseInt(el.getAttribute('data-d'),10);
      r.scores[p][h]=(cur==null)?par:Math.max(1,Math.min(20,cur+d));
    } else if(a==='chip'){
      var off=el.getAttribute('data-off');
      r.scores[p][h]=(off==='dp')?Math.min(20,par*2):Math.max(1,par+parseInt(off,10));
    } else if(a==='clear'){
      r.scores[p][h]=null; r.putts[p][h]=null; if(p===0){ r.fir[h]=null; r.pen[h]=null; }
    } else if(a==='putt'){
      var d2=parseInt(el.getAttribute('data-d'),10), pt=r.putts[p][h], mx=r.scores[p][h]!=null?r.scores[p][h]:9;
      var nv=(pt==null)?(d2>0?2:0):pt+d2;
      r.putts[p][h]=Math.max(0,Math.min(mx,nv));
      if(pt!=null&&nv>mx){ toast(TR('퍼트 수는 타수보다 많을 수 없어요')); }
    } else if(a==='fir'){
      var fv=el.getAttribute('data-v'); r.fir[h]=(r.fir[h]===fv)?null:fv;
    } else if(a==='pen'){
      r.pen[h]=Math.max(0,Math.min(9,(r.pen[h]||0)+parseInt(el.getAttribute('data-d'),10)));
    }
    var sc=r.scores[p]&&r.scores[p][h];
    if(sc!=null&&r.putts[p][h]!=null&&r.putts[p][h]>sc){ r.putts[p][h]=sc; }
    var u0=r.undo[r.undo.length-1];
    if(u0&&JSON.stringify([u0.s,u0.pt,u0.f,u0.pn])===JSON.stringify([r.scores.map(function(x){return x[h];}),r.putts.map(function(x){return x[h];}),r.fir[h],r.pen[h]])){ r.undo.pop(); }
    buzz(); save(); render();
    if(a==='inc'||a==='chip'){ queueFx(r,p,h,a==='inc'?800:60); }
    return;
  }
  if(r&&a==='undo'){ undo(r); return; }
  if(a==='gp'){ UI.gp=parseInt(el.getAttribute('data-v'),10)||0; render(); return; }
  if(r&&a==='goto'){ gotoIdx(r,parseInt(el.getAttribute('data-i'),10)); return; }
  if(r&&a==='holePop'){
    var gi=parseInt(el.getAttribute('data-i'),10), gpp=(UI.gp!=null&&UI.gp<r.players.length)?UI.gp:0, hq=r.order[gi];
    var prevH=(gi!==r.idx)?r.order[r.idx]:null;
    if(prevH!=null){ r.idx=gi; save(); }   /* 누른 홀을 현재 홀로 선택 */
    UI.pop={i:gi,p:gpp};
    openModal(r.labels[hq]+TR('번 홀')+' · PAR '+r.par[hq]+(r.players.length>1?' · '+r.players[gpp]:''), holePopBody,
      [{label:TR('닫기'),fn:function(){ UI.pop=null; }}]);
    if(prevH!=null){ cheerHole(r,prevH,true); }
    return;
  }
  if(r&&UI.pop&&(a==='pinc'||a==='pchip'||a==='pclear')){
    var hp=r.order[UI.pop.i], pp=UI.pop.p, parp=r.par[hp], cv=r.scores[pp][hp];
    snap(r,hp);
    if(a==='pinc'){ r.scores[pp][hp]=(cv==null)?parp:Math.max(1,Math.min(20,cv+parseInt(el.getAttribute('data-d'),10))); }
    else if(a==='pchip'){ var po=el.getAttribute('data-off'); r.scores[pp][hp]=(po==='dp')?Math.min(20,parp*2):Math.max(1,parp+parseInt(po,10)); }
    else { r.scores[pp][hp]=null; r.putts[pp][hp]=null; }
    if(r.putts[pp][hp]!=null&&r.scores[pp][hp]!=null&&r.putts[pp][hp]>r.scores[pp][hp]){ r.putts[pp][hp]=r.scores[pp][hp]; }
    buzz(); save();
    if(a==='pinc'){ render(); } else { UI.pop=null; closeModal(); }
    if(a!=='pclear'){ queueFx(r,pp,hp,a==='pinc'?800:60); }
    return;
  }
  if(r&&a==='prev'){ if(r.idx>0){ r.idx--; save(); render(); window.scrollTo(0,0); } return; }
  if(r&&a==='next'){
    var hh=r.order[r.idx], miss=[];
    for(var q=0;q<r.players.length;q++){ if(r.scores[q][hh]==null){ miss.push(r.players[q]); } }
    if(miss.length){ toast(TR('점수 미입력: ')+miss.join(', ')); }
    cheerHole(r,hh,!miss.length);
    if(r.idx<r.order.length-1){ r.idx++; }
    save(); render(); window.scrollTo(0,0); return;
  }
  if(r&&a==='finish'){
    if(el.getAttribute('data-cheer')){ cheerHole(r,r.order[r.idx],true); }
    openModal(TR('라운드 종료'),TR('<p>현재까지 입력한 점수로 라운드를 저장하고 종료할까요?</p>'),[{label:TR('계속 입력'),cls:'ghost'},{label:TR('저장하고 종료'),fn:finishRound}]); return;
  }
  if(r&&a==='cancelRound'){
    openModal(TR('라운드 삭제'),TR('<p>진행 중인 라운드를 <b>저장하지 않고 삭제</b>합니다. 계속할까요?</p>'),
      [{label:TR('취소'),cls:'ghost'},{label:TR('삭제'),cls:'danger',fn:function(){ S.current=null; UI.setup=null; save(); render(); }}]); return;
  }
  /* 지도 / GPS */
  if(a==='gpsToggle'){ if(watchId!=null){ gpsOff(); toast(TR('GPS를 껐어요')); } else { gpsOn(); toast(TR('GPS 켜는 중… (처음엔 위치 권한을 허용해 주세요)'),2600); } render(); return; }
  if(a==='mapToggle'){ S.set.mapOn=!S.set.mapOn; save(); render(); return; }
  if(a==='satHole'&&r){
    var h2=r.order[r.idx], ref=refOf(r,h2), g=geoOf(r), c=courseOf(r.courseId);
    openSat({title:r.courseName+' · '+r.labels[h2]+TR('번'), geo:g, ref:ref, courseId:r.courseId, pin:pinOf(r.courseId,ref),
      center:(g&&g.holes[ref])?null:((c&&c.ll)||(g&&g.center)||UI.pos||[-6.2,106.8])});
    if(!(g&&g.holes[ref])&&!(c&&c.ll)&&!(g&&g.center)){ $('#mapInfo').textContent=TR('이 코스 위치 정보가 없습니다. 📍 내 위치를 켜 주세요.'); }
    return;
  }
  if(a==='satCourse'){
    var c2=courseOf(el.getAttribute('data-id')), g2=GEO.loadGeo(c2.id);
    var cen=c2.ll||(g2&&g2.center);
    if(!cen){ window.open(mapUrl(c2),'_blank'); return; }
    openSat({title:c2.name, geo:g2, ref:null, courseId:c2.id, center:cen, zoom:16}); return;
  }
  if(a==='mapClose'){ closeSat(); return; }
  if(a==='mapGps'){ if(watchId!=null){ gpsOff(); el.className=''; } else { gpsOn(); el.className='on'; if(UI.pos){ GEO.satCenter(UI.pos); } } return; }
  if(a==='mapPin'){ if(satState){ satState.pinMode=!satState.pinMode; el.className=satState.pinMode?'on':''; $('#mapInfo').textContent=satState.pinMode?TR('그린 중앙을 누르세요 (이 홀 거리 기준으로 저장)'):TR('지도를 누르면 거리가 표시됩니다.'); } return; }
  if(a==='pinHere'&&r&&UI.pos){
    var ph=r.order[r.idx], pref=refOf(r,ph);
    S.greens[r.courseId]=S.greens[r.courseId]||{}; S.greens[r.courseId][pref]=[+UI.pos[0].toFixed(6),+UI.pos[1].toFixed(6)];
    save(); render(); toast((UI.acc>25?TR('저장했어요 (GPS 오차가 커서 위성지도에서 다시 확인 권장)'):TR('이 홀 그린 위치를 저장했어요')),3000); return;
  }
  if(a==='geoGetRound'&&r){ geoGetFor(r.courseId); return; }
  /* 공유 */
  if(a==='share'){
    var rr=findRound(el.getAttribute('data-rid'));
    if(rr){ var t=shareText(rr); if(navigator.share){ navigator.share({text:t}).catch(function(err){ if(!err||err.name!=='AbortError'){ copyText(t); } }); } else { copyText(t); } }
    return;
  }
  if(a==='shareImg'){
    var ri=findRound(el.getAttribute('data-rid'));
    if(ri){ cardImage(ri).then(function(b){ if(b){ shareOrDownload(b,'scorecard-'+ri.date+'.png',TR('스코어카드'),true); } }); }
    return;
  }
  /* 내기 */
  if(a==='betMode'){ var rb=findRound(el.getAttribute('data-rid')); rb.bet.mode=el.getAttribute('data-v'); save(); render(); return; }
  if(a==='betNet'){ var rn=findRound(el.getAttribute('data-rid')); rn.bet.net=!rn.bet.net; save(); render(); return; }
  if(a==='curSet'){ var rc=findRound(el.getAttribute('data-rid')); rc.cur=el.getAttribute('data-v'); S.set.cur=rc.cur; save(); render(); return; }
  /* 기록 */
  if(a==='hist'){ var id=el.getAttribute('data-id'); UI.openHist=(UI.openHist===id)?null:id; render(); return; }
  if(a==='delHist'){
    var did=el.getAttribute('data-id');
    openModal(TR('기록 삭제'),TR('<p>이 라운드 기록을 삭제할까요? 되돌릴 수 없습니다.</p>'),
      [{label:TR('취소'),cls:'ghost'},{label:TR('삭제'),cls:'danger',fn:function(){ S.rounds=S.rounds.filter(function(x){ return x.id!==did; }); UI.openHist=null; save(); render(); }}]); return;
  }
  if(a==='backupSave'){ backupOut(false); return; }
  if(a==='backupShare'){ backupOut(true); return; }
  if(a==='backupCopy'){ copyText(JSON.stringify(backupObj())); S.set.lastBackup=Date.now(); S.set.backupCount=S.rounds.length; save(); return; }
  if(a==='restoreFile'){ $('#fileIn').value=''; $('#fileIn').click(); return; }
  if(a==='restoreText'){ try{ restoreData(JSON.parse($('#restoreBox').value)); }catch(err){ toast(TR('백업 데이터 형식이 올바르지 않아요')); } return; }
  /* 통계 */
  if(a==='statP'){ UI.statP=el.getAttribute('data-v'); render(); return; }
  /* 코스 */
  if(a==='courseOpen'){ UI.openCourse=el.getAttribute('data-id'); render(); window.scrollTo(0,0); return; }
  if(a==='courseClose'){ UI.openCourse=null; render(); return; }
  if(a==='cyc'){
    var key=el.getAttribute('data-key'), idx=parseInt(el.parentNode.getAttribute('data-base')||'0',10)+parseInt(el.getAttribute('data-h'),10);
    var arr=parArrOf(key).slice();
    arr[idx]=arr[idx]===3?4:(arr[idx]===4?5:(arr[idx]===5?6:3));
    S.pars[key]=arr; save(); render(); return;
  }
  if(a==='parApply'){
    var pk=el.getAttribute('data-key'), len=parseInt(el.getAttribute('data-len'),10);
    var inp=document.querySelector('[data-parstr="'+pk.replace(/"/g,'')+'"]');
    var digs=((inp&&inp.value)||'').replace(/[^0-9]/g,'');
    if(digs.length!==len){ toast(TR('숫자 ')+len+TR('개를 입력해 주세요 (현재 ')+digs.length+TR('개)')); return; }
    var arr2=digs.split('').map(Number);
    for(var z=0;z<len;z++){ if(arr2[z]<3||arr2[z]>6){ toast((z+1)+TR('번 홀 파는 3~6 사이여야 해요')); return; } }
    S.pars[pk]=arr2; save(); render(); toast(TR('파 정보를 저장했어요 (합계 ')+sum(arr2)+')'); return;
  }
  if(a==='resetPar'){ delete S.pars[el.getAttribute('data-key')]; save(); render(); toast(TR('원래 값으로 복원했어요')); return; }
  if(a==='useCourse'){
    initSetup(); var uc=courseOf(UI.openCourse); UI.setup.courseId=uc.id;
    if(uc.nines){ UI.setup.front=uc.nines[0].k; UI.setup.back=(uc.nines[1]||uc.nines[0]).k; }
    UI.tab='round'; render(); window.scrollTo(0,0); return;
  }
  if(a==='rename'){ var rc2=courseOf(UI.openCourse), nn=($('#renameIn').value||'').trim(); if(rc2&&nn){ rc2.name=nn; save(); render(); toast(TR('이름을 바꿨어요')); } return; }
  if(a==='addCourse'){
    var nm=($('#newCourse').value||'').trim();
    if(!nm){ toast(TR('골프장 이름을 입력해 주세요')); return; }
    var nid='c'+Date.now();
    S.custom.push({id:nid,name:nm,area:TR('사용자 추가'),par:PAR_STD.slice(),si:null,custom:true,unverified:true,src:TR('사용자가 직접 입력한 코스')});
    UI.openCourse=nid; save(); render(); window.scrollTo(0,0); return;
  }
  if(a==='delCourse'){
    var cid=UI.openCourse;
    openModal(TR('코스 삭제'),TR('<p>이 코스를 목록에서 삭제할까요? (저장된 라운드 기록은 유지됩니다)</p>'),
      [{label:TR('취소'),cls:'ghost'},{label:TR('삭제'),cls:'danger',fn:function(){
        S.custom=S.custom.filter(function(x){ return x.id!==cid; });
        Object.keys(S.pars).forEach(function(k){ if(k===cid||k.indexOf(cid+':')===0){ delete S.pars[k]; } });
        GEO.dropGeo(cid); delete S.greens[cid]; UI.openCourse=null;
        if(UI.setup&&UI.setup.courseId===cid){ UI.setup=null; } save(); render(); }}]); return;
  }
  if(a==='geoGet'){ geoGetFor(el.getAttribute('data-id')); return; }
  if(a==='geoDrop'){
    var gid=el.getAttribute('data-id');
    openModal(TR('지도 데이터 지우기'),TR('<p>이 코스의 홀 지도 데이터를 지울까요? (스코어·파 정보는 그대로)</p>'),[{label:TR('취소'),cls:'ghost'},{label:TR('지우기'),cls:'danger',fn:function(){ GEO.dropGeo(gid); render(); }}]); return;
  }
  /* 온라인 검색 */
  if(a==='nearby'){ UI.search=UI.search&&UI.search.attach?{attach:UI.search.attach}:{}; doNearby(); return; }
  if(a==='searchGo'){ doSearch(($('#searchIn').value||'').trim()); return; }
  if(a==='pick'){ var x=(UI.search&&UI.search.results||[])[parseInt(el.getAttribute('data-i'),10)]; if(x){ pickResult(x); } return; }
  if(a==='attachCancel'){ UI.search={}; render(); return; }
}
function parArrOf(key){
  if(key.indexOf(':')>=0){
    var cid=key.split(':')[0], nk=key.split(':')[1], c=courseOf(cid), n=c.nines.filter(function(x){ return x.k===nk; })[0];
    return ninePar(c,n);
  }
  return parsOf(courseOf(key));
}
function holeTap(svg,e){
  var r=S.current, m=UI.holeMeta, hit=GEO.svgTapLL(svg,e,m); if(!hit){ return; }
  var u=S.set.unit, from=UI.pos&&GEO.dist(UI.pos,m.tee)<1500?UI.pos:m.tee, fromTxt=from===m.tee?TR('티'):TR('내 위치');
  var d1=GEO.dist(from,hit.ll), d2=GEO.dist(hit.ll,m.gc);
  var ti=$('#tapInfo'); if(ti){ ti.style.display='block'; ti.innerHTML=fromTxt+TR('→여기 <b>')+GEO.fmtD(d1,u)+TR('</b> · 그린까지 <b>')+GEO.fmtD(d2,u)+'</b>'+unitName(); }
  var gm=svg.querySelector('#tapMark');
  if(gm){
    var F=m.S(m.T(from));
    gm.innerHTML='<line x1="'+F[0]+'" y1="'+F[1]+'" x2="'+hit.sx.toFixed(1)+'" y2="'+hit.sy.toFixed(1)+'" stroke="#ffeb3b" stroke-width="1.4"/>'+
      '<circle cx="'+hit.sx.toFixed(1)+'" cy="'+hit.sy.toFixed(1)+'" r="4" fill="#ffeb3b" stroke="#000" stroke-width="1"/>';
  }
}
function onInput(e){
  var t=e.target, f=t.getAttribute&&t.getAttribute('data-field');
  if(t.id==='quickPar'){ UI._qp=t.value; return; }
  if(t.id==='searchIn'){
    var qv=(t.value||'').trim(); UI.search=UI.search||{}; UI.search.q=t.value;
    clearTimeout(onInput._st);
    onInput._st=setTimeout(function(){
      if(!qv){ return; }
      var pos=UI.pos||S.set.lastPos||null;
      var res=GEO.quick(qv,pos);
      UI.search.results=res; UI.search.err=null; UI.search.live=true;
      var box=document.getElementById('searchResults'); if(box){ box.innerHTML=resultsHtml(UI.search); }
    },200);
    return;
  }
  if(f&&UI.setup){
    if(f==='name'){ UI.setup.names[parseInt(t.getAttribute('data-i'),10)]=t.value; }
    else if(f==='hcp'){ UI.setup.hcps[parseInt(t.getAttribute('data-i'),10)]=t.value; }
    else if(f==='date'){ UI.setup.date=t.value; }
    return;
  }
  if(t.getAttribute&&t.getAttribute('data-bet')==='unit'){
    var rb=findRound(t.getAttribute('data-rid')); if(rb){ rb.bet.unit=num(t.value)||0; save(); }
  }
}
function onChange(e){
  var t=e.target, f=t.getAttribute&&t.getAttribute('data-field');
  if(f==='course'&&UI.setup){
    UI.setup.courseId=t.value; var c=courseOf(t.value);
    UI.setup.front=c.nines?c.nines[0].k:null; UI.setup.back=c.nines?(c.nines[1]||c.nines[0]).k:null; UI.setup.start=0;
    render(); return;
  }
  if(t.getAttribute&&t.getAttribute('data-bet')){ render(); }
}
function onKey(e){
  if(e.key==='Enter'&&e.target.id==='searchIn'){ doSearch((e.target.value||'').trim()); }
}

/* ================= 서비스워커 (오프라인 · 업데이트) ================= */
var swReg=null, reloading=false;
function registerSW(){
  if(!('serviceWorker' in navigator)||location.protocol==='file:'){ return; }
  navigator.serviceWorker.register('sw.js').then(function(reg){
    swReg=reg;
    if(reg.waiting&&navigator.serviceWorker.controller){ $('#updBar').style.display='block'; }
    reg.addEventListener('updatefound',function(){
      var nw=reg.installing; if(!nw){ return; }
      nw.addEventListener('statechange',function(){ if(nw.state==='installed'&&navigator.serviceWorker.controller){ $('#updBar').style.display='block'; } });
    });
    setInterval(function(){ reg.update().catch(function(){}); }, 60*60*1000);
  }).catch(function(){});
  navigator.serviceWorker.addEventListener('controllerchange',function(){ if(reloading){ return; } reloading=true; location.reload(); });
}
function applyUpdate(){
  $('#updBar').style.display='none';
  if(swReg&&swReg.waiting){ swReg.waiting.postMessage('skipWaiting'); } else { location.reload(); }
}

/* ================= 연속 탭 확대 방지 =================
   아이폰은 빠르게 두 번 누르면 화면을 확대함 → 버튼 위 연속 탭은 확대 대신 클릭으로 처리 */
var lastTouchEnd=0;
document.addEventListener('touchend',function(e){
  var now=Date.now(), btn=e.target.closest&&e.target.closest('button,[data-act]');
  if(btn && now-lastTouchEnd<400 && !btn.closest('#mapFull') && btn.tagName!=='SELECT' && btn.tagName!=='INPUT'){
    e.preventDefault(); btn.click();
  }
  lastTouchEnd=now;
},{passive:false});
document.addEventListener('gesturestart',function(e){ if(!(e.target.closest&&e.target.closest('#mapFull'))){ e.preventDefault(); } },{passive:false});

/* ================= 호스팅 배지 감지 ================= */
var OWN={fxCanvas:1,fxBanner:1,actBar:1,langPick:1,updBar:1,installBar:1,main:1,tabs:1,mapFull:1,iosGuide:1,modalRoot:1,toast:1,fileIn:1};
function checkBadge(){
  var found=false;
  Array.prototype.forEach.call(document.body.children,function(el){
    if(el.tagName==='SCRIPT'||el.tagName==='HEADER'||OWN[el.id]){ return; }
    var cs=getComputedStyle(el); if(cs.display==='none'||cs.visibility==='hidden'){ return; }
    var r=el.getBoundingClientRect();
    if((cs.position==='fixed'||cs.position==='sticky'||el.tagName==='IFRAME')&&r.height>0&&r.bottom>window.innerHeight-120){ found=true; }
  });
  if(!found){ var t=document.body.innerText||''; if(/Powered by Netlify/i.test(t.slice(-400))){ found=true; } }
  var on=S.set.badgeGap==='on'||(S.set.badgeGap!=='off'&&found);
  document.documentElement.classList.toggle('badge',on);
}
try{ new MutationObserver(function(){ checkBadge(); }).observe(document.body,{childList:true}); }catch(e){}
setTimeout(checkBadge,800); setTimeout(checkBadge,3000);

/* ================= 시작 ================= */
load();
applyTheme();
document.addEventListener('click',onClick);
document.addEventListener('input',onInput);
document.addEventListener('change',onChange);
document.addEventListener('keydown',onKey);
$('#fileIn').addEventListener('change',function(){
  var f=this.files&&this.files[0]; if(!f){ return; }
  var rd=new FileReader();
  rd.onload=function(){ try{ restoreData(JSON.parse(rd.result)); }catch(err){ toast(TR('백업 파일 형식이 올바르지 않아요')); } };
  rd.readAsText(f);
});
render();
updateInstallBtn();
setTimeout(showInstallBar,1500);
registerSW();
if(isStandalone()){ askPersist(); }
setTimeout(function(){ if(navigator.onLine!==false){ GEO.prefetch(S.set.lastPos||null); } }, 4000);
if(S.current&&S.set.gps&&GEO.loadGeo(S.current.courseId)){ gpsOn(); }
window.GS={pickResult:pickResult,S:S,UI:UI,render:render,stats:stats,betCalc:betCalc,strokes:strokes,buildLayout:buildLayout,courseOf:courseOf};
})();
