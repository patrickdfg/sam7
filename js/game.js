// =========================================================================
// 1. 26-ASSET PRELOADER & FLOOD-FILL CHROMA-KEY ENGINE
// =========================================================================
const ASSETS = {};
function stripBorderWhite(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  try {
    const id = g.getImageData(0, 0, c.width, c.height);
    const d = id.data, w = c.width, h = c.height;
    const vis = new Uint8Array(w * h);
    const q = [];
    const isLight = (idx) => d[idx] >= 225 && d[idx+1] >= 225 && d[idx+2] >= 225;
    const push = (x, y) => {
      const p = y * w + x;
      if (!vis[p] && isLight(p * 4)) { vis[p] = 1; q.push(p); }
    };
    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
    let head = 0;
    while (head < q.length) {
      const p = q[head++];
      d[p * 4 + 3] = 0;
      const x = p % w, y = (p - x) / w;
      if (x > 0) push(x - 1, y);
      if (x < w - 1) push(x + 1, y);
      if (y > 0) push(x, y - 1);
      if (y < h - 1) push(x, y + 1);
    }
    g.putImageData(id, 0, 0);
    return c;
  } catch (e) { return img; }
}

function preloadAssets() {
  const entries = Object.entries(ASSET_PATHS);
  let loaded = 0;
  const fill = document.getElementById('loader-fill');
  const txt = document.getElementById('loader-sub');

  const onStep = () => {
    loaded++;
    const pct = Math.round((loaded / entries.length) * 100);
    fill.style.width = pct + '%';
    txt.innerText = `전설의 두루마리를 펼치는 중... (${loaded} / ${entries.length})`;
    if (loaded >= entries.length) {
      setTimeout(() => {
        const pre = document.getElementById('preloader');
        pre.style.opacity = '0';
        setTimeout(() => pre.style.display = 'none', 450);
      }, 200);
    }
  };

  entries.forEach(([key, src]) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let retried = false;
    img.onload = () => {
      ASSETS[key] = (key.startsWith('sprite_') || key.startsWith('item_')) ? stripBorderWhite(img) : img;
      onStep();
    };
    img.onerror = () => {
      if (!retried && src.endsWith('.jpg')) {
        retried = true;
        img.src = src.replace('.jpg', '.png');
      } else {
        onStep();
      }
    };
    img.src = src;
  });
}

// =========================================================================
// 2. STATE, 3-SLOT SAVE SYSTEM, ACHIEVEMENTS & SETTINGS
// =========================================================================
const DEFAULT_STATE = {
  stage: 'village',
  x: 270, y: 545, facing: 1, dir: 'down',
  lv: 1, exp: 0, nextExp: 60,
  hp: 135, maxHp: 135,
  mp: 55,  maxMp: 55,
  baseAtk: 16, baseDef: 6,
  gold: 100,
  equip: { weapon: 'w_twin', armor: 'a_cloth', acc: null },
  ownedEquip: ['w_twin', 'a_cloth'],
  bag: { c_herb: 2, c_elixir: 1, c_thunder: 0 },
  party: { guanyu: false, zhangfei: false, zhuge: false },
  balls: [false,false,false,false,false,false,false],
  subQuests: { sq_herb: 0, sq_compass: 0, sq_supply: 0 }, // 0:미수주/진행전, 1:아이템획득, 2:완료
  loot: {},
  flags: { bandit1: false, banditBoss: false, hulaoGuard: false, huaxiongBoss: false, lubuBoss: false, endingDone: false }
};

let state = JSON.parse(JSON.stringify(DEFAULT_STATE));
let activeSlot = 1;
const SLOT_PREFIX = 'tk_7balls_v4_slot_';
const ACH_KEY = 'tk_7balls_v4_ach';
const SET_KEY = 'tk_7balls_v4_set';

let achievements = JSON.parse(localStorage.getItem(ACH_KEY) || '{}');
let settings = JSON.parse(localStorage.getItem(SET_KEY) || '{"bgm":70,"sfx":85,"debug":false}');
Sound.setVolumes(settings.bgm, settings.sfx);

let debugMode = !!settings.debug;
let mouseCanvasPos = { x: 0, y: 0 };

const trail = [];
let moveTarget = null;
let isMoving = false;
let walkPhase = 0;

function hasAnySave() {
  return [1,2,3].some(n => !!localStorage.getItem(SLOT_PREFIX + n));
}
if (hasAnySave()) document.getElementById('btn-continue').style.display = 'inline-block';

function saveToSlot(slotNum) {
  activeSlot = slotNum;
  const payload = {
    ...state,
    savedAt: new Date().toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })
  };
  localStorage.setItem(SLOT_PREFIX + slotNum, JSON.stringify(payload));
  updateHUD();
}

function saveProgress() {
  saveToSlot(activeSlot);
}

function loadFromSlot(slotNum) {
  const raw = localStorage.getItem(SLOT_PREFIX + slotNum);
  if (!raw) return false;
  activeSlot = slotNum;
  const parsed = JSON.parse(raw);
  state = Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE)), parsed);
  state.subQuests = Object.assign({ sq_herb: 0, sq_compass: 0, sq_supply: 0 }, parsed.subQuests || {});
  state.party = Object.assign({ guanyu: false, zhangfei: false, zhuge: false }, parsed.party || {});
  trail.length = 0;
  moveTarget = null;
  closeModals();
  document.getElementById('title-screen').style.display = 'none';
  Sound.init();
  Sound.playBGM(STAGES[state.stage].bgm);
  updateHUD();
  showStageBanner(STAGES[state.stage].sub, STAGES[state.stage].name);
  showToast(`💾 슬롯 ${slotNum} 불러오기 완료!`);
  return true;
}

function deleteSlot(slotNum) {
  if (confirm(`세이브 슬롯 ${slotNum}의 기록을 삭제할까요?`)) {
    localStorage.removeItem(SLOT_PREFIX + slotNum);
    openSaveModal(currentSaveMode);
  }
}

function unlockAchievement(id) {
  if (achievements[id]) return;
  achievements[id] = true;
  localStorage.setItem(ACH_KEY, JSON.stringify(achievements));
  const a = ACHIEVEMENTS_DB.find(x => x.id === id);
  if (a) { Sound.sfx('levelup'); showToast(`🏆 업적 해금: [${a.name}]`); }
}

function checkSubQuestMaster() {
  if (state.subQuests.sq_herb === 2 && state.subQuests.sq_compass === 2 && state.subQuests.sq_supply === 2) {
    unlockAchievement('submaster');
  }
}

function getStats() {
  const w = ITEMS_DB[state.equip.weapon] || { atk:0, def:0, crit:0 };
  const a = ITEMS_DB[state.equip.armor]  || { atk:0, def:0, crit:0 };
  const ac = ITEMS_DB[state.equip.acc]   || { atk:0, def:0, crit:0 };
  const partyAtk = (state.party.guanyu ? 8 : 0) + (state.party.zhangfei ? 8 : 0) + (state.party.zhuge ? 6 : 0);
  const partyDef = (state.party.guanyu ? 4 : 0) + (state.party.zhangfei ? 5 : 0) + (state.party.zhuge ? 6 : 0);
  return {
    atk: state.baseAtk + w.atk + a.atk + ac.atk + partyAtk,
    def: state.baseDef + w.def + a.def + ac.def + partyDef,
    crit: 8 + w.crit + a.crit + ac.crit + (state.party.zhuge ? 6 : 0)
  };
}

function gainExp(amount) {
  state.exp += amount;
  while (state.exp >= state.nextExp) {
    state.exp -= state.nextExp;
    state.lv++;
    state.nextExp = Math.floor(state.nextExp * 1.42);
    state.maxHp += 24; state.hp = state.maxHp;
    state.maxMp += 10; state.mp = state.maxMp;
    state.baseAtk += 4; state.baseDef += 2;
    Sound.sfx('levelup');
    showToast(`⭐ 레벨 업! Lv.${state.lv} 달성 (공+4, 방+2, 완충)`);
  }
}

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast-banner');
  el.innerText = msg;
  el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.style.opacity = '0', 2600);
}

function collectHiddenLoot(lootId, title, rewardFn, msg) {
  if (state.loot[lootId]) { showDialogue('유비', 'portrait_liubei', '이미 조사하여 비어 있다.'); return; }
  state.loot[lootId] = true;
  rewardFn();
  Sound.sfx('coin');
  if (Object.keys(state.loot).length >= 4) unlockAchievement('hunter');
  saveProgress();
  showDialogue(title, 'portrait_liubei', msg);
}

