/* ============================================================
   골프 스코어 v2 - 기본 코스 데이터
   - par/si : 18홀 코스 (si = 홀 핸디캡 1~18)
   - nines  : 27홀 코스 (9홀 단위 모듈, si9 = 모듈 안 난이도 순위 1~9)
   - unverified : 홀별 파 미확인 → 표준 배치. 코스 탭에서 수정 가능
   - yd : 티별 홀 거리(야드)
   ============================================================ */
var PAR_STD = [4,5,4,3,4,4,3,5,4, 4,3,5,4,4,3,4,5,4];
var TEES = {black:TR('블랙'), blue:TR('블루'), white:TR('화이트'), red:TR('레드')};

var COURSES = [
 /* ★ 자주 가는 코스 */
 {id:'jgc', fav:1, name:'JGC (Jakarta Golf Club)', area:TR('동부 자카르타(Rawamangun)'),
  par:[4,4,3,3,4,4,5,4,5, 4,4,3,4,4,5,3,4,4],
  si:[13,1,15,17,7,5,3,11,9, 8,10,16,2,12,4,18,14,6],
  ll:[-6.1973446351,106.8754593545], gps:'https://www.hole19golf.com/courses/jakarta-golf-club',
  yd:{black:[337,422,218,184,393,422,556,316,462,418,311,191,352,352,495,183,363,422],
      blue:[308,402,203,171,370,410,535,299,448,395,294,180,339,338,478,171,343,413],
      white:[297,379,190,155,352,390,514,287,437,376,279,170,325,319,465,161,331,399],
      red:[293,312,173,137,330,364,502,276,422,354,268,159,308,305,427,150,316,335]},
  src:TR('GolfPass·FlyAway 스코어카드 일치 (파71: OUT 36 / IN 35)')},
 {id:'tigaraksa', fav:1, name:TR('Tigaraksa Golf Residens (구 Takara)'), area:TR('탕에랑 Tigaraksa'),
  par:[5,4,5,4,3,4,4,3,4, 4,5,4,3,5,4,4,4,3],
  si:[8,18,16,12,10,4,2,6,14, 13,3,17,11,1,9,15,7,5],
  ll:[-6.2922830589,106.4704502127], gps:'https://www.hole19golf.com/courses/takara-golf-resort-tigaraksa-tangerang',
  yd:{black:[568,370,535,396,219,414,426,210,393,397,560,380,198,592,417,362,415,168],
      blue:[533,346,506,360,172,392,405,183,368,357,547,380,177,571,377,341,388,127],
      white:[507,320,472,335,145,361,375,165,342,336,522,336,151,556,346,321,364,116],
      red:[470,286,439,280,135,314,346,128,311,310,500,310,130,516,322,284,303,106]},
  src:TR('GolfPass 스코어카드 기준 (파72)')},
 {id:'rh', fav:1, name:TR('Rainbow Hills (27홀)'), area:TR('보고르'),
  ll:[-6.620652531227836,106.88694991296688],
  gps:'https://18birdies.com/golf-courses/club/c7105230-86ac-11e4-8c28-020000005b00/rainbow-hills-golf-club',
  nines:[
   {k:'M', name:'Mountain', par:[4,4,4,5,4,3,4,3,5], si9:[7,2,6,9,1,4,8,5,3],
    yd:{black:[379,402,351,610,436,168,336,185,515]}},
   {k:'S', name:'Stone Hills', par:[4,5,3,4,3,4,4,5,4], si9:[8,2,9,3,7,6,4,1,5],
    yd:{black:[383,510,176,418,170,403,452,540,412]}},
   {k:'F', name:'Forest', par:[4,5,4,3,4,4,3,5,4], si9:null, unverified:true}
  ],
  src:TR('Mountain·Stone Hills는 18Birdies 스코어카드 기준. Forest는 홀별 파 미확인(표준 배치) — 실제 카드로 수정해 주세요.')},

 /* GoGolf 프로모션 코스 */
 {id:'palmsprings-krw', gg:1, name:TR('Palm Springs Karawang (구 Sedana)'), area:TR('카라왕'),
  par:[4,4,3,5,4,3,4,5,4, 4,4,4,3,5,4,3,4,5],
  si:[13,11,9,3,15,17,1,5,7, 10,18,2,16,4,14,6,8,12],
  ll:[-6.347778928,107.2857783387], gps:'https://www.hole19golf.com/courses/palm-springs-golf-country-club-karawang',
  yd:{black:[407,375,206,531,382,189,453,591,417,446,351,452,186,559,387,213,370,510],
      blue:[382,351,184,499,362,174,419,551,387,416,339,433,166,524,369,195,340,486]},
  src:TR('GolfPass 스코어카드 기준 (파72)')},
 {id:'palmhill', gg:1, name:'Palm Hill Golf Club (Sentul)', area:TR('보고르 · 센툴'),
  par:[4,4,5,4,3,4,4,3,5, 4,5,4,4,3,5,4,3,4],
  si:[16,18,2,10,6,8,4,12,14, 7,5,11,3,13,17,15,9,1],
  ll:[-6.5432116881,106.859478022], gps:'https://18birdies.com/golf-courses/club/c6fb4390-86ac-11e4-8c28-020000005b00/palm-hill',
  src:TR('18Birdies 스코어카드 기준 (파72)')},
 {id:'jababeka', gg:1, name:'Jababeka Golf & Country Club', area:TR('치카랑 (Bekasi)'),
  par:[5,3,4,4,4,3,5,4,4, 4,4,4,3,5,4,5,3,4],
  si:[17,15,11,1,3,9,13,7,5, 10,18,6,14,4,2,16,12,8],
  ll:[-6.2952236277,107.1749246521], gps:'https://18birdies.com/golf-courses/club/c6fa0b10-86ac-11e4-8c28-020000005b00/jababeka',
  src:TR('18Birdies 스코어카드 기준 (파72)')},
 {id:'riverside', gg:1, name:'Riverside Golf Club', area:TR('보고르 · Cimanggis'),
  par:[5,3,4,3,4,4,5,4,5, 4,3,4,4,3,4,4,4,5],
  si:[15,9,3,13,7,11,1,17,5, 6,14,2,18,4,16,10,12,8],
  ll:[-6.421620922550064,106.9027501408957], gps:'https://18birdies.com/golf-courses/club/c6fcca30-86ac-11e4-8c28-020000005b00/riverside',
  yd:{black:[582,209,404,171,428,359,517,326,582,424,190,417,405,188,335,436,436,562]},
  src:TR('18Birdies 스코어카드 기준 (파72: OUT 37 / IN 35)')},
 {id:'imperial', gg:1, name:'Imperial Klub Golf', area:TR('탕에랑 · Lippo Karawaci'),
  par:[4,4,4,4,3,5,3,4,5, 4,5,4,4,3,4,3,4,5],
  si:[15,1,9,5,13,7,17,11,3, 12,10,8,4,18,6,14,16,2],
  ll:[-6.2334246541,106.6060341058], gps:'https://www.hole19golf.com/courses/imperial-klub-golf-at-lippo-karawaci',
  yd:{black:[381,419,416,353,157,535,162,407,563,357,514,409,397,205,445,175,384,584],
      blue:[349,385,384,339,139,495,133,346,507,333,485,375,370,163,415,171,355,559],
      white:[320,358,356,328,126,465,100,322,482,319,453,354,362,141,383,150,339,548],
      red:[297,334,308,283,78,433,73,294,445,257,421,331,330,105,345,114,300,462]},
  src:TR('GolfPass 스코어카드 기준 (파72)')},
 {id:'sentul-highlands', gg:1, name:'Sentul Highlands Golf Club', area:TR('보고르 · Sentul City'),
  par:[4,4,5,3,4,5,3,4,4, 4,5,3,4,4,3,4,5,4],
  si:[15,3,5,17,1,13,11,7,9, 2,6,10,18,12,14,4,8,16],
  ll:[-6.5850169898,106.8754345985], gps:'https://18birdies.com/golf-courses/club/c6fb91b0-86ac-11e4-8c28-020000005b00/sentul-highlands-golf-course',
  yd:{black:[468,470,540,144,443,547,186,405,427,430,626,192,339,411,175,394,580,374]},
  src:TR('18Birdies 스코어카드 기준 (파72)')},
 {id:'lotuslakes', gg:1, name:TR('Lotuslakes Golf Club (27홀)'), area:TR('카라왕'),
  nines:[
   {k:'L', name:'Lotus', par:[4,5,4,3,4,4,3,5,4], si9:null, unverified:true},
   {k:'O', name:'Orchid', par:[4,3,5,4,4,3,4,5,4], si9:null, unverified:true},
   {k:'J', name:'Jasmine', par:[4,5,4,3,4,4,3,5,4], si9:null, unverified:true}
  ],
  src:TR('9홀당 파36만 확인. 홀별 파는 표준 배치 — 실제 스코어카드로 수정해 주세요.')},

 /* 기타 */
 {id:'pondokindah', name:'Pondok Indah Golf Course', area:TR('남부 자카르타'),
  par:[4,4,4,4,3,5,4,3,5, 4,4,3,4,5,4,4,3,5],
  si:[15,9,7,17,11,13,5,3,1, 12,18,16,2,8,6,4,14,10],
  gps:'https://www.hole19golf.com/courses/pondok-indah-golf-course',
  yd:{black:[384,411,398,396,212,569,434,235,631,426,372,175,443,561,415,453,193,535]},
  src:TR('18Birdies 스코어카드 기준 (파72). 일부 자료는 파70 — 첫 라운드 때 확인 필요')},
 {id:'cengkareng', name:'Cengkareng Golf Club', area:TR('탕에랑 · 공항 인근'),
  par:[5,4,4,3,5,4,4,3,4, 4,4,3,4,5,4,4,3,5],
  si:[18,6,8,14,2,10,16,12,4, 13,17,7,1,15,3,5,11,9],
  gps:'https://www.hole19golf.com/courses/cengkareng-golf-club',
  yd:{black:[547,448,347,189,550,320,381,201,416,402,324,243,459,513,440,425,178,524]},
  src:TR('18Birdies 스코어카드 기준 (파72)')},
 {id:'damai-bsd', name:'Damai Indah Golf – BSD Course', area:TR('탕에랑(BSD)'), par:PAR_STD, si:null, unverified:true, src:TR('총 파72만 확인, 홀별 파 미확인')},
 {id:'damai-pik', name:'Damai Indah Golf – PIK Course', area:TR('북부 자카르타'), par:PAR_STD, si:null, unverified:true, src:TR('홀별 파 미확인')},
 {id:'royale', name:'Royale Jakarta Golf Club', area:TR('동부 자카르타(27홀)'), par:PAR_STD, si:null, unverified:true, src:TR('27홀 조합별로 달라 미확인')},
 {id:'emeralda', name:'Emeralda Golf Club', area:TR('자카르타 인근'), par:PAR_STD, si:null, unverified:true, src:TR('홀별 파 미확인')},
 {id:'modern', name:'Modern Golf & Country Club', area:TR('탕에랑'), par:PAR_STD, si:null, unverified:true, src:TR('홀별 파 미확인')},
 {id:'jagorawi', name:'Jagorawi Golf & Country Club', area:TR('자카르타 인근'), par:PAR_STD, si:null, unverified:true, src:TR('홀별 파 미확인')},
 {id:'pangkalanjati', name:'Pangkalan Jati Golf Course', area:TR('자카르타 인근'), par:PAR_STD, si:null, unverified:true, src:TR('홀별 파 미확인')}
];
