// =========================================================================
// ASSETS REGISTRY (26 High-Res 16-Bit Pixel Art Assets)
// =========================================================================
const ASSET_PATHS = {
  // 5개 스테이지 2.5D 맵
  map_village: 'assets/map_village.jpg',
  map_forest:  'assets/map_forest.jpg',
  map_chibi:   'assets/map_chibi.jpg',
  map_hulao:   'assets/map_hulao.jpg',
  map_palace:  'assets/map_palace.jpg',

  // 전투 전용 16비트 배경 & 컷신 & 배너
  battle_bg_forest:   'assets/battle_bg_forest.jpg',
  battle_bg_fortress: 'assets/battle_bg_fortress.jpg',
  battle_bg_palace:   'assets/battle_bg_palace.jpg',
  ending_shenron:     'assets/ending_shenron.jpg',
  shop_banner:        'assets/shop_banner.jpg',
  og_banner:          'assets/og_banner.jpg',

  // 대화창 초상화 (6종)
  portrait_liubei:   'assets/portrait_liubei.jpg',
  portrait_guanyu:   'assets/portrait_guanyu.jpg',
  portrait_zhangfei: 'assets/portrait_zhangfei.jpg',
  portrait_zhuge:    'assets/portrait_zhuge.jpg',
  portrait_merchant: 'assets/portrait_merchant.jpg',
  portrait_boss:     'assets/portrait_boss.jpg',

  // 필드 & 전투 도트 스프라이트 (9종)
  sprite_liubei:   'assets/sprite_liubei.png',
  sprite_guanyu:   'assets/sprite_guanyu.png',
  sprite_zhangfei: 'assets/sprite_zhangfei.png',
  sprite_zhuge:    'assets/sprite_zhuge.png',
  sprite_npc:      'assets/sprite_npc.png',
  sprite_merchant: 'assets/sprite_merchant.png',
  sprite_enemy:    'assets/sprite_enemy.png',
  sprite_lubu:     'assets/sprite_lubu.png',
  sprite_liubei_back:   'assets/sprite_liubei_back.png?v=field2',
  sprite_liubei_side:   'assets/sprite_liubei_side.png?v=field2',
  sprite_guanyu_back:   'assets/sprite_guanyu_back.png?v=field2',
  sprite_guanyu_side:   'assets/sprite_guanyu_side.png?v=field2',
  sprite_zhangfei_back: 'assets/sprite_zhangfei_back.png?v=field2',
  sprite_zhangfei_side: 'assets/sprite_zhangfei_side.png?v=field2',
  sprite_zhuge_back:    'assets/sprite_zhuge_back.png?v=field2',
  sprite_zhuge_side:    'assets/sprite_zhuge_side.png?v=field2',
  item_dragonball: 'assets/item_dragonball.png'
};