// =========================================================================
// 3. 5-STAGE WORLD DEFINITIONS (Village -> Forest -> Chibi -> Hulao -> Palace)
// =========================================================================
const STAGES = {
  village: {
    name: '제1막: 탁군 마을', sub: 'CHAPTER I • TAEGUN VILLAGE',
    mapKey: 'map_village', battleBg: 'battle_bg_forest', bgm: 'village', particle: 'dust',
    portals: [{ x: 270, y: 40, to: 'forest', tx: 280, ty: 635, label: '▲ 제2막 도원 숲으로' }],
    entities: [
      { id: 'elder', x: 315, y: 315, sprite: 'sprite_npc', name: '마을 촌장',
        onTalk: () => {
          if (!state.balls[0]) {
            state.gold += 50;
            giveBall(0, '마을 촌장', 'portrait_liubei', '유비 나리! 도적들이 창고를 털었으나 제가 [1성구]와 50금화를 지켰습니다. 아울러 도원 숲에서 [신비한 약초]를 구해주시면 사례하겠습니다!');
          } else if (state.subQuests.sq_herb === 1) {
            state.subQuests.sq_herb = 2;
            state.gold += 150;
            state.bag.c_herb = (state.bag.c_herb||0) + 2;
            Sound.sfx('levelup');
            checkSubQuestMaster();
            saveProgress();
            showDialogue('마을 촌장', 'portrait_liubei', '오오! [신비한 약초]를 구해오셨군요! 약속대로 150금화와 [회복 탕약] 2개를 드리겠습니다!');
          } else {
            showDialogue('마을 촌장', 'portrait_liubei', '상단의 [📡 레이더]로 용옥 위치를 확인하고, [💾 저장]으로 3개 슬롯에 안전하게 기록해 두십시오.');
          }
        }
      },
      { id: 'merchant', x: 395, y: 430, sprite: 'sprite_merchant', name: '대장장이 상점', onTalk: () => openShop() },
      { id: 'zhangfei_npc', x: 175, y: 535, sprite: 'sprite_zhangfei', name: '장비 (동료)', hideIfParty: 'zhangfei',
        onTalk: () => {
          state.party.zhangfei = true;
          Sound.sfx('levelup');
          if (state.party.guanyu) unlockAchievement('brothers');
          saveProgress();
          showDialogue('장비', 'portrait_zhangfei', '하하하! 유비 형님, 이 장비가 장팔사모를 들고 뒤를 따르겠소! 이제 전투에서 합공 필살기를 쓸 수 있소!');
        }
      },
      { id: 'warehouse_ball', x: 165, y: 365, sprite: 'item_dragonball', name: '창고 비밀 단서', hideIfBall: 1,
        onTalk: () => {
          state.gold += 40;
          giveBall(1, '유비', 'portrait_liubei', '무기 창고 짚더미 속에서 빛나는 [2성구]와 40금화를 발견했다! 도적들은 북쪽 도원 숲으로 도주했군.');
        }
      },
      { id: 'loot_v_jars', x: 405, y: 545, sprite: null, hidden: true, name: '장독대 항아리', hideIfLoot: 'v_jars',
        onTalk: () => collectHiddenLoot('v_jars', '숨겨진 발견', () => { state.gold += 60; state.bag.c_herb = (state.bag.c_herb||0)+1; }, '항아리 속에서 비상금 60금화와 [회복 탕약] 1개를 찾아냈다!')
      },
      { id: 'loot_v_hay', x: 215, y: 345, sprite: null, hidden: true, name: '수상한 짚더미', hideIfLoot: 'v_hay',
        onTalk: () => collectHiddenLoot('v_hay', '숨겨진 발견', () => { state.bag.c_thunder = (state.bag.c_thunder||0)+1; }, '짚더미 밑에서 [천둥 부적] 1장을 주웠다!')
      }
    ]
  },

  forest: {
    name: '제2막: 도원 숲 & 황건적 산채', sub: 'CHAPTER II • PEACH BLOSSOM CAMP',
    mapKey: 'map_forest', battleBg: 'battle_bg_forest', bgm: 'forest', particle: 'petal',
    portals: [
      { x: 280, y: 680, to: 'village', tx: 270, ty: 95,  label: '▼ 제1막 탁군 마을로' },
      { x: 140, y: 40,  to: 'chibi',   tx: 210, ty: 635, label: '▲ 제3막 적벽 나루터로' }
    ],
    entities: [
      { id: 'guanyu_npc', x: 205, y: 530, sprite: 'sprite_guanyu', name: '관우 (동료)', hideIfParty: 'guanyu',
        onTalk: () => {
          state.party.guanyu = true;
          Sound.sfx('levelup');
          if (state.party.zhangfei) unlockAchievement('brothers');
          saveProgress();
          showDialogue('관우', 'portrait_guanyu', '형님! 이 관우가 청룡언월도로 함께하겠습니다. 삼형제가 모이면 [도원결의 삼위일체] 합공 컷인을 펼칠 수 있습니다!');
        }
      },
      { id: 'merchant_forest', x: 135, y: 360, sprite: 'sprite_merchant', name: '행상인', onTalk: () => openShop() },
      { id: 'sq_herb_spot', x: 118, y: 470, sprite: null, hidden: true, name: '신비한 약초 (의뢰)', hideIfSubDone: 'sq_herb',
        onTalk: () => {
          if (state.subQuests.sq_herb === 0) {
            state.subQuests.sq_herb = 1;
            Sound.sfx('coin'); saveProgress();
            showDialogue('유비', 'portrait_liubei', '복숭아나무 아래서 [신비한 약초]를 채집했다! 탁군 마을 촌장님께 가져다 드리자.');
          } else {
            showDialogue('유비', 'portrait_liubei', '이미 약초를 채집했다. 마을 촌장님께 전달하자.');
          }
        }
      },
      { id: 'scout', x: 330, y: 455, sprite: 'sprite_enemy', name: '황건적 척후병', hideIfFlag: 'bandit1',
        onTalk: () => startBattle({ name: '황건적 척후병', hp: 105, atk: 18, def: 4, exp: 50, gold: 90, ballIdx: null, flag: 'bandit1', spriteKey: 'sprite_enemy', isBoss: false })
      },
      { id: 'bandit_boss', x: 415, y: 355, sprite: 'sprite_enemy', name: '보스: 황건적 장보', hideIfFlag: 'banditBoss',
        onTalk: () => startBattle({ name: '황건적 대장 장보', hp: 190, atk: 25, def: 8, exp: 110, gold: 180, ballIdx: 2, flag: 'banditBoss', spriteKey: 'sprite_enemy', isBoss: true, chargeMsg: '장보가 태평요술 화염을 모은다! (다음 턴 강공격! 철벽 방어 추천)' })
      },
      { id: 'skirmish_bandit', x: 230, y: 125, sprite: 'sprite_enemy', name: '순찰 도적 (수련전)',
        onTalk: () => startBattle({ name: '황건적 순찰병', hp: 92, atk: 16, def: 3, exp: 45, gold: 80, ballIdx: null, flag: null, spriteKey: 'sprite_enemy', isBoss: false })
      },
      { id: 'loot_f_crate', x: 440, y: 455, sprite: null, hidden: true, name: '산채 보급 상자', hideIfLoot: 'f_crate',
        onTalk: () => collectHiddenLoot('f_crate', '숨겨진 보물', () => { state.gold += 110; state.bag.c_elixir = (state.bag.c_elixir||0)+1; }, '산채 보급 상자에서 110금화와 [기력 환약]을 회수했다!')
      }
    ]
  },

  chibi: {
    name: '제3막: 적벽 강변 나루터', sub: 'CHAPTER III • RED CLIFFS PIER',
    mapKey: 'map_chibi', battleBg: 'battle_bg_forest', bgm: 'chibi', particle: 'dust',
    portals: [
      { x: 210, y: 680, to: 'forest', tx: 145, ty: 95,  label: '▼ 제2막 도원 숲으로' },
      { x: 210, y: 40,  to: 'hulao',  tx: 270, ty: 635, label: '▲ 제4막 호로관 관문으로' }
    ],
    entities: [
      { id: 'zhuge_npc', x: 295, y: 270, sprite: 'sprite_zhuge', name: '제갈량 (군사)',
        onTalk: () => {
          if (!state.balls[3]) {
            document.getElementById('quiz-modal').style.display = 'flex';
          } else if (!state.party.zhuge) {
            state.party.zhuge = true;
            unlockAchievement('strategist');
            saveProgress();
            showDialogue('제갈량', 'portrait_zhuge', '주공의 지혜에 감복했습니다. 이 제갈량이 합류하여 전투 시 매 턴 기력(MP)을 회복하고 치명타율을 높여드리겠습니다!');
          } else {
            showDialogue('제갈량', 'portrait_zhuge', '북쪽 호로관에는 맹장 화웅이 버티고 있습니다. 대장간에서 무기를 정비한 뒤 돌파하십시오.');
          }
        }
      },
      { id: 'boatman', x: 315, y: 465, sprite: 'sprite_npc', name: '적벽 뱃사공',
        onTalk: () => {
          if (state.subQuests.sq_compass === 0) {
            showDialogue('적벽 뱃사공', 'portrait_merchant', '나리! 강변 버드나무 아래에서 제 [황금 나침반]을 잃어버렸습니다. 찾아주시면 귀한 비단 갑옷을 드리겠습니다!');
          } else if (state.subQuests.sq_compass === 1) {
            state.subQuests.sq_compass = 2;
            if (!state.ownedEquip.includes('a_feather')) {
              state.ownedEquip.push('a_feather');
              state.equip.armor = 'a_feather';
            }
            Sound.sfx('levelup');
            checkSubQuestMaster();
            saveProgress();
            showDialogue('적벽 뱃사공', 'portrait_merchant', '정말 감사합니다! 약속드린 명품 [학창의 비단갑](방+18, 공+6)을 드리며 즉시 장착해 드렸습니다!');
          } else {
            showDialogue('적벽 뱃사공', 'portrait_merchant', '덕분에 오늘도 장강을 무사히 건널 수 있겠습니다!');
          }
        }
      },
      { id: 'sq_compass_spot', x: 130, y: 365, sprite: null, hidden: true, name: '반짝이는 나침반', hideIfSubDone: 'sq_compass',
        onTalk: () => {
          if (state.subQuests.sq_compass === 0) {
            state.subQuests.sq_compass = 1;
            Sound.sfx('coin'); saveProgress();
            showDialogue('유비', 'portrait_liubei', '버드나무 뿌리 사이에서 [황금 나침반]을 찾았다! 강변의 뱃사공에게 돌려주자.');
          }
        }
      },
      { id: 'loot_c_dock', x: 335, y: 575, sprite: null, hidden: true, name: '부두 나무통', hideIfLoot: 'c_dock',
        onTalk: () => collectHiddenLoot('c_dock', '숨겨진 보물', () => { state.gold += 130; state.bag.c_herb = (state.bag.c_herb||0)+1; }, '부두 나무통에서 130금화와 [회복 탕약] 1개를 발견했다!')
      }
    ]
  },

  hulao: {
    name: '제4막: 호로관 관문', sub: 'CHAPTER IV • HULAO PASS FORTRESS',
    mapKey: 'map_hulao', battleBg: 'battle_bg_fortress', bgm: 'hulao', particle: 'ember',
    portals: [
      { x: 270, y: 680, to: 'chibi',  tx: 210, ty: 95,  label: '▼ 제3막 적벽 나루터로' },
      { x: 270, y: 40,  to: 'palace', tx: 270, ty: 635, label: '▲ 제5막 낙양 황궁으로' }
    ],
    entities: [
      { id: 'hulao_merchant', x: 125, y: 520, sprite: 'sprite_merchant', name: '전선 보급 상인', onTalk: () => openShop() },
      { id: 'hulao_guard', x: 270, y: 445, sprite: 'sprite_enemy', name: '호로관 선봉대', hideIfFlag: 'hulaoGuard',
        onTalk: () => startBattle({ name: '호로관 정예 선봉대', hp: 165, atk: 24, def: 8, exp: 95, gold: 150, ballIdx: null, flag: 'hulaoGuard', spriteKey: 'sprite_enemy', isBoss: false })
      },
      { id: 'huaxiong_boss', x: 270, y: 245, sprite: 'sprite_enemy', name: '보스: 맹장 화웅', hideIfFlag: 'huaxiongBoss',
        onTalk: () => startBattle({ name: '호로관 맹장 화웅', hp: 260, atk: 31, def: 11, exp: 170, gold: 280, ballIdx: 4, flag: 'huaxiongBoss', spriteKey: 'sprite_enemy', isBoss: true, chargeMsg: '화웅이 대도를 치켜들고 맹렬한 참격을 준비한다! (철벽 방어 필수!)' })
      },
      { id: 'sq_supply_spot', x: 405, y: 475, sprite: null, hidden: true, name: '군량미 보급 상자 (의뢰)', hideIfSubDone: 'sq_supply',
        onTalk: () => {
          state.subQuests.sq_supply = 2;
          state.gold += 250;
          state.bag.c_thunder = (state.bag.c_thunder||0) + 2;
          Sound.sfx('levelup');
          checkSubQuestMaster();
          saveProgress();
          showDialogue('서브 퀘스트 완료!', 'portrait_guanyu', '빼앗긴 군량미 보급 상자를 회수했다! 250금화와 [천둥 부적] 2장을 획득했다!');
        }
      }
    ]
  },

  palace: {
    name: '제5막: 낙양 황궁 용옥 제단', sub: 'CHAPTER V • IMPERIAL DRAGON ALTAR',
    mapKey: 'map_palace', battleBg: 'battle_bg_palace', bgm: 'palace', particle: 'ember',
    portals: [{ x: 270, y: 680, to: 'hulao', tx: 270, ty: 95, label: '▼ 제4막 호로관으로' }],
    entities: [
      { id: 'palace_stone', x: 145, y: 365, sprite: 'item_dragonball', name: '황궁 비밀 비석', hideIfBall: 5,
        onTalk: () => {
          state.gold += 140;
          giveBall(5, '유비', 'portrait_liubei', '제단 옆 비석 틈새에서 [6성구]와 140금화를 찾아냈다! 이제 마지막 7성구는 중앙 제단의 마장 여포가 쥐고 있다!');
        }
      },
      { id: 'lubu_boss', x: 270, y: 275, sprite: 'sprite_lubu', name: '최종 보스: 여포', hideIfFlag: 'lubuBoss',
        onTalk: () => startBattle({ name: '천하무쌍 여포', hp: 380, atk: 38, def: 14, exp: 320, gold: 600, ballIdx: 6, flag: 'lubuBoss', spriteKey: 'sprite_lubu', isBoss: true, isFinal: true, chargeMsg: '여포가 방천화극에 붉은 살기를 모은다! (다음 턴 초필살기! 철벽 방어 필수!)' })
      },
      { id: 'altar_summon', x: 270, y: 345, sprite: 'item_dragonball', name: '황금 신룡 제단',
        onTalk: () => {
          if (state.balls.every(Boolean)) triggerEnding();
          else showDialogue('유비', 'portrait_liubei', `아직 칠성용옥이 모자라다 (${state.balls.filter(Boolean).length}/7). 7개의 용옥을 모두 모아 제단에 바치자!`);
        }
      },
      { id: 'loot_p_incense', x: 180, y: 475, sprite: null, hidden: true, name: '고대 청동 향로', hideIfLoot: 'p_incense',
        onTalk: () => collectHiddenLoot('p_incense', '전설의 보물!', () => {
          if (!state.ownedEquip.includes('ac_seal')) {
            state.ownedEquip.push('ac_seal');
            state.equip.acc = 'ac_seal';
          }
        }, '청동 향로 안에서 전설의 장신구 [황실 옥새 조각]을 발견해 자동 장착했다! (공+15, 방+13, 치명+20%)')
      },
      { id: 'loot_p_bamboo', x: 375, y: 555, sprite: null, hidden: true, name: '대나무 정원 상자', hideIfLoot: 'p_bamboo',
        onTalk: () => collectHiddenLoot('p_bamboo', '숨겨진 보물', () => { state.bag.c_thunder = (state.bag.c_thunder||0)+2; state.bag.c_herb = (state.bag.c_herb||0)+1; }, '대나무 정원 상자에서 [천둥 부적] 2장과 [회복 탕약] 1개를 얻었다!')
      }
    ]
  }
};