// =========================================================================
// SHOP & EQUIPMENT CATALOG
// =========================================================================
const ITEMS_DB = {
  w_twin:    { id: 'w_twin',    type: 'weapon', name: '자웅일대검 (기본)', atk: 8,  def: 0,  crit: 5,  price: 0,   desc: '유비의 기본 쌍검 (공격 +8)' },
  w_iron:    { id: 'w_iron',    type: 'weapon', name: '청강검',           atk: 18, def: 0,  crit: 10, price: 120, desc: '강철을 베는 명검 (공격 +18, 치명 +10%)' },
  w_seven:   { id: 'w_seven',   type: 'weapon', name: '칠성보검',         atk: 30, def: 4,  crit: 18, price: 280, desc: '칠성 보석이 박힌 보검 (공격 +30, 방어 +4, 치명 +18%)' },
  w_dragon:  { id: 'w_dragon',  type: 'weapon', name: '용천신검',         atk: 46, def: 8,  crit: 25, price: 500, desc: '전설의 명장이 벼려낸 신검 (공격 +46, 치명 +25%)' },

  a_cloth:   { id: 'a_cloth',   type: 'armor',  name: '비단 도포 (기본)', atk: 0,  def: 4,  crit: 0,  price: 0,   desc: '가벼운 평복 (방어 +4)' },
  a_iron:    { id: 'a_iron',    type: 'armor',  name: '현철 갑옷',        atk: 0,  def: 12, crit: 0,  price: 110, desc: '단단한 철제 갑주 (방어 +12)' },
  a_feather: { id: 'a_feather', type: 'armor',  name: '학창의 비단갑',    atk: 6,  def: 18, crit: 10, price: 0,   desc: '서브퀘스트 보상! (방어 +18, 공격 +6, 치명 +10%)' },
  a_gold:    { id: 'a_gold',    type: 'armor',  name: '황금 용린갑',      atk: 6,  def: 26, crit: 6,  price: 340, desc: '황금 비늘로 엮은 명품 갑옷 (방어 +26, 공격 +6)' },

  ac_jade:   { id: 'ac_jade',   type: 'acc',    name: '비취 용옥패',      atk: 8,  def: 8,  crit: 12, price: 220, desc: '기운을 북돋는 비취 옥패 (공+8, 방+8, 치명+12%)' },
  ac_seal:   { id: 'ac_seal',   type: 'acc',    name: '황실 옥새 조각',   atk: 15, def: 13, crit: 20, price: 0,   desc: '숨겨진 보물! (공+15, 방+13, 치명+20%)' },

  c_herb:    { id: 'c_herb',    type: 'consumable', name: '회복 탕약',    healHp: 70, price: 35,  desc: '체력을 70 회복한다.' },
  c_elixir:  { id: 'c_elixir',  type: 'consumable', name: '기력 환약',    healMp: 45, price: 45,  desc: '기력(MP)을 45 회복한다.' },
  c_thunder: { id: 'c_thunder', type: 'consumable', name: '천둥 부적',    dmg: 80,    price: 75,  desc: '전투 시 적에게 방어 무시 번개 피해 80!' }
};

const SHOP_LIST = ['w_iron', 'w_seven', 'w_dragon', 'a_iron', 'a_gold', 'ac_jade', 'c_herb', 'c_elixir', 'c_thunder'];

// 5막에 고르게 배치된 7개 칠성용옥 메인 퀘스트 & 레이더 좌표
const BALL_QUESTS = [
  { num: 1, stage: 'village', x: 315, y: 315, loc: '제1막 탁군 마을',   title: '촌장의 가보',        hint: '탁군 마을 중앙의 마을 촌장과 대화하라.' },
  { num: 2, stage: 'village', x: 165, y: 365, loc: '제1막 탁군 마을',   title: '도난당한 무기 창고',  hint: '마을 좌측 무기 창고 앞 빛나는 단서를 조사하라.' },
  { num: 3, stage: 'forest',  x: 415, y: 355, loc: '제2막 도원 숲',     title: '산채 두목 장보 토벌', hint: '도원 숲 산채의 황건적 대장 장보를 격파하라.' },
  { num: 4, stage: 'chibi',   x: 295, y: 270, loc: '제3막 적벽 나루터', title: '제갈량의 지략 시험',  hint: '적벽 나루터 정자 앞 제갈량의 암호 수수께끼를 풀어라.' },
  { num: 5, stage: 'hulao',   x: 270, y: 245, loc: '제4막 호로관 관문', title: '맹장 화웅 돌파전',    hint: '호로관 성문을 지키는 맹장 화웅을 쓰러뜨려라.' },
  { num: 6, stage: 'palace',  x: 145, y: 365, loc: '제5막 낙양 황궁',   title: '황궁 비석의 비밀',    hint: '황궁 제단 좌측의 고대 비석 틈새를 조사하라.' },
  { num: 7, stage: 'palace',  x: 270, y: 275, loc: '제5막 낙양 황궁',   title: '천하무쌍 여포 결전',  hint: '제단 중앙의 최종 보스 여포를 쓰러뜨리고 7성구를 완성하라.' }
];