// =========================================================================
// 4. STAGE TRANSITION, DRAGON RADAR & MULTI-SLOT SAVE UI
// =========================================================================
let isTransitioning = false;
function changeStage(toStage, tx, ty) {
  if (isTransitioning) return;
  isTransitioning = true;
  moveTarget = null;
  Sound.sfx('portal');
  const fade = document.getElementById('stage-fade');
  fade.style.opacity = '1';
  setTimeout(() => {
    state.stage = toStage;
    state.x = tx; state.y = ty;
    trail.length = 0;
    Sound.playBGM(STAGES[toStage].bgm);
    saveProgress();
    fade.style.opacity = '0';
    showStageBanner(STAGES[toStage].sub, STAGES[toStage].name);
    setTimeout(() => isTransitioning = false, 360);
  }, 340);
}

function showStageBanner(sub, main) {
  const b = document.getElementById('stage-banner');
  document.getElementById('banner-sub').innerText = sub;
  document.getElementById('banner-main').innerText = main;
  b.classList.add('show');
  setTimeout(() => b.classList.remove('show'), 2100);
}

let currentSaveMode = 'manage';
function openSaveModal(mode='manage') {
  currentSaveMode = mode;
  document.getElementById('save-modal-title').innerText = mode === 'load' ? '📜 이어하기 (세이브 슬롯 선택)' : '💾 3슬롯 저장 / 불러오기';
  const list = document.getElementById('save-slots-list');
  list.innerHTML = '';
  [1, 2, 3].forEach(n => {
    const raw = localStorage.getItem(SLOT_PREFIX + n);
    const data = raw ? JSON.parse(raw) : null;
    const div = document.createElement('div');
    div.className = 'item-row';
    div.style.borderColor = (activeSlot === n && mode !== 'load') ? '#fde047' : '#475569';
    if (data) {
      const bCnt = (data.balls || []).filter(Boolean).length;
      const stName = STAGES[data.stage] ? STAGES[data.stage].name : data.stage;
      div.innerHTML = `
        <div class="item-info">
          <div class="item-name">슬롯 ${n} ${activeSlot===n && mode!=='load' ? '(자동저장 중)' : ''} — ${stName}</div>
          <div class="item-desc">Lv.${data.lv} | 용옥 ${bCnt}/7 | 💰${data.gold}G | ${data.savedAt || ''}</div>
        </div>
        <div style="display:flex;gap:4px;">
          ${mode !== 'load' ? `<button class="btn-small" onclick="saveToSlot(${n});showToast('슬롯 ${n}에 저장 완료!');openSaveModal('manage')">저장</button>` : ''}
          <button class="btn-small" onclick="loadFromSlot(${n})">불러오기</button>
          <button class="btn-small" style="border-color:#ef4444;color:#fca5a5;" onclick="deleteSlot(${n})">삭제</button>
        </div>
      `;
    } else {
      div.innerHTML = `
        <div class="item-info">
          <div class="item-name">슬롯 ${n} — [비어 있음]</div>
          <div class="item-desc">저장된 기록이 없습니다.</div>
        </div>
        ${mode !== 'load' ? `<button class="btn-small" onclick="saveToSlot(${n});showToast('슬롯 ${n}에 저장 완료!');openSaveModal('manage')">여기에 저장</button>` : '<span style="font-size:11px;color:#64748b;">빈 슬롯</span>'}
      `;
    }
    list.appendChild(div);
  });
  document.getElementById('save-modal').style.display = 'flex';
}

let radarAnimId = null, radarAngle = 0;
function openRadar() {
  Sound.sfx('radar');
  document.getElementById('radar-modal').style.display = 'flex';
  const info = document.getElementById('radar-info');
  const inStage = BALL_QUESTS.filter((q, i) => !state.balls[i] && q.stage === state.stage);
  const otherStage = BALL_QUESTS.filter((q, i) => !state.balls[i] && q.stage !== state.stage);

  if (state.balls.every(Boolean)) {
    info.innerHTML = '🐉 <b>모든 칠성용옥(7/7)을 수집했습니다!</b><br>제5막 낙양 황궁 중앙의 [황금 신룡 제단]으로 이동하세요.';
  } else {
    let html = `<b>현재 지역(${STAGES[state.stage].name}) 미획득 용옥:</b> ${inStage.length}개<br>`;
    html += inStage.length > 0
      ? inStage.map(q => `• [${q.num}성구] ${q.title} (약 ${Math.round(Math.hypot(q.x-state.x, q.y-state.y))}보)`).join('<br>')
      : '• 이 지역에는 남은 용옥이 없습니다.';
    if (otherStage.length > 0) {
      const locs = [...new Set(otherStage.map(q => q.loc))].join(', ');
      html += `<br><span style="color:#fde047;">▶ 타 지역 신호: ${locs}</span>`;
    }
    info.innerHTML = html;
  }

  const rc = document.getElementById('radarCanvas');
  const rg = rc.getContext('2d');
  cancelAnimationFrame(radarAnimId);
  function drawRadar() {
    if (document.getElementById('radar-modal').style.display !== 'flex') return;
    const cx = 120, cy = 120, r = 112;
    rg.fillStyle = '#041d0f'; rg.fillRect(0, 0, 240, 240);
    rg.strokeStyle = 'rgba(34,197,94,0.35)'; rg.lineWidth = 1;
    [36, 72, 108].forEach(rad => { rg.beginPath(); rg.arc(cx, cy, rad, 0, Math.PI*2); rg.stroke(); });
    rg.beginPath(); rg.moveTo(cx, 8); rg.lineTo(cx, 232); rg.moveTo(8, cy); rg.lineTo(232, cy); rg.stroke();

    radarAngle = (radarAngle + 0.045) % (Math.PI * 2);
    rg.save(); rg.translate(cx, cy); rg.rotate(radarAngle);
    const grad = rg.createLinearGradient(0, 0, r, 0);
    grad.addColorStop(0, 'rgba(74,222,128,0.55)'); grad.addColorStop(1, 'rgba(74,222,128,0.02)');
    rg.fillStyle = grad;
    rg.beginPath(); rg.moveTo(0, 0); rg.arc(0, 0, r, -0.35, 0); rg.closePath(); rg.fill();
    rg.restore();

    rg.fillStyle = '#fff';
    rg.beginPath(); rg.moveTo(cx, cy - 6); rg.lineTo(cx - 5, cy + 5); rg.lineTo(cx + 5, cy + 5); rg.closePath(); rg.fill();

    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 160);
    inStage.forEach(q => {
      const dx = (q.x - state.x) * 0.24, dy = (q.y - state.y) * 0.24;
      const dist = Math.hypot(dx, dy);
      const clamp = dist > 98 ? 98 / dist : 1;
      const bx = cx + dx * clamp, by = cy + dy * clamp;
      rg.fillStyle = `rgba(253, 224, 71, ${0.45 + pulse * 0.55})`;
      rg.beginPath(); rg.arc(bx, by, 5 + pulse * 2.5, 0, Math.PI*2); rg.fill();
      rg.fillStyle = '#dc2626'; rg.font = 'bold 10px DungGeunMo, sans-serif'; rg.textAlign = 'center';
      rg.fillText(q.num, bx, by + 3.5);
    });
    radarAnimId = requestAnimationFrame(drawRadar);
  }
  drawRadar();
}

// =========================================================================
// 5. START, HUD, SHOP, INVENTORY, QUEST LOG (MAIN+SUB), SETTINGS & DEBUG
// =========================================================================
function startNewGame() {
  Sound.init();
  state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  activeSlot = 1;
  trail.length = 0; moveTarget = null;
  document.getElementById('title-screen').style.display = 'none';
  Sound.playBGM(STAGES[state.stage].bgm);
  saveProgress();
  showStageBanner(STAGES[state.stage].sub, STAGES[state.stage].name);
  setTimeout(() => {
    showDialogue('유비', 'portrait_liubei', '천하에 흩어진 7개의 칠성용옥을 모아 신룡을 소환하자! 탁군 마을부터 도원 숲, 적벽 나루터, 호로관, 낙양 황궁까지 장대한 여정이 기다린다!');
  }, 550);
}

function giveBall(idx, speaker, portrait, msg) {
  state.balls[idx] = true;
  Sound.sfx('dragonball');
  saveProgress();
  showDialogue(speaker, portrait, msg, () => {
    if (state.balls.every(Boolean)) triggerEnding();
  });
}

function updateHUD() {
  const st = STAGES[state.stage];
  document.getElementById('hud-stage').innerText = st.name;
  document.getElementById('hud-stats').innerText = `Lv.${state.lv} | 💰${state.gold}G`;
  const count = state.balls.filter(Boolean).length;
  document.getElementById('hud-goal').innerText = count === 7
    ? '🐉 칠성용옥 7개 완성! 제5막 황궁 제단에서 신룡 소환!'
    : `용옥(${count}/7) — ${BALL_QUESTS.find((_,i)=>!state.balls[i]).hint}`;

  const row = document.getElementById('hud-balls');
  row.innerHTML = '';
  state.balls.forEach((has, i) => {
    const slot = document.createElement('div');
    slot.className = 'ball-slot' + (has ? ' active' : '');
    slot.innerHTML = `<img src="${ASSET_PATHS.item_dragonball}" onerror="this.src='assets/item_dragonball.png'"><span class="ball-num">${i+1}</span>`;
    row.appendChild(slot);
  });

  const pStrip = document.getElementById('hud-party');
  let pHtml = '<span>군단:</span><span class="party-pill">유비</span>';
  if (state.party.guanyu)   pHtml += '<span class="party-pill">관우</span>';
  if (state.party.zhangfei) pHtml += '<span class="party-pill">장비</span>';
  if (state.party.zhuge)    pHtml += '<span class="party-pill">제갈량</span>';
  pStrip.innerHTML = pHtml;
  const pcStage = document.getElementById('pc-hud-stage');
  if (pcStage) {
    pcStage.innerText = st.name;
    document.getElementById('pc-hud-stats').innerText = `Lv.${state.lv} | 💰${state.gold}G`;
    document.getElementById('pc-hud-goal').innerText = document.getElementById('hud-goal').innerText;
    const pcBalls = document.getElementById('pc-hud-balls');
    pcBalls.innerHTML = '';
    state.balls.forEach((has, i) => {
      const slot = document.createElement('div');
      slot.className = 'ball-slot' + (has ? ' active' : '');
      slot.innerHTML = `<img src="${ASSET_PATHS.item_dragonball}" onerror="this.src='assets/item_dragonball.png'"><span class="ball-num">${i+1}</span>`;
      pcBalls.appendChild(slot);
    });
    document.getElementById('pc-hud-party').innerHTML = pHtml;
  }
}