// 3종 의뢰 서브 퀘스트
const SUB_QUESTS_DB = [
  { id: 'sq_herb',    loc: '제1막 → 제2막', title: '촌장의 약초 의뢰',        desc: '도원 숲 서쪽의 [신비한 약초]를 채집해 탁군 마을 촌장에게 전달하라.', reward: '150G + 회복 탕약 ×2' },
  { id: 'sq_compass', loc: '제3막 적벽',    title: '잃어버린 황금 나침반',    desc: '적벽 강변 버드나무 아래에서 나침반을 찾아 뱃사공에게 돌려주라.',       reward: '[학창의 비단갑] (방+18)' },
  { id: 'sq_supply',  loc: '제4막 호로관',  title: '빼앗긴 군량미 보급 상자', desc: '호로관 협곡 우측의 보급 상자를 회수해 아군 전력을 보충하라.',          reward: '250G + 천둥 부적 ×2' }
];

// 5개 맵별 실제 지형 충돌 박스 (F2 디버그 모드로 실시간 확인 가능)
const STAGE_COLLIDERS = {
  village: [
    { x: 10,  y: 65,  w: 135, h: 85 },
    { x: 395, y: 75,  w: 135, h: 85 },
    { x: 225, y: 175, w: 90,  h: 75 },
    { x: 75,  y: 245, w: 125, h: 80 },
    { x: 365, y: 265, w: 115, h: 80 },
    { x: 35,  y: 415, w: 95,  h: 175 },
    { x: 435, y: 460, w: 95,  h: 120 },
    { x: 0,   y: 625, w: 540, h: 95 }
  ],
  forest: [
    { x: 290, y: 0,   w: 250, h: 215 },
    { x: 0,   y: 180, w: 72,  h: 470 },
    { x: 485, y: 215, w: 55,  h: 350 }
  ],
  chibi: [
    { x: 385, y: 0,   w: 155, h: 720 }, // 동쪽 장강(강물)
    { x: 0,   y: 0,   w: 85,  h: 165 }, // 북서 절벽
    { x: 0,   y: 545, w: 95,  h: 175 }  // 남서 수풀
  ],
  hulao: [
    // 성벽과 바위의 발밑에 맞춰 걸을 수 없는 구역을 배치합니다.
    { x: 0, y: 0, w: 70, h: 720 },
    { x: 480, y: 0, w: 60, h: 720 },
    { x: 70, y: 0, w: 245, h: 135 },
    { x: 70, y: 135, w: 150, h: 160 },
    { x: 105, y: 295, w: 115, h: 165 },
    { x: 220, y: 145, w: 180, h: 315 },
    { x: 400, y: 265, w: 80, h: 225 }
  ],
  palace: [
    { x: 0,   y: 0,   w: 210, h: 210 },
    { x: 330, y: 0,   w: 210, h: 195 },
    { x: 0,   y: 475, w: 120, h: 140 },
    { x: 435, y: 345, w: 105, h: 155 }
  ]
};

// 업적 & 엔딩 도감 목록
const ACHIEVEMENTS_DB = [
  { id: 'brothers',    icon: '🤝', name: '도원결의 완전체',     desc: '관우와 장비를 모두 동료로 영입했다.' },
  { id: 'strategist',  icon: '🪶', name: '와룡 선생 합류',      desc: '적벽 나루터에서 제갈량을 군사로 맞이했다.' },
  { id: 'submaster',   icon: '📋', name: '백성의 해결사',       desc: '3종의 서브 퀘스트를 모두 완수했다.' },
  { id: 'hunter',      icon: '🏺', name: '보물 사냥꾼',         desc: '필드에 숨겨진 보물을 4곳 이상 발견했다.' },
  { id: 'lubu_slayer', icon: '⚔️', name: '천하무쌍 격파',       desc: '최종 보스 여포를 쓰러뜨렸다.' },
  { id: 'end_peace',   icon: '🕊️', name: '진 엔딩: 천하태평',   desc: '신룡에게 천하태평의 소원을 빌었다.' },
  { id: 'end_power',   icon: '🔥', name: '무쌍 엔딩: 천하제일', desc: '신룡에게 천하무쌍의 힘을 빌었다.' },
  { id: 'end_wealth',  icon: '💰', name: '부호 엔딩: 만석군',   desc: '신룡에게 만석의 부를 빌었다.' }
];