function closeModals() {
  ['shop-modal','inv-modal','quest-modal','quiz-modal','radar-modal','ach-modal','settings-modal','save-modal'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
  cancelAnimationFrame(radarAnimId);
}

function openShop() {
  Sound.sfx('coin');
  document.getElementById('shop-gold').innerText = `보유 금화: ${state.gold} G`;
  const list = document.getElementById('shop-list');
  list.innerHTML = '';
  SHOP_LIST.forEach(id => {
    const item = ITEMS_DB[id];
    const owned = item.type !== 'consumable' && state.ownedEquip.includes(id);
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
      <div class="item-info">
        <div class="item-name">${item.name} ${item.type==='consumable' ? `(보유 ${state.bag[id]||0})` : ''}</div>
        <div class="item-desc">${item.desc}</div>
      </div>
      <button class="btn-small" ${owned || state.gold < item.price ? 'disabled' : ''} onclick="buyItem('${id}')">
        ${owned ? '보유중' : item.price + ' G'}
      </button>
    `;
    list.appendChild(div);
  });
  document.getElementById('shop-modal').style.display = 'flex';
}

function buyItem(id) {
  const item = ITEMS_DB[id];
  if (state.gold < item.price) return;
  state.gold -= item.price;
  if (item.type === 'consumable') {
    state.bag[id] = (state.bag[id] || 0) + 1;
    Sound.sfx('coin'); showToast(`${item.name} 구매 완료!`);
  } else {
    state.ownedEquip.push(id);
    state.equip[item.type] = id;
    Sound.sfx('equip'); showToast(`${item.name} 구매 및 자동 장착!`);
  }
  saveProgress(); openShop();
}

function openInventory() {
  const s = getStats();
  document.getElementById('inv-stats').innerHTML = `
    <div class="stat-box"><div class="stat-k">레벨 / 경험치</div><div class="stat-v">Lv.${state.lv} (${state.exp}/${state.nextExp})</div></div>
    <div class="stat-box"><div class="stat-k">체력 (HP)</div><div class="stat-v">${state.hp}/${state.maxHp}</div></div>
    <div class="stat-box"><div class="stat-k">기력 (MP)</div><div class="stat-v">${state.mp}/${state.maxMp}</div></div>
    <div class="stat-box"><div class="stat-k">공격력 (ATK)</div><div class="stat-v">${s.atk}</div></div>
    <div class="stat-box"><div class="stat-k">방어력 (DEF)</div><div class="stat-v">${s.def}</div></div>
    <div class="stat-box"><div class="stat-k">치명타 (CRIT)</div><div class="stat-v">${s.crit}%</div></div>
  `;
  const list = document.getElementById('inv-list');
  list.innerHTML = '';
  state.ownedEquip.forEach(id => {
    const it = ITEMS_DB[id];
    const isEq = state.equip[it.type] === id;
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
      <div class="item-info">
        <div class="item-name">[장비] ${it.name}</div>
        <div class="item-desc">${it.desc}</div>
      </div>
      <button class="btn-small" ${isEq ? 'disabled' : ''} onclick="equipItem('${id}')">${isEq ? '장착중' : '장착'}</button>
    `;
    list.appendChild(div);
  });
  ['c_herb', 'c_elixir', 'c_thunder'].forEach(id => {
    const qty = state.bag[id] || 0;
    if (qty <= 0) return;
    const it = ITEMS_DB[id];
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
      <div class="item-info">
        <div class="item-name">[소모품] ${it.name} × ${qty}</div>
        <div class="item-desc">${it.desc}</div>
      </div>
      ${id !== 'c_thunder' ? `<button class="btn-small" onclick="useFieldItem('${id}')">사용</button>` : '<span style="font-size:11px;color:#94a3b8;">전투용</span>'}
    `;
    list.appendChild(div);
  });
  document.getElementById('inv-modal').style.display = 'flex';
}

function equipItem(id) { state.equip[ITEMS_DB[id].type] = id; Sound.sfx('equip'); saveProgress(); openInventory(); }
function useFieldItem(id) {
  if ((state.bag[id] || 0) <= 0) return;
  const it = ITEMS_DB[id]; state.bag[id]--;
  if (it.healHp) state.hp = Math.min(state.maxHp, state.hp + it.healHp);
  if (it.healMp) state.mp = Math.min(state.maxMp, state.mp + it.healMp);
  Sound.sfx('heal'); saveProgress(); openInventory();
}

function openQuestLog(tab='main') {
  document.getElementById('qtab-main').classList.toggle('active', tab === 'main');
  document.getElementById('qtab-sub').classList.toggle('active', tab === 'sub');
  const list = document.getElementById('quest-list');
  list.innerHTML = '';
  if (tab === 'main') {
    BALL_QUESTS.forEach((q, i) => {
      const done = state.balls[i];
      const div = document.createElement('div');
      div.className = 'item-row';
      div.style.borderColor = done ? '#fbbf24' : '#475569';
      div.innerHTML = `
        <div class="item-info">
          <div class="item-name">${done ? '🟠' : '⚫'} [${q.num}성구] ${q.title} <span style="font-size:11px;color:#93c5fd;">(${q.loc})</span></div>
          <div class="item-desc">${done ? '획득 완료!' : q.hint}</div>
        </div>`;
      list.appendChild(div);
    });
  } else {
    SUB_QUESTS_DB.forEach(sq => {
      const st = state.subQuests[sq.id] || 0;
      const badge = st === 2 ? '✅ 완료' : (st === 1 ? '📦 보고 대기' : '진행 가능');
      const div = document.createElement('div');
      div.className = 'item-row';
      div.style.borderColor = st === 2 ? '#4ade80' : '#475569';
      div.innerHTML = `
        <div class="item-info">
          <div class="item-name">${sq.title} <span style="font-size:11px;color:#93c5fd;">(${sq.loc})</span></div>
          <div class="item-desc">${sq.desc}<br><span style="color:#fde047;">보상: ${sq.reward}</span></div>
        </div>
        <span style="font-size:11px;color:${st===2?'#4ade80':'#fde047'};">${badge}</span>`;
      list.appendChild(div);
    });
  }
  document.getElementById('quest-modal').style.display = 'flex';
}

function openAchievements() {
  const list = document.getElementById('ach-list');
  list.innerHTML = '';
  ACHIEVEMENTS_DB.forEach(a => {
    const ok = !!achievements[a.id];
    const div = document.createElement('div');
    div.className = 'item-row';
    div.style.borderColor = ok ? '#fde047' : '#334155';
    div.style.opacity = ok ? '1' : '0.55';
    div.innerHTML = `
      <div class="item-info">
        <div class="item-name">${ok ? a.icon : '🔒'} ${a.name}</div>
        <div class="item-desc">${a.desc}</div>
      </div>
      <span style="font-size:11px;color:${ok?'#4ade80':'#64748b'};">${ok?'달성':'미달성'}</span>`;
    list.appendChild(div);
  });
  document.getElementById('ach-modal').style.display = 'flex';
}

function openSettings() {
  document.getElementById('vol-bgm').value = settings.bgm;
  document.getElementById('vol-sfx').value = settings.sfx;
  document.getElementById('vol-bgm-txt').innerText = settings.bgm + '%';
  document.getElementById('vol-sfx-txt').innerText = settings.sfx + '%';
  document.getElementById('btn-debug-toggle').innerText = debugMode ? 'ON (표시 중)' : 'OFF';
  document.getElementById('settings-modal').style.display = 'flex';
}

function updateVolume() {
  settings.bgm = parseInt(document.getElementById('vol-bgm').value, 10);
  settings.sfx = parseInt(document.getElementById('vol-sfx').value, 10);
  Sound.setVolumes(settings.bgm, settings.sfx);
  document.getElementById('vol-bgm-txt').innerText = settings.bgm + '%';
  document.getElementById('vol-sfx-txt').innerText = settings.sfx + '%';
  localStorage.setItem(SET_KEY, JSON.stringify(settings));
}

function toggleDebugMode() {
  debugMode = !debugMode;
  settings.debug = debugMode;
  localStorage.setItem(SET_KEY, JSON.stringify(settings));
  document.getElementById('debug-bar').style.display = debugMode ? 'block' : 'none';
  const btn = document.getElementById('btn-debug-toggle');
  if (btn) btn.innerText = debugMode ? 'ON (표시 중)' : 'OFF';
  showToast(debugMode ? '🛠️ 충돌 박스 디버그 모드 ON (F2)' : '🛠️ 디버그 모드 OFF');
}

// =========================================================================
// 6. DIALOGUE, QUIZ, 16-BIT BATTLE STAGE (SPRITE LUNGE + CUT-IN) & ENDING
// =========================================================================
let typingTimer = null, afterDialogueCb = null;
function showDialogue(speaker, portraitKey, text, cb=null) {
  afterDialogueCb = cb;
  moveTarget = null;
  document.getElementById('dlg-speaker').innerText = speaker;
  document.getElementById('dlg-portrait').src = ASSET_PATHS[portraitKey] || ASSET_PATHS.portrait_liubei;
  document.getElementById('dialogue-wrap').style.display = 'flex';
  const el = document.getElementById('dlg-text');
  el.innerText = '';
  clearInterval(typingTimer);
  let i = 0;
  typingTimer = setInterval(() => {
    el.innerText += text[i++];
    if (i % 3 === 0) Sound.sfx('talk');
    if (i >= text.length) clearInterval(typingTimer);
  }, 18);
}
function closeDialogue() {
  clearInterval(typingTimer);
  document.getElementById('dialogue-wrap').style.display = 'none';
  if (afterDialogueCb) { const fn = afterDialogueCb; afterDialogueCb = null; fn(); }
}

function answerQuiz(correct) {
  document.getElementById('quiz-modal').style.display = 'none';
  if (correct) {
    state.gold += 80;
    state.party.zhuge = true;
    unlockAchievement('strategist');
    giveBall(3, '제갈량', 'portrait_zhuge', '정답입니다! [4성구]와 80금화를 바치며, 이 제갈량이 주공의 군사로 합류하겠습니다! (매 턴 MP+6 자동 회복 & 치명타 상승)');
  } else {
    Sound.sfx('hit');
    showDialogue('제갈량', 'portrait_zhuge', '허허, 아쉽습니다. 유비 공께서 초가집을 세 번 찾아오신 고사를 다시 떠올려 보십시오.');
  }
}

function spawnFloatText(targetWrapId, text, color) {
  const wrap = document.getElementById(targetWrapId);
  const el = document.createElement('div');
  el.className = 'float-dmg';
  el.style.color = color;
  el.innerText = text;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 880);
}
function triggerSlash(fxId) {
  const el = document.getElementById(fxId);
  el.classList.remove('active'); void el.offsetWidth; el.classList.add('active');
}
function triggerLunge(imgId, cls) {
  const el = document.getElementById(imgId);
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 200);
}

function playCutIn(label, callback) {
  const ov = document.getElementById('cutin-overlay');
  const faces = document.getElementById('cutin-faces');
  let html = `<img src="${ASSET_PATHS.portrait_liubei}">`;
  if (state.party.guanyu)   html += `<img src="${ASSET_PATHS.portrait_guanyu}">`;
  if (state.party.zhangfei) html += `<img src="${ASSET_PATHS.portrait_zhangfei}">`;
  if (state.party.zhuge)    html += `<img src="${ASSET_PATHS.portrait_zhuge}">`;
  faces.innerHTML = html;
  document.getElementById('cutin-label').innerText = label;
  ov.style.display = 'flex';
  Sound.sfx('cutin');
  setTimeout(() => { ov.style.display = 'none'; if (callback) callback(); }, 1050);
}

let activeBattle = null, battleBusy = false;
function getCleanSpriteDataURL(key) {
  const asset = ASSETS[key];
  if (asset && asset.toDataURL) return asset.toDataURL();
  return ASSET_PATHS[key] || ASSET_PATHS.sprite_enemy;
}

function startBattle(cfg) {
  moveTarget = null;
  activeBattle = { ...cfg, maxHp: cfg.hp, turn: 0, charging: false, burnTurns: 0 };
  battleBusy = false;
  Sound.playBGM(cfg.isBoss ? 'boss' : 'battle');
  const bgKey = STAGES[state.stage].battleBg || 'battle_bg_forest';
  document.getElementById('b-stage-bg').src = ASSET_PATHS[bgKey];
  document.getElementById('b-title').innerText = cfg.isBoss ? `🔥 BOSS: ${cfg.name} 출현!` : `⚔️ ${cfg.name} 출현!`;
  document.getElementById('b-enemy-label').innerText = cfg.name;
  document.getElementById('b-player-sprite').src = getCleanSpriteDataURL('sprite_liubei');
  document.getElementById('b-enemy-sprite').src  = getCleanSpriteDataURL(cfg.spriteKey || 'sprite_enemy');
  document.getElementById('b-log').innerText = `${cfg.name}: "용옥을 원한다면 내 무기를 먼저 넘어서라!"`;
  refreshBattleUI();
  document.getElementById('battle-modal').style.display = 'flex';
}

function refreshBattleUI() {
  const b = activeBattle;
  document.getElementById('b-ehp-txt').innerText = `${b.hp}/${b.maxHp}`;
  document.getElementById('b-ehp-bar').style.width = `${Math.max(0, b.hp/b.maxHp*100)}%`;
  document.getElementById('b-php-txt').innerText = `${state.hp}/${state.maxHp}`;
  document.getElementById('b-php-bar').style.width = `${Math.max(0, state.hp/state.maxHp*100)}%`;
  document.getElementById('b-pmp-txt').innerText = `${state.mp}/${state.maxMp}`;
  document.getElementById('b-pmp-bar').style.width = `${Math.max(0, state.mp/state.maxMp*100)}%`;

  const alertEl = document.getElementById('charge-alert');
  const eSpr = document.getElementById('b-enemy-sprite');
  if (b.charging) {
    alertEl.style.display = 'block';
    alertEl.innerText = `⚠️ ${b.chargeMsg || '적이 필살 강공격을 준비 중이다! 철벽 방어 필수!'}`;
    eSpr.classList.add('charging');
  } else {
    alertEl.style.display = 'none';
    eSpr.classList.remove('charging');
  }

  const stEl = document.getElementById('b-status');
  let stHtml = '';
  if (b.burnTurns > 0) stHtml += `<span class="status-pill">🔥 화상 (${b.burnTurns}턴)</span>`;
  if (state.party.zhuge) stHtml += `<span class="status-pill" style="background:#1e3a5f;border-color:#60a5fa;color:#bfdbfe;">🪶 제갈량 지략 (매턴 MP+6)</span>`;
  stEl.innerHTML = stHtml;

  const skillBtn = document.getElementById('btn-b-skill');
  if (state.party.guanyu && state.party.zhangfei && state.party.zhuge) skillBtn.innerText = '🐉 천하삼분지계 합공 (MP 20)';
  else if (state.party.guanyu && state.party.zhangfei) skillBtn.innerText = '🐉 도원결의 삼위일체 (MP 18)';
  else if (state.party.guanyu)   skillBtn.innerText = '🔥 청룡언월도 합공 (MP 15)';
  else if (state.party.zhangfei) skillBtn.innerText = '⚡ 장팔사모 포효 (MP 15)';
  else                           skillBtn.innerText = '🔥 쌍고검 일섬 (MP 12)';

  document.getElementById('btn-b-herb').innerText = `🍵 탕약 (${state.bag.c_herb||0})`;
  document.getElementById('btn-b-thunder').innerText = `⚡ 천둥부적 (${state.bag.c_thunder||0})`;
}

function battleTurn(cmd) {
  if (!activeBattle || battleBusy) return;
  if (cmd === 'skill') {
    const cost = (state.party.guanyu && state.party.zhangfei && state.party.zhuge) ? 20
      : (state.party.guanyu && state.party.zhangfei) ? 18 : (state.party.guanyu || state.party.zhangfei ? 15 : 12);
    if (state.mp < cost) { showToast('기력(MP)이 부족합니다!'); return; }
    state.mp -= cost;
    if (state.party.guanyu || state.party.zhangfei || state.party.zhuge) {
      battleBusy = true;
      const title = (state.party.guanyu && state.party.zhangfei && state.party.zhuge) ? '🐉 촉한사걸 천하삼분지계!!'
        : (state.party.guanyu && state.party.zhangfei) ? '🐉 도원결의 삼위일체!!'
        : (state.party.guanyu ? '🔥 청룡언월도 합공!!' : '⚡ 장팔사모 포효!!');
      playCutIn(title, () => { battleBusy = false; executeBattleResolution('skill'); });
      return;
    }
  }
  executeBattleResolution(cmd);
}

function executeBattleResolution(cmd) {
  const b = activeBattle, s = getStats();
  b.turn++;
  let guard = false, log = '';

  if (cmd === 'attack') {
    triggerLunge('b-player-sprite', 'lunge-right');
    const isCrit = Math.random() * 100 < s.crit;
    const raw = Math.max(9, s.atk - b.def + Math.floor(Math.random()*8));
    const dmg = isCrit ? Math.floor(raw * 1.65) : raw;
    b.hp = Math.max(0, b.hp - dmg);
    Sound.sfx(isCrit ? 'crit' : 'hit');
    triggerSlash('slash-enemy');
    spawnFloatText('b-enemy-wrap', isCrit ? `💥 -${dmg}!` : `-${dmg}`, isCrit ? '#fde047' : '#ffffff');
    log = isCrit ? `💥 회심의 일격! ${b.name}에게 ${dmg} 치명 피해!` : `🗡️ 쌍고검 공격! ${b.name}에게 ${dmg} 피해!`;
  } else if (cmd === 'skill') {
    triggerLunge('b-player-sprite', 'lunge-right');
    const mult = (state.party.guanyu && state.party.zhangfei && state.party.zhuge) ? 2.95
      : (state.party.guanyu && state.party.zhangfei) ? 2.5
      : (state.party.guanyu || state.party.zhangfei ? 1.9 : 1.5);
    const dmg = Math.floor((s.atk * mult) - b.def * 0.4 + Math.random()*16);
    b.hp = Math.max(0, b.hp - dmg);
    Sound.sfx('skill');
    triggerSlash('slash-enemy');
    spawnFloatText('b-enemy-wrap', `🔥 -${dmg}!`, '#fb923c');
    log = `🔥 합공 필살기 작렬! ${b.name}에게 ${dmg} 초강력 피해!`;
  } else if (cmd === 'herb') {
    if ((state.bag.c_herb || 0) <= 0) { showToast('회복 탕약이 없습니다!'); return; }
    state.bag.c_herb--;
    state.hp = Math.min(state.maxHp, state.hp + 70);
    Sound.sfx('heal');
    spawnFloatText('b-player-wrap', '+70 HP', '#4ade80');
    log = `🍵 회복 탕약 사용! 체력 70 회복!`;
  } else if (cmd === 'thunder') {
    if ((state.bag.c_thunder || 0) <= 0) { showToast('천둥 부적이 없습니다!'); return; }
    state.bag.c_thunder--;
    b.hp = Math.max(0, b.hp - 80);
    Sound.sfx('skill');
    triggerSlash('slash-enemy');
    spawnFloatText('b-enemy-wrap', '⚡ -80', '#38bdf8');
    log = `⚡ 천둥 부적 발동! 방어 무시 80 번개 피해!`;
  } else if (cmd === 'guard') {
    guard = true;
    state.mp = Math.min(state.maxMp, state.mp + 14);
    Sound.sfx('talk');
    spawnFloatText('b-player-wrap', '🛡️ 방어 +14MP', '#60a5fa');
    log = `🛡️ 철벽 방어 태세! 피해 경감 & MP +14!`;
  }

  const card = document.getElementById('battle-card');
  card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');

  if (b.hp <= 0) {
    if (b.flag) state.flags[b.flag] = true;
    if (b.isFinal) unlockAchievement('lubu_slayer');
    state.gold += b.gold;
    gainExp(b.exp);
    document.getElementById('battle-modal').style.display = 'none';
    Sound.playBGM(STAGES[state.stage].bgm);
    const rewardTxt = `(보상: +${b.gold}G, +${b.exp}EXP)`;
    if (b.ballIdx !== null) {
      const msg = b.isFinal
        ? `최강의 적 ${b.name}를 쓰러뜨리고 마침내 마지막 [7성구]를 손에 넣었다!! ${rewardTxt}`
        : `${b.name}를 격파하고 [${b.ballIdx+1}성구]를 되찾았다! ${rewardTxt}`;
      giveBall(b.ballIdx, '유비', 'portrait_liubei', msg);
    } else {
      saveProgress();
      showDialogue('유비', 'portrait_liubei', `${b.name}를 제압했다! ${rewardTxt}`);
    }
    activeBattle = null;
    return;
  }

  // 제갈량 지략 패시브 (매 턴 MP +6)
  if (state.party.zhuge) state.mp = Math.min(state.maxMp, state.mp + 6);

  // 적 턴
  let enemyLog = '';
  if (b.charging) {
    b.charging = false;
    triggerLunge('b-enemy-sprite', 'lunge-left');
    const rawSuper = Math.max(24, Math.floor(b.atk * 1.95 - s.def * 0.45));
    const edmg = guard ? Math.max(4, Math.floor(rawSuper * 0.22)) : rawSuper;
    state.hp = Math.max(0, state.hp - edmg);
    triggerSlash('slash-player');
    if (guard) {
      Sound.sfx('equip');
      spawnFloatText('b-player-wrap', `🛡️ 완벽방어 -${edmg}`, '#93c5fd');
      enemyLog = `${b.name}의 필살 강공격을 철벽 방어로 막아냈다! (${edmg} 피해)`;
    } else {
      Sound.sfx('crit');
      b.burnTurns = 2;
      spawnFloatText('b-player-wrap', `💥 -${edmg}!`, '#f87171');
      enemyLog = `${b.name}의 필살 강공격! ${edmg} 대피해 + 화상!`;
    }
  } else if (b.isBoss && b.turn % 3 === 0) {
    b.charging = true;
    Sound.sfx('warn');
    enemyLog = `⚠️ ${b.name}이(가) 다음 턴 필살 강공격을 준비한다!`;
  } else {
    triggerLunge('b-enemy-sprite', 'lunge-left');
    const rawEnemy = Math.max(5, b.atk - Math.floor(s.def * 0.65) + Math.floor(Math.random()*7));
    const edmg = Math.max(3, Math.floor(rawEnemy * (guard ? 0.35 : 1)));
    state.hp = Math.max(0, state.hp - edmg);
    triggerSlash('slash-player');
    spawnFloatText('b-player-wrap', `-${edmg}`, '#fca5a5');
    enemyLog = `${b.name}의 반격으로 ${edmg} 피해!`;
  }

  if (b.burnTurns > 0 && state.hp > 0) {
    state.hp = Math.max(0, state.hp - 8);
    b.burnTurns--;
    enemyLog += ' (화상 -8)';
  }

  if (state.hp <= 0) {
    state.hp = state.maxHp; state.mp = state.maxMp;
    document.getElementById('battle-modal').style.display = 'none';
    Sound.playBGM(STAGES[state.stage].bgm);
    showDialogue('유비', 'portrait_liubei', '잠시 후퇴하여 전열을 가다듬었다. 상점에서 장비를 맞추거나 보스 예고 시 [철벽 방어]를 활용해 보자!');
    activeBattle = null; saveProgress(); return;
  }

  document.getElementById('b-log').innerText = `${log}\n${enemyLog}`;
  refreshBattleUI();
}

function triggerEnding() {
  state.flags.endingDone = true;
  saveProgress();
  Sound.sfx('shenron');
  Sound.playBGM('ending');
  document.getElementById('ending-img').src = ASSET_PATHS.ending_shenron;
  document.getElementById('ending-title').innerText = '🐉 칠성용옥 완성 — 황금 신룡 강림!';
  document.getElementById('ending-text').innerText = '7개의 용옥이 눈부신 빛을 내며 하늘로 솟구쳤다! 천둥과 함께 강림한 황금 신룡이 외친다.\n"그대의 소원을 말하라. 단 하나의 소원을 이루어 주겠다!"';
  document.getElementById('wish-btns').style.display = 'flex';
  document.getElementById('ending-after-btns').style.display = 'none';
  document.getElementById('ending-screen').style.display = 'flex';
}

function chooseWish(type) {
  Sound.sfx('dragonball');
  const texts = {
    peace: '【진 엔딩: 천하태평】\n황금 신룡의 축복이 온 중원에 퍼지며 전란이 영원히 종식되었다. 유비·관우·장비·제갈량의 이름은 천년을 이어 빛났다!',
    power: '【무쌍 엔딩: 천하제일】\n신룡의 기운이 군단에 깃들어 범접할 수 없는 무쌍의 힘을 얻었다! (공격력 +50 영구 증가)',
    wealth: '【부호 엔딩: 만석군】\n황금 비가 쏟아지며 백성들의 창고가 가득 찼다! 군자금으로 9999 금화가 채워졌다!'
  };
  unlockAchievement('end_' + type);
  if (type === 'power') state.baseAtk += 50;
  if (type === 'wealth') state.gold += 9999;
  saveProgress();
  document.getElementById('ending-text').innerText = texts[type];
  document.getElementById('wish-btns').style.display = 'none';
  document.getElementById('ending-after-btns').style.display = 'flex';
}
function continueAfterEnding() {
  document.getElementById('ending-screen').style.display = 'none';
  Sound.playBGM(STAGES[state.stage].bgm);
}

// =========================================================================
// 7. MOVEMENT, COLLISION, DEBUG OVERLAY & 2.5D RENDERER
// =========================================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
function isPcWideMode() {
  return window.innerWidth >= 900 && window.innerWidth > window.innerHeight;
}
function syncResolution() {
  if (isPcWideMode()) { canvas.width = 1920; canvas.height = 1080; }
  else { canvas.width = 540; canvas.height = 720; }
}
syncResolution();
window.addEventListener('resize', syncResolution);
const keys = {};
let touchDir = { x: 0, y: 0 }, stepTick = 0;

const particles = Array.from({ length: 24 }, () => ({
  x: Math.random() * 540, y: Math.random() * 720,
  vx: (Math.random() - 0.5) * 0.8, vy: 0.4 + Math.random() * 0.9,
  sz: 2 + Math.random() * 3, a: Math.random() * Math.PI * 2
}));

function startMove(x, y) { moveTarget = null; touchDir = { x, y }; }
function stopMove() { touchDir = { x: 0, y: 0 }; }

canvas.addEventListener('pointermove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseCanvasPos.x = Math.round((e.clientX - rect.left) * (canvas.width / rect.width));
  mouseCanvasPos.y = Math.round((e.clientY - rect.top)  * (canvas.height / rect.height));
});

canvas.addEventListener('pointerdown', (e) => {
  if (isOverlayOpen() || document.getElementById('dialogue-wrap').style.display === 'flex' || isTransitioning) return;
  const rect = canvas.getBoundingClientRect();
  const cx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const cy = (e.clientY - rect.top)  * (canvas.height / rect.height);
  if (debugMode) {
    console.log(`[DEBUG] Stage=${state.stage} Click=(${Math.round(cx)}, ${Math.round(cy)})`);
    showToast(`📍 좌표 (${Math.round(cx)}, ${Math.round(cy)}) 콘솔 기록됨`);
  }
  const near = getNearestEntity(cx, cy, 46);
  if (near && Math.hypot(near.x - state.x, near.y - state.y) < 88) { near.onTalk(); return; }
  moveTarget = { x: cx, y: cy };
});

window.addEventListener('keydown', e => {
  if (e.key === 'F2') { e.preventDefault(); toggleDebugMode(); return; }
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','w','a','s','d','W','A','S','D'].includes(e.key)) moveTarget = null;
  keys[e.key] = true;
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    if (document.getElementById('dialogue-wrap').style.display === 'flex') closeDialogue();
    else interact();
  }
  if (e.key === 'Escape') closeModals();
});
window.addEventListener('keyup', e => keys[e.key] = false);

function isOverlayOpen() {
  return ['title-screen','battle-modal','shop-modal','inv-modal','quest-modal','quiz-modal','radar-modal','ach-modal','settings-modal','save-modal','ending-screen']
    .some(id => document.getElementById(id).style.display === 'flex');
}

function isEntityVisible(e) {
  if (e.hideIfBall !== undefined && state.balls[e.hideIfBall]) return false;
  if (e.hideIfFlag && state.flags[e.hideIfFlag]) return false;
  if (e.hideIfParty && state.party[e.hideIfParty]) return false;
  if (e.hideIfLoot && state.loot[e.hideIfLoot]) return false;
  if (e.hideIfSubDone && state.subQuests[e.hideIfSubDone] >= 1) return false;
  return true;
}

function getNearestEntity(px, py, maxDist) {
  let best = null, bestD = maxDist;
  for (const e of STAGES[state.stage].entities) {
    if (!isEntityVisible(e)) continue;
    const d = Math.hypot(e.x - px, e.y - py);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

function interact() {
  if (isOverlayOpen() || isTransitioning) return;
  const near = getNearestEntity(state.x, state.y, 82);
  if (near) { near.onTalk(); return; }
  showDialogue('유비', 'portrait_liubei', '머리 위에 [!]나 [🔍] 말풍선이 뜨는 인물·상점·보물·용옥 앞에서 조사해 보자.');
}

function hitsCollider(nx, ny) {
  const cols = STAGE_COLLIDERS[state.stage] || [];
  const r = 14;
  return cols.some(c => nx + r > c.x && nx - r < c.x + c.w && ny + r > c.y && ny - r < c.y + c.h);
}

function update() {
  if (isOverlayOpen() || document.getElementById('dialogue-wrap').style.display === 'flex' || isTransitioning) {
    isMoving = false; return;
  }
  let dx = touchDir.x, dy = touchDir.y;
  if (keys['ArrowLeft'] || keys['a'] || keys['A']) dx -= 1;
  if (keys['ArrowRight'] || keys['d'] || keys['D']) dx += 1;
  if (keys['ArrowUp'] || keys['w'] || keys['W']) dy -= 1;
  if (keys['ArrowDown'] || keys['s'] || keys['S']) dy += 1;

  if (dx === 0 && dy === 0 && moveTarget) {
    const vx = moveTarget.x - state.x, vy = moveTarget.y - state.y;
    const dist = Math.hypot(vx, vy);
    if (dist < 8) moveTarget = null;
    else { dx = vx / dist; dy = vy / dist; }
  } else if (dx !== 0 && dy !== 0) {
    const len = Math.hypot(dx, dy); dx /= len; dy /= len;
  }

  if (dx !== 0 || dy !== 0) {
    isMoving = true;
    walkPhase += 0.28;
    if (Math.abs(dx) >= Math.abs(dy)) {
      state.dir = dx < 0 ? 'left' : 'right';
      state.facing = dx < 0 ? -1 : 1;
    } else {
      state.dir = dy < 0 ? 'up' : 'down';
    }

    const sp = 4.4;
    const tryX = Math.max(36, Math.min(504, state.x + dx * sp));
    const tryY = Math.max(32, Math.min(688, state.y + dy * sp));

    let moved = false;
    if (!hitsCollider(tryX, state.y)) { state.x = tryX; moved = true; }
    if (!hitsCollider(state.x, tryY)) { state.y = tryY; moved = true; }

    if (!moved && moveTarget) moveTarget = null;
    if (moved) {
      trail.unshift({ x: state.x, y: state.y, facing: state.facing, dir: state.dir || 'down' });
      if (trail.length > 64) trail.pop();
      if (++stepTick % 14 === 0) Sound.sfx('step');
    }

    for (const p of STAGES[state.stage].portals) {
      if (Math.hypot(p.x - state.x, p.y - state.y) < 38) {
        changeStage(p.to, p.tx, p.ty);
        break;
      }
    }
  } else {
    isMoving = false;
  }
}

function getDirectionalSprite(baseKey, dir) {
  if (dir === 'up')    return { key: baseKey + '_back', facing: 1 };
  if (dir === 'right') return { key: baseKey + '_side', facing: 1 };
  if (dir === 'left')  return { key: baseKey + '_side', facing: -1 };
  return { key: baseKey, facing: 1 };
}

function drawSprite(imgKey, x, y, size, label, opts={}) {
  const img = ASSETS[imgKey];
  const { facing=1, walking=false, highlight=false, promptIcon=null } = opts;
  const bob = walking ? Math.abs(Math.sin(walkPhase)) * -5.5 : Math.sin(Date.now() / 240 + x) * 1.8;
  const tilt = walking ? Math.sin(walkPhase) * 0.075 : 0;

  if (img) {
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.rotate(tilt);
    ctx.scale(facing, 1);
    ctx.shadowColor = highlight ? 'rgba(253,224,71,0.9)' : 'rgba(0,0,0,0.68)';
    ctx.shadowBlur = highlight ? 14 : 8;
    ctx.shadowOffsetY = 6;
    ctx.drawImage(img, -size/2, -size/2, size, size);
    ctx.restore();
  }
  if (label) {
    ctx.font = '12px DungGeunMo, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillText(label, x + 1, y - size/2 - 4);
    ctx.fillStyle = highlight ? '#fef08a' : '#fde047';
    ctx.fillText(label, x, y - size/2 - 5);
  }
  if (promptIcon) {
    const py = y - size/2 - 26 + Math.sin(Date.now() / 160) * 3;
    ctx.fillStyle = 'rgba(15,23,42,0.94)';
    ctx.beginPath(); ctx.arc(x, py, 13, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#fde047'; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = '13px DungGeunMo, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#fde047';
    ctx.fillText(promptIcon, x, py + 5);
  }
}

function drawParticles(type) {
  particles.forEach(p => {
    p.x += p.vx + Math.sin(p.a += 0.03) * 0.4;
    p.y += type === 'ember' ? -p.vy : p.vy;
    if (p.y > 725) { p.y = -5; p.x = Math.random() * 540; }
    if (p.y < -5)  { p.y = 725; p.x = Math.random() * 540; }
    if (p.x < 0) p.x = 540; if (p.x > 540) p.x = 0;
    ctx.fillStyle = type === 'petal' ? 'rgba(255,182,193,0.8)' : type === 'ember' ? 'rgba(255,190,60,0.85)' : 'rgba(255,250,210,0.35)';
    ctx.fillRect(p.x, p.y, p.sz, p.sz);
  });
}

function render() {
  update();
  const st = STAGES[state.stage];
  if (ASSETS[st.mapKey]) ctx.drawImage(ASSETS[st.mapKey], 0, 0, canvas.width, canvas.height);
  else { ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, canvas.width, canvas.height); }

  if (moveTarget) {
    ctx.strokeStyle = 'rgba(253,224,71,0.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(moveTarget.x, moveTarget.y, 8 + Math.sin(Date.now()/120)*3, 0, Math.PI*2); ctx.stroke();
  }

  st.portals.forEach(p => {
    ctx.font = '12.5px DungGeunMo, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10,18,36,0.88)'; ctx.fillRect(p.x - 74, p.y - 14, 148, 24);
    ctx.strokeStyle = '#e5b84b'; ctx.strokeRect(p.x - 74, p.y - 14, 148, 24);
    ctx.fillStyle = '#fde047'; ctx.fillText(p.label, p.x, p.y + 3);
  });

  const nearEntity = getNearestEntity(state.x, state.y, 82);
  const lbDir = getDirectionalSprite('sprite_liubei', state.dir || 'down');
  const drawList = [{
    y: state.y,
    fn: () => drawSprite(lbDir.key, state.x, state.y, 76, '유비', { facing: lbDir.facing, walking: isMoving })
  }];

  // 유비 -> 관우 -> 장비 -> 제갈량 4인 스네이크 포메이션 (4방향 동기화)
  let fIdx = 14;
  [['guanyu','sprite_guanyu','관우'], ['zhangfei','sprite_zhangfei','장비'], ['zhuge','sprite_zhuge','제갈량']].forEach(([k, spr, nm]) => {
    if (state.party[k]) {
      const pt = trail[Math.min(trail.length - 1, fIdx)] || { x: state.x - 36, y: state.y + 10, dir: state.dir || 'down' };
      const fDir = getDirectionalSprite(spr, pt.dir || 'down');
      drawList.push({ y: pt.y, fn: () => drawSprite(fDir.key, pt.x, pt.y, 74, nm, { facing: fDir.facing, walking: isMoving }) });
      fIdx += 14;
    }
  });

  st.entities.forEach(e => {
    if (!isEntityVisible(e)) return;
    const isNear = nearEntity && nearEntity.id === e.id;
    if (e.hidden) {
      drawList.push({
        y: e.y,
        fn: () => {
          const spk = 4 + Math.sin(Date.now()/180 + e.x) * 2;
          ctx.fillStyle = 'rgba(253,224,71,0.92)';
          ctx.beginPath(); ctx.arc(e.x, e.y, spk, 0, Math.PI*2); ctx.fill();
          if (isNear) drawSprite(null, e.x, e.y, 32, e.name, { promptIcon: '🔍' });
        }
      });
    } else {
      const isOrb = e.sprite === 'item_dragonball';
      const sz = isOrb ? 48 : (e.sprite === 'sprite_lubu' ? 88 : 74);
      const pIcon = isNear ? (isOrb ? '🔍' : '!') : null;
      drawList.push({ y: e.y, fn: () => drawSprite(e.sprite, e.x, e.y, sz, e.name, { highlight: isOrb, promptIcon: pIcon }) });
    }
  });

  drawList.sort((a, b) => a.y - b.y).forEach(item => item.fn());
  drawParticles(st.particle);

  // 충돌 박스 디버그 오버레이 (F2)
  if (debugMode) {
    const cols = STAGE_COLLIDERS[state.stage] || [];
    ctx.save();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.28)';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    cols.forEach(c => { ctx.fillRect(c.x, c.y, c.w, c.h); ctx.strokeRect(c.x, c.y, c.w, c.h); });
    ctx.restore();
    document.getElementById('debug-bar').style.display = 'block';
    document.getElementById('debug-bar').innerText =
      `🛠️ DEBUG | ${state.stage} | 유비(${Math.round(state.x)},${Math.round(state.y)}) | 마우스(${mouseCanvasPos.x},${mouseCanvasPos.y})`;
  }

  requestAnimationFrame(render);
}

// PWA Service Worker 등록
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

preloadAssets();
render();
