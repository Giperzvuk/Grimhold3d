// ---------- ГРИМХОЛД v0.3: игровое ядро ----------
'use strict';
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const VERSION = '1.8';
let UID = 1; const uid = () => 'i' + (UID++) + '_' + Math.floor(Math.random() * 1e6).toString(36);

// ---------- Предметы ----------
const ITEMS = {
  dagger_iron: { name: 'Железный кинжал', type: 'weapon', dmg: 7, spd: 0.26, reach: 2.2, sta: 5, view: 'dagger', value: 30, icon: 'dagger', maxDur: 80 },
  sword_rusty: { name: 'Ржавый меч', type: 'weapon', dmg: 8, spd: 0.42, reach: 2.6, sta: 8, view: 'sword', value: 10, icon: 'sword', maxDur: 40 },
  sword_iron: { name: 'Железный меч', type: 'weapon', dmg: 12, spd: 0.42, reach: 2.6, sta: 8, view: 'sword', value: 60, icon: 'sword', maxDur: 100 },
  sword_silver: { name: 'Посеребрённый клинок', type: 'weapon', dmg: 15, spd: 0.4, reach: 2.6, sta: 8, view: 'sword', value: 190, icon: 'sword', maxDur: 120, silver: true, desc: 'Серебро по кромке. Призраки и духи получают полный урон.' },
  axe_halvar: { name: 'Секира Хальвара', type: 'weapon', dmg: 20, spd: 0.55, reach: 2.5, sta: 12, view: 'axe', value: 220, icon: 'axe', tool: 'axe', maxDur: 180, crush: true, desc: 'Перекованная кирка старого рудокопа. Рубит дерево, кости и всё, что между.' },
  armor_bear: { name: 'Доспех из шкуры шатуна', type: 'armor', armor: 9, warm: 12, value: 260, icon: 'furCoat', maxDur: 160, desc: 'Тяжёлая шкура на кожаной основе. Греет, как печка, держит удар, как кольчуга.' },
  sword_steel: { name: 'Стальной меч', type: 'weapon', dmg: 17, spd: 0.4, reach: 2.6, sta: 8, view: 'sword', value: 140, icon: 'sword', maxDur: 140 },
  blade_ash: { name: 'Пепельный клинок', type: 'weapon', dmg: 25, spd: 0.38, reach: 2.7, sta: 7, view: 'sword', value: 400, icon: 'sword', maxDur: 200, desc: 'Клинок, закалённый в пепле перевала. Режет и плоть, и кость.' },
  axe_wood: { name: 'Топор дровосека', type: 'weapon', dmg: 11, spd: 0.6, reach: 2.6, sta: 12, view: 'axe', value: 35, icon: 'axe', tool: 'axe', maxDur: 90, desc: 'Рубит деревья.' },
  axe_iron: { name: 'Боевой топор', type: 'weapon', dmg: 19, spd: 0.62, reach: 2.7, sta: 13, view: 'axe', value: 110, icon: 'axe', tool: 'axe', maxDur: 120 },
  mace_iron: { name: 'Булава', type: 'weapon', dmg: 15, spd: 0.55, reach: 2.5, sta: 11, view: 'mace', value: 80, icon: 'mace', crush: true, maxDur: 130, desc: 'Дробящее оружие: вдвое опаснее для скелетов.' },
  spear_wood: { name: 'Копьё', type: 'weapon', dmg: 12, spd: 0.5, reach: 3.2, sta: 9, view: 'spear', value: 55, icon: 'spear', maxDur: 80, desc: 'Длинное древко — бьёт дальше меча, но медленнее.' },
  pickaxe: { name: 'Кирка', type: 'weapon', dmg: 9, spd: 0.55, reach: 2.4, sta: 10, view: 'pick', value: 45, icon: 'pick', tool: 'pick', maxDur: 120, desc: 'Добывает руду и самоцветы.' },
  pickaxe_old: { name: 'Кирка Хальвара', type: 'weapon', dmg: 14, spd: 0.5, reach: 2.4, sta: 9, view: 'pick', value: 120, icon: 'pick', tool: 'pick', maxDur: 200, quest: true, desc: 'Кирка отца Хальвара. На рукояти вырезано «Не бойся темноты».' },
  shovel: { name: 'Лопата', type: 'weapon', dmg: 6, spd: 0.6, reach: 2.4, sta: 9, view: 'shovel', value: 25, icon: 'shovel', tool: 'shovel', maxDur: 100, desc: 'Копает землю: клады, корни, камни. Смотри под ноги и жми «Действие».' },
  armor_leather: { name: 'Кожаный доспех', type: 'armor', armor: 4, value: 50, icon: 'armorL', maxDur: 80, warm: 3 },
  armor_chain: { name: 'Кольчуга', type: 'armor', armor: 9, value: 120, icon: 'armor', maxDur: 120 },
  armor_plate: { name: 'Латный доспех', type: 'armor', armor: 14, value: 300, icon: 'armor', maxDur: 160 },
  helmet_leather: { name: 'Кожаный шлем', type: 'helmet', armor: 2, value: 40, icon: 'helmet', maxDur: 60, warm: 2 },
  helmet_iron: { name: 'Железный шлем', type: 'helmet', armor: 4, value: 90, icon: 'helmet', maxDur: 100 },
  shield_wood: { name: 'Деревянный щит', type: 'shield', armor: 3, value: 45, icon: 'shieldWood', view: 'shield', maxDur: 60 },
  shield_iron: { name: 'Окованный щит', type: 'shield', armor: 6, value: 130, icon: 'shield', view: 'shieldIron', maxDur: 120 },
  cloak: { name: 'Шерстяной плащ', type: 'cloak', warm: 7, value: 40, icon: 'cloak', desc: 'Греет в ночном лесу и не даёт промокнуть.' },
  fur_coat: { name: 'Волчья шуба', type: 'cloak', warm: 14, value: 120, icon: 'furCoat', desc: 'Шьётся из трёх шкур. В ней не страшна метель.' },
  amulet: { name: 'Амулет знахарки', type: 'amulet', mp: 25, value: 90, icon: 'amulet', desc: 'Тёплый камень на кожаном шнурке. +25 к запасу маны.' },
  bear_claw: { name: 'Коготь шатуна', type: 'amulet', hp: 25, value: 80, icon: 'pelt', quest: true, desc: 'Оберег охотников. +25 к здоровью.' },
  ring_chief: { name: 'Перстень атамана', type: 'ring', dmgMul: 1.12, value: 150, icon: 'locket', desc: 'Тяжёлое серебро с гербом старого рода. +12% к урону.' },
  potion_hp: { name: 'Зелье здоровья', type: 'potion', hp: 45, value: 20, icon: 'potion' },
  potion_mp: { name: 'Зелье маны', type: 'potion', mp: 35, value: 18, icon: 'potionB' },
  potion_g: { name: 'Противоядие', type: 'potion', hp: 15, cure: true, value: 25, icon: 'potionG' },
  ale: { name: 'Эль «Пепельного лиса»', type: 'food', drink: 30, food: 5, warmT: 60, value: 6, icon: 'flask', desc: 'Тёплый, тёмный, с дымком. Жажду снимает, на час греет.' },
  potion_warm: { name: 'Согревающий отвар', type: 'potion', warmT: 240, drink: 15, value: 22, icon: 'potionB', desc: 'Четыре минуты — как у печки.' },
  bandage: { name: 'Повязка', type: 'potion', hp: 22, value: 8, icon: 'bandage' },
  herb: { name: 'Моховник', type: 'potion', hp: 8, food: 4, value: 5, icon: 'herb' },
  mushroom: { name: 'Серый гриб', type: 'food', food: 12, value: 4, icon: 'mushroom' },
  bread: { name: 'Хлеб', type: 'food', food: 30, value: 8, icon: 'bread' },
  meat: { name: 'Сырое мясо', type: 'food', food: 10, value: 5, icon: 'meat', desc: 'Лучше пожарить на костре.' },
  meatCooked: { name: 'Жареное мясо', type: 'food', food: 45, hp: 10, value: 14, icon: 'meatCooked' },
  stew: { name: 'Охотничья похлёбка', type: 'food', food: 65, hp: 20, drink: 20, value: 26, icon: 'cauldron' },
  flask: { name: 'Фляга', type: 'tool', value: 15, icon: 'flask', desc: 'Наполняется у колодца или пруда. Три глотка.' },
  ore: { name: 'Железная руда', type: 'mat', value: 6, icon: 'oreItem' },
  ingot: { name: 'Железный слиток', type: 'mat', value: 20, icon: 'ingot', desc: 'Выплавлен из руды. Основа любого клинка.' },
  wood: { name: 'Дрова', type: 'mat', value: 3, icon: 'wood' },
  pelt: { name: 'Волчья шкура', type: 'mat', value: 8, icon: 'pelt' },
  bear_pelt: { name: 'Шкура шатуна', type: 'mat', value: 60, icon: 'pelt', desc: 'Огромная бурая шкура. Брандт знает, что с ней делать.' },
  moonflower: { name: 'Лунный цветок', type: 'mat', value: 15, icon: 'moonflower', desc: 'Светится в темноте. Растёт только глубоко под землёй.' },
  gem_red: { name: 'Гранат', type: 'gem', value: 60, icon: 'gemRed', desc: 'Красный камень. Нужен для зачарования и улучшений.' },
  gem_blue: { name: 'Сапфир', type: 'gem', value: 90, icon: 'gemBlue' },
  gem_purple: { name: 'Аметист', type: 'gem', value: 75, icon: 'gemPurple' },
  rune_fire: { name: 'Руна огня', type: 'rune', value: 100, icon: 'runeFire', desc: 'Оружие: +огненный урон. Доспех: защита от жара.' },
  rune_frost: { name: 'Руна стужи', type: 'rune', value: 100, icon: 'runeFrost', desc: 'Оружие: замедляет врагов. Доспех: тепло в мороз.' },
  rune_life: { name: 'Руна жизни', type: 'rune', value: 120, icon: 'runeLife', desc: 'Оружие: крадёт жизнь. Доспех: регенерация.' },
  rune_ash: { name: 'Руна пепла', type: 'rune', value: 200, icon: 'runeAsh', desc: 'Оружие: +15% урона и поджог. Доспех: +3 брони.' },
  lockpick: { name: 'Отмычка', type: 'mat', value: 10, icon: 'lockpick', desc: 'Ломается, если дрогнет рука.' },
  treasure_map: { name: 'Карта разбойников', type: 'key', value: 0, icon: 'treasureMap', desc: 'Крестик у мёртвых сосен на юго-востоке леса. Копать лопатой.' },
  letter: { name: 'Письмо торговца', type: 'key', value: 0, icon: 'letter', desc: '«Марта, если это читаешь ты — меня достали на тропе у камней. Не разбойники. Дальше писать не могу, рука…»' },
  ledger: { name: 'Книга Эйнара', type: 'key', value: 0, icon: 'book', desc: 'Учётная книга торговца. Последняя строка: «Ансгар. 40 монет. Не отдаёт».' },
  note_mine: { name: 'Записка углём', type: 'key', value: 0, icon: 'note', desc: '«День третий. Хальвар завалил вход. Мы слышали, как он уходил. Скажите Грете».' },
  diary1: { name: 'Дневник Ворлата, с. 1', type: 'key', value: 0, icon: 'book', desc: '«Гримхолд стоит на выгоревшей горе. Пепел не даёт мёртвым уснуть. Печать держит не их — она держит пепел».' },
  diary2: { name: 'Дневник Ворлата, с. 2', type: 'key', value: 0, icon: 'book', desc: '«Освин-старший хоронил здесь тех, кого не хотел видеть на общем кладбище. Дочь — тоже. Я молчал. За это мне обещали покой».' },
  diary3: { name: 'Дневник Ворлата, с. 3', type: 'key', value: 0, icon: 'book', desc: '«Печать не сорвана. Её сняли. Освин-младший приходил ночью с ключом. Спросите его, что ему сказал отец».' },
  locket: { name: 'Медальон Элинор', type: 'key', value: 0, icon: 'locket', desc: 'Потускневшее серебро. Внутри — прядь тёмных волос.' },
  key_rusty: { name: 'Ржавый ключ', type: 'key', value: 0, icon: 'key', desc: 'Тяжёлый ключ с костяной ручкой. Открывает дверь в глубине крипты.' },
  key_seal: { name: 'Ключ Печати', type: 'key', value: 0, icon: 'key', desc: 'Холодный, как речной камень. Староста ждёт его. Или не только он.' }
};
const SLOTS = ['weapon', 'shield', 'armor', 'helmet', 'cloak', 'amulet', 'ring'];
const SLOT_NAMES = { weapon: 'Оружие', shield: 'Щит', armor: 'Доспех', helmet: 'Шлем', cloak: 'Плащ', amulet: 'Амулет', ring: 'Кольцо' };
const STACKABLE = new Set(['potion', 'food', 'mat', 'gem', 'rune', 'key', 'tool']);
const ENCH = {
  fire: { name: 'огня', rune: 'rune_fire', wDesc: '+6 огня', aDesc: 'жар не страшен' }, frost: { name: 'стужи', rune: 'rune_frost', wDesc: 'замедляет', aDesc: '+8 тепла' },
  life: { name: 'жизни', rune: 'rune_life', wDesc: 'крадёт 2 зд.', aDesc: 'регенерация' }, ash: { name: 'пепла', rune: 'rune_ash', wDesc: '+15% урона, поджог', aDesc: '+3 брони' }
};

const ENEMY_TYPES = {
  goblin: { name: 'Гоблин', sprite: 'goblin', wind: 0.3, size: [1.6, 1.5], hp: 30, dmg: 6, speed: 3.4, xp: 14, gold: [4, 14], aggro: 11, reach: 1.9, cd: 1.2, drop: [['potion_hp', 0.12], ['bread', 0.2], ['lockpick', 0.15]], voice: 'goblin' },
  skeleton: { name: 'Скелет', sprite: 'skeleton', wind: 0.45, size: [1.6, 2.2], hp: 48, dmg: 10, speed: 2.5, xp: 24, gold: [6, 20], aggro: 10, reach: 2.0, cd: 1.5, bones: true, drop: [['potion_hp', 0.1]], voice: 'bones' },
  wolf: { name: 'Волк', sprite: 'wolf', size: [3.0, 1.2], hp: 26, dmg: 7, speed: 4.4, xp: 12, gold: [0, 0], aggro: 13, reach: 1.7, cd: 1.0, pack: true, wind: 0.32, drop: [['pelt', 1], ['meat', 0.7]], voice: 'wolf' },
  lich: { name: 'Некромант', sprite: 'lich', wind: 0.6, size: [1.9, 3.0], hp: 260, dmg: 16, speed: 2.1, xp: 220, gold: [80, 120], aggro: 16, reach: 2.2, cd: 1.6, ranged: true, drop: [], boss: 'lich', voice: 'ghost' },
  bandit: { name: 'Разбойник', sprite: 'bandit', wind: 0.42, size: [1.5, 2.5], hp: 40, dmg: 9, speed: 3.8, xp: 22, gold: [10, 30], aggro: 12, reach: 1.9, cd: 0.9, drop: [['bandage', 0.3], ['bread', 0.3], ['lockpick', 0.3]], voice: 'human' },
  banditAxe: { name: 'Разбойник с топором', sprite: 'banditAxe', wind: 0.62, size: [1.5, 2.5], hp: 55, dmg: 14, speed: 3.0, xp: 28, gold: [10, 35], aggro: 12, reach: 2.1, cd: 1.5, drop: [['axe_wood', 0.25], ['meat', 0.3]], voice: 'human' },
  chief: { name: 'Атаман', sprite: 'chief', wind: 0.5, size: [1.6, 2.6], hp: 160, dmg: 18, speed: 3.4, xp: 140, gold: [60, 90], aggro: 14, reach: 2.2, cd: 1.1, drop: [['potion_hp', 1]], boss: 'chief', voice: 'human' },
  hunterFoe: { name: 'Охотник', sprite: 'hunter', size: [1.5, 2.5], hp: 90, dmg: 13, speed: 3.6, xp: 60, gold: [30, 50], aggro: 12, reach: 2.0, cd: 1.0, drop: [['meat', 1]], voice: 'human' },
  bear: { name: 'Медведь', sprite: 'bear', wind: 0.7, size: [3.6, 2.2], hp: 160, dmg: 22, speed: 3.6, xp: 120, gold: [0, 0], aggro: 10, reach: 2.4, cd: 1.6, drop: [['meat', 1], ['meat', 1], ['pelt', 1]], boss: 'bear', voice: 'bear' },
  spider: { name: 'Пещерный паук', sprite: 'spider', wind: 0.3, pack: true, size: [2.6, 1.0], hp: 22, dmg: 5, speed: 4.2, xp: 11, gold: [0, 0], aggro: 10, reach: 1.7, cd: 1.0, poison: 0.35, drop: [['mushroom', 0.3]], voice: 'spider' },
  spiderQueen: { name: 'Паучья матка', sprite: 'spider', size: [4.6, 1.8], hp: 220, dmg: 15, speed: 3.0, xp: 190, gold: [0, 0], aggro: 14, reach: 2.6, cd: 1.3, poison: 0.5, drop: [['potion_g', 1]], boss: 'queen', voice: 'spider' },
  wraith: { name: 'Призрачная тень', sprite: 'ghost', wind: 0.5, size: [1.6, 2.2], hp: 40, dmg: 9, speed: 3.0, xp: 30, gold: [5, 15], aggro: 11, reach: 1.9, cd: 1.3, ghost: true, float: true, drop: [['potion_mp', 0.3]], voice: 'ghost' }
};
const SPELLS = {
  fire: { name: 'Огненный шар', short: 'ОГОНЬ', mp: 12, dmg: 18, sprite: 'fireball', color: 0xff7020, speed: 17 },
  ice: { name: 'Ледяная стрела', short: 'ЛЁД', mp: 10, dmg: 12, sprite: 'iceball', color: 0x60a0ff, speed: 20, slow: 4 },
  ash: { name: 'Пепельный взрыв', short: 'ПЕПЕЛ', mp: 25, dmg: 30, sprite: 'fireball', color: 0xd9a53c, speed: 14, aoe: 3.5 },
  heal: { name: 'Исцеление', short: 'ЛЕЧИТЬ', mp: 15, heal: 30, self: true }
};

// ---------- Состояние ----------
let G;
function newState() {
  return {
    v: VERSION, level: 'village', pos: null, time: 0.3, playTime: 0, day: 1, lastTime: 0.3,
    hp: 100, maxHp: 100, mp: 40, maxMp: 40, sta: 100, maxSta: 100, hunger: 85, thirst: 85, rest: 90, warmth: 55, poison: 0, warmT: 0, flaskWater: 3,
    weather: { type: 'clear', until: 300 },
    xp: 0, lvl: 1, gold: 20,
    skills: { blade: 5, destr: 5, armor: 5, craft: 5, alch: 5, lock: 5 }, skillUse: { blade: 0, destr: 0, armor: 0, craft: 0, alch: 0, lock: 0 },
    perks: {}, tasks: {}, rep: 0,
    inv: [], eq: { weapon: null, shield: null, armor: null, helmet: null, cloak: null, amulet: null, ring: null }, quick: [null, null, null, null],
    spells: ['fire'], spell: 'fire',
    quests: { seal: 0, wolves: 0, herbs: 0, merchant: 0, bandits: 0, mine: 0, moon: 0, bear: 0, locket: 0, cousin: 0, arrow: 0, twoInMine: 0, treasure: 0 },
    flags: {}, killed: {}, opened: {}, picked: {}, unlocked: {}, gather: {}, explored: {}, cut: {}, dug: {}, doors: {}, hints: {}, stats: { deaths: 0, kills: 0, crafted: 0, mined: 0, chopped: 0, dug: 0, picked: 0 }
  };
}
function giveStart() { addItem('sword_rusty', 1, true); addItem('potion_hp', 2, true); addItem('bread', 2, true); addItem('flask', 1, true); G.flaskWater = 3; equipItem(G.inv.find(i => i.id === 'sword_rusty').uid); G.quick = [findStack('potion_hp'), findStack('bread'), findStack('flask'), null]; }

// ---------- Рендер (Babylon.js, см. render.js) ----------
const canvas3d = $('c3d');
R.init(canvas3d, { hires: false });
const scene = R.scene, camera = R.camera;
const hudc = $('hudc'), hctx = hudc.getContext('2d');
let VW = 1, VH = 1, HDPR = 1, HIRES = false;
function resize() {
  VW = window.innerWidth; VH = window.innerHeight; R.resize();
  HDPR = Math.min(3, window.devicePixelRatio || 1);
  hudc.width = VW * HDPR; hudc.height = VH * HDPR;
}
window.addEventListener('resize', resize); resize();
const vibrate = ms => { try { if (navigator.vibrate && OPTS.vibro) navigator.vibrate(ms); } catch (e) { } };

// ---------- Звук ----------
const SFX = (() => {
  let ctx = null, master, sfxBus, ambBus, ambGain, ambOsc = [], vol = 0.5, fireLoop = null, muffleF = null, limiter = null, revConv = null, revGain = null, revKind = null;
  // Шины: sfx / music / ambient → мастер-лимитер (нет суммирования выше 0 dBFS)
  const ensure = () => { if (ctx) return; ctx = new (window.AudioContext || window.webkitAudioContext)(); const lim = limiter = ctx.createDynamicsCompressor(); lim.threshold.value = -6; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.002; lim.release.value = 0.1; master = ctx.createGain(); master.gain.value = vol; master.connect(lim); lim.connect(ctx.destination); sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master); ambBus = ctx.createGain(); ambBus.gain.value = 0.6; ambBus.connect(master); const mus = ctx.createGain(); mus.gain.value = 0.55; mus.connect(master); MUSIC.init(ctx, mus); };
  let pan = 0;
  const noise = (dur, freq, q, v, type, delay) => {
    if (!ctx) return; const n = ctx.sampleRate * dur, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(); s.buffer = b; const f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    const g = ctx.createGain(); g.gain.value = v; s.connect(f); f.connect(g); g.connect(sfxBus); s.start(ctx.currentTime + (delay || 0));
  };
  // Цветной шум с огибающей (атака/спад) и панорамой
  const noise2 = (dur, freq, q, v, type, delay, att, bus, panv) => {
    if (!ctx) return; const n = Math.max(1, ctx.sampleRate * dur | 0), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); let last = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; last = type === 'brown' ? (last + 0.02 * w) / 1.02 : w; d[i] = (type === 'brown' ? last * 3.5 : w); }
    const s = ctx.createBufferSource(); s.buffer = b; const f = ctx.createBiquadFilter(); f.type = type === 'brown' ? 'lowpass' : type; f.frequency.value = freq; f.Q.value = q || 1;
    const t0 = ctx.currentTime + (delay || 0), gn = ctx.createGain(); gn.gain.setValueAtTime(0.0001, t0); gn.gain.linearRampToValueAtTime(v, t0 + (att || 0.004)); gn.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    let out = gn; if (panv && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = panv; gn.connect(p); out = p; }
    s.connect(f); f.connect(gn); out.connect(bus || sfxBus); s.start(t0); s.stop(t0 + dur + 0.05);
  };
  const tone = (freq, dur, v, type, slide, delay, lfo) => {
    if (!ctx) return; const t0 = ctx.currentTime + (delay || 0); const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'square'; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(v, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = type === 'sine' ? 6000 : 3200;
    if (lfo) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = lfo; lg.gain.value = v * 0.8; l.connect(lg); lg.connect(g.gain); l.start(t0); l.stop(t0 + dur); }
    o.connect(fl); fl.connect(g); g.connect(sfxBus); o.start(t0); o.stop(t0 + dur);
  };
  let weatherSrc = null, weatherGain = null, weatherKind = 'clear';
  const pitch = () => 0.9 + Math.random() * 0.2;
  return {
    init() { ensure(); if (ctx.state === 'suspended') ctx.resume(); },
    get ready() { return !!ctx; },
    get ctx() { return ctx; }, get master() { return master; },
    setVolume(v) { vol = v; if (master) master.gain.value = v; },
    swing() { noise(0.18, 1800 * pitch(), 0.8, 0.35, 'bandpass'); },
    hit() { const p = pitch(); noise2(0.012, 3000, 0.7, 0.5, 'highpass'); noise2(0.09, 600 * p, 1.2, 0.5, 'lowpass'); tone(110 * p, 0.13, 0.35, 'sine', 50); },
    hitBone() { noise(0.1, 2200 * pitch(), 1.2, 0.4, 'bandpass'); tone(600, 0.08, 0.1, 'square', 200); },
    block() { tone(900 * pitch(), 0.15, 0.25, 'triangle', 300); noise(0.08, 3000, 1, 0.2, 'bandpass'); },
    hurt() { noise(0.12, 900, 0.6, 0.25, 'bandpass'); tone(240, 0.22, 0.22, 'triangle', 120); },
    step(kind) { const p = 0.8 + Math.random() * 0.4, v = (pan = -pan || 1) > 0 ? 1 : 0.85; noise2(0.03, 180 * p, 0.7, 0.2 * v, 'lowpass'); noise2(0.05, 700 * p, 0.8, 0.08 * v, 'bandpass', 0.03); if (kind === 'wood') tone(90 * p, 0.06, 0.05, 'sine', 60); else if (kind === 'stone') tone(1200 * p, 0.04, 0.03, 'sine'); else noise2(0.04, 2000, 0.5, 0.05 * v, 'highpass', 0.01); },
    pickup() { tone(660, 0.08, 0.2, 'square'); tone(990, 0.12, 0.2, 'square', 0, 0.07); },
    gold() { tone(1200, 0.06, 0.15, 'triangle'); tone(1600, 0.1, 0.15, 'triangle', 0, 0.05); },
    fire() { noise(0.4, 900, 0.5, 0.4, 'bandpass'); tone(220, 0.35, 0.2, 'sawtooth', 60); },
    ice() { noise(0.3, 3000, 0.6, 0.3, 'highpass'); tone(1400, 0.3, 0.15, 'sine', 400); },
    heal() { [523, 659, 784].forEach((f, i) => tone(f, 0.3, 0.12, 'sine', 0, i * 0.08)); },
    boom() { tone(90, 0.4, 0.5, 'sine', 30); noise2(0.35, 300, 0.7, 0.6, 'lowpass'); noise2(0.05, 2500, 0.5, 0.3, 'highpass'); },
    open() { noise(0.25, 400, 0.8, 0.3, 'lowpass'); tone(140, 0.2, 0.15, 'triangle', 100); },
    door() { tone(180, 0.5, 0.15, 'sawtooth', 90); noise(0.3, 600, 0.5, 0.15, 'lowpass'); },
    die() { tone(160, 0.5, 0.3, 'sawtooth', 30); },
    dieFoe(kind) { if (kind === 'bones') { for (let i = 0; i < 5; i++) noise(0.05, 1500, 1.5, 0.18, 'bandpass', i * 0.06); } else if (kind === 'ghost') tone(500, 1.2, 0.1, 'sine', 120); else if (kind === 'spider') { for (let i = 0; i < 3; i++) noise(0.04, 2800, 2, 0.15, 'bandpass', i * 0.07); } else tone(140, 0.45, 0.25, 'sawtooth', 50); },
    crackle(d) { noise2(0.06 + Math.random() * 0.06, (1200 + Math.random() * 2800), 3, 0.25 * (d === undefined ? 1 : Math.max(0, 1 - d / 6)), 'bandpass'); },
    fireLoop(d) { if (!ctx) return; if (!fireLoop) { const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), dd = b.getChannelData(0); let l = 0; for (let i = 0; i < n; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; dd[i] = l * 3.5; } const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; const gn = ctx.createGain(); gn.gain.value = 0; const mod = ctx.createGain(); mod.gain.value = 1; const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.type = 'sine'; lfo.frequency.value = 5.5; lg.gain.value = 0.3; lfo.connect(lg); lg.connect(mod.gain); s.connect(f); f.connect(mod); mod.connect(gn); gn.connect(ambBus); s.start(); lfo.start(); fireLoop = { gn, v: 0 }; } /* модуляция отдельной ступенью: раньше LFO прибавлялся к нулевой громкости и «стрекотал» на 11 Гц даже вдали от огня */ const target = (d === null || d === undefined || !isFinite(d)) ? 0 : 0.12 * Math.max(0, 1 - d / 6); fireLoop.gn.gain.setTargetAtTime(target, ctx.currentTime, 0.3); },
    weather(kind) { if (!ctx || kind === weatherKind) return; weatherKind = kind; if (weatherSrc) { try { weatherGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1); const s = weatherSrc; setTimeout(() => { try { s.stop(); } catch (e) { } }, 1200); } catch (e) { } weatherSrc = null; } if (kind === 'clear') return; const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); let last = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = kind === 'rain' ? w * 0.6 : last * 3.5; } const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kind === 'rain' ? 1400 : 500; const gn = ctx.createGain(); gn.gain.value = 0; gn.gain.linearRampToValueAtTime(kind === 'rain' ? 0.07 : 0.05, ctx.currentTime + 2); s.connect(f); f.connect(gn); gn.connect(master); s.start(); weatherSrc = s; weatherGain = gn; },
    level() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 0.2, 'square', 0, i * 0.11)); },
    quest() { [784, 988, 1175].forEach((f, i) => tone(f, 0.2, 0.15, 'triangle', 0, i * 0.12)); },
    unlock() { tone(300, 0.1, 0.2, 'square'); tone(200, 0.3, 0.2, 'square', 0, 0.12); },
    click() { tone(1800, 0.03, 0.08, 'square'); },
    craft() { noise(0.1, 2500, 1, 0.3, 'bandpass'); noise(0.1, 2500, 1, 0.3, 'bandpass', 0.18); tone(880, 0.2, 0.15, 'triangle', 0, 0.36); },
    hammer() { noise(0.06, 3500 * pitch(), 1.5, 0.4, 'bandpass'); tone(1200, 0.08, 0.15, 'triangle', 400); },
    bellows() { noise(0.35, 500, 0.4, 0.2, 'lowpass'); },
    bubble() { tone(600 * pitch(), 0.08, 0.1, 'sine', 900); },
    rune() { tone(880 * pitch(), 0.25, 0.12, 'sine'); tone(1320 * pitch(), 0.3, 0.06, 'sine', 0, 0.05); },
    fail() { tone(220, 0.25, 0.2, 'square', 110); },
    eat() { noise(0.12, 600, 0.8, 0.2, 'lowpass'); noise(0.12, 500, 0.8, 0.2, 'lowpass', 0.16); },
    drink() { tone(500, 0.1, 0.1, 'sine', 700); tone(450, 0.1, 0.1, 'sine', 650, 0.15); },
    mine() { noise(0.08, 3000 * pitch(), 1, 0.35, 'bandpass'); tone(200, 0.1, 0.1, 'square', 100); },
    chop() { noise(0.1, 800 * pitch(), 1, 0.35, 'lowpass'); },
    dig() { noise(0.2, 300 * pitch(), 0.6, 0.3, 'lowpass'); },
    treeFall() { noise(0.6, 200, 0.5, 0.5, 'lowpass'); tone(80, 0.6, 0.2, 'sawtooth', 40); },
    sleep() { [440, 392, 349, 330].forEach((f, i) => tone(f, 0.4, 0.12, 'triangle', 0, i * 0.3)); },
    splash() { noise2(0.35, 900, 0.6, 0.35, 'lowpass', 0, 0.005); noise2(0.25, 2600, 0.8, 0.18, 'highpass', 0.02, 0.01); tone(320, 0.18, 0.1, 'sine', 180); },
    muffle(on) { if (!ctx || !master) return; if (!muffleF) { muffleF = ctx.createBiquadFilter(); muffleF.type = 'lowpass'; muffleF.frequency.value = 20000; try { master.disconnect(); } catch (e) { } master.connect(muffleF); muffleF.connect(limiter); }
      muffleF.frequency.cancelScheduledValues(ctx.currentTime); muffleF.frequency.linearRampToValueAtTime(on ? 480 : 20000, ctx.currentTime + 0.25); },
    // реверб помещения: генерируем импульс шумом с экспоненциальным спадом
    reverb(kind) {
      if (!ctx || revKind === kind) return; revKind = kind;
      if (!revGain) { revGain = ctx.createGain(); revGain.gain.value = 0; revConv = ctx.createConvolver(); revConv.connect(revGain); revGain.connect(master); sfxBus.connect(revConv); ambBus.connect(revConv); }
      const conf = { crypt: [2.2, 0.34], mine: [1.5, 0.26], interior: [0.5, 0.12] }[kind];
      if (!conf) { revGain.gain.setTargetAtTime(0, ctx.currentTime, 0.3); return; }
      const [len, wet] = conf, n = Math.floor(ctx.sampleRate * len), b = ctx.createBuffer(2, n, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) { const t = i / n; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.4) * (i < ctx.sampleRate * 0.01 ? i / (ctx.sampleRate * 0.01) : 1); } }
      revConv.buffer = b; revGain.gain.setTargetAtTime(wet, ctx.currentTime, 0.3);
    },
    heartbeat() { tone(85, 0.18, 0.4, 'sine', 45); noise(0.12, 200, 0.8, 0.25, 'lowpass'); tone(75, 0.14, 0.3, 'sine', 40, 0.24); noise(0.1, 180, 0.8, 0.18, 'lowpass', 0.24); },
    voice(kind) {
      if (kind === 'wolf') { if (Math.random() < 0.35) tone(500 * pitch(), 1.1, 0.12, 'sine', 380, 0, 6); else tone(110 * pitch(), 0.5, 0.2, 'sawtooth', 80, 0, 25); } else if (kind === 'spider') { for (let i = 0; i < 4; i++) noise(0.03, 3000, 2, 0.15, 'bandpass', i * 0.06); }
      else if (kind === 'bones') { for (let i = 0; i < 3; i++) noise(0.05, 1800, 1.5, 0.15, 'bandpass', i * 0.09); } else if (kind === 'ghost') { tone(300 * pitch(), 0.9, 0.07, 'sine', 180, 0, 5); tone(302 * pitch(), 0.9, 0.05, 'sine', 182, 0.05, 5); }
      else if (kind === 'bear') { tone(55 * pitch(), 0.8, 0.28, 'sawtooth', 40, 0, 18); tone(82 * pitch(), 0.8, 0.18, 'sawtooth', 60, 0, 18); noise(0.8, 300, 0.5, 0.15, 'lowpass'); } else if (kind === 'goblin') tone(500 * pitch(), 0.15, 0.12, 'square', 350); else if (kind === 'human') tone(200 * pitch(), 0.2, 0.12, 'sawtooth', 160);
    },
    ambientTick(kind, night) {
      if (!ctx) return;
      const pv = (Math.random() - 0.5) * 1.4;
      if (kind === 'outdoor') { if (night) { const dur = 0.3 + Math.random() * 0.7; tone(4300 * pitch(), dur, 0.05, 'sine', 4300, 0, 35); } else { const p = pitch(); [[1800, 2600, 0], [2600, 2000, 0.08], [2000, 2400, 0.16]].forEach(([a, b, dl]) => tone(a * p, 0.08, 0.12, 'sine', b * p, dl)); if (Math.random() < 0.5) [[1900, 2500, 0.4], [2500, 2100, 0.48]].forEach(([a, b, dl]) => tone(a * p, 0.08, 0.1, 'sine', b * p, dl)); } }
      else if (kind === 'dungeon') { if (Math.random() < 0.75) { tone(2200, 0.05, 0.08, 'sine', 700); noise2(0.25, 900, 2, 0.04, 'bandpass', 0.05, 0.01, ambBus, pv); } else tone(80, 1.5, 0.05, 'sine', 60); }
    },
    ambient(kind) {
      if (!ctx) return; ambOsc.forEach(o => { try { o.stop(); } catch (e) { } }); ambOsc = [];
      if (!ambGain) { ambGain = ctx.createGain(); ambGain.connect(ambBus); }
      ambGain.gain.value = kind === 'dungeon' ? 0.08 : 0.07;
      // ветер: коричневый шум → полосовой фильтр, медленный LFO громкости и частоты
      const n = ctx.sampleRate * 4, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); let l = 0;
      for (let i = 0; i < n; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; }
      const s = ctx.createBufferSource(); s.buffer = b; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = kind === 'dungeon' ? 220 : 500; f.Q.value = 0.7;
      const gn = ctx.createGain(); gn.gain.value = 0.5;
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.08; lg.gain.value = 0.4; lfo.connect(lg); lg.connect(gn.gain);
      const lfo2 = ctx.createOscillator(), lg2 = ctx.createGain(); lfo2.frequency.value = 0.13; lg2.gain.value = kind === 'dungeon' ? 60 : 250; lfo2.connect(lg2); lg2.connect(f.frequency);
      s.connect(f); f.connect(gn); gn.connect(ambGain); s.start(); lfo.start(); lfo2.start(); ambOsc.push(s, lfo, lfo2);
      if (kind === 'dungeon') { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 48; const og = ctx.createGain(); og.gain.value = 0.35; o.connect(og); og.connect(ambGain); o.start(); ambOsc.push(o); }
    }
  };
})();

// ---------- Уровень / сущности ----------
let L = null;
const spriteMesh = (cnv, size, opts) => R.spriteMesh(cnv, size, opts);
const cw = c => c * CS + CS / 2;
const gy = (x, z) => Terrain.h(x, z); // высота рельефа в точке (0 в помещениях)
function mapSet(x, z, ch) { const r = L.map[z].split(''); r[x] = ch; L.map[z] = r.join(''); }
const TREE_KIND = { T: 'pine', t: 'oak', d: 'deadTree' };

function loadLevel(id, spawnAt) {
  if (L) { for (const ps of L.particles) ps.dispose(); for (const ps of L.fires) ps.dispose(); for (const s of L.lightSlots) R.freeLight(s); L.group.dispose(); for (const f of L.fields) f.dispose(false, !(f.metadata && f.metadata.sharedMat)); }
  if (id === 'delve') { const seed = (G.delveSeed = (G.delveDay === G.day ? G.delveSeed : Math.floor(Math.random() * 1e6))); G.delveDay = G.day; WORLDS.delve = makeDelve(seed); }
  const def = WORLDS[id];
  const map = def.map.slice();
  const cut = G.cut[id] || {}; for (const k in cut) { const [x, z] = k.split(',').map(Number); const r = map[z].split(''); r[x] = def.kind === 'forest' ? 'g' : '.'; map[z] = r.join(''); }
  Terrain.build(def, map);
  const built = R.buildLevel(def, map);
  const group = built.group;
  L = { id, def, map, group, locks: built.locks, doorMeshes: built.doors || {}, mountains: built.mountains, enemies: [], npcs: [], pickups: [], chests: [], projectiles: [], billboards: [], torches: [], fx: [], acts: [], lights: [], trees: {}, lightSlots: [], solids: [], heat: [], particles: [], fields: [], fires: [] };
  R.setupLevelLight(def, def.kind);
  if (def.outdoor) {
    L.ash = R.weatherSystem('ash', 120); L.snow = R.weatherSystem('snow', 700); R.setWeatherRate(L.snow, 0); L.rain = R.weatherSystem('rain', 500); R.setWeatherRate(L.rain, 0);
    L.particles.push(L.ash, L.snow, L.rain);
    if (def.kind === 'forest') { L.fireflies = R.weatherSystem('fireflies', 50); L.particles.push(L.fireflies); }
  } else { L.ash = R.weatherSystem('ash', 60); L.ash.minEmitBox.y = -10; L.ash.maxEmitBox.y = -9; L.particles.push(L.ash); }
  // Деревья — thin instances по видам
  const treeLists = { pine: [], pineDark: [], oak: [], deadTree: [] };
  for (let z = 0; z < map.length; z++) for (let x = 0; x < map[0].length; x++) {
    const ch = map[z][x];
    if (ch === 'T' || ch === 't' || ch === 'd') {
      const kind = ch === 't' ? 'oak' : ch === 'd' ? 'deadTree' : (def.kind === 'forest' && hash2(x, z, 4) < 0.5 ? 'pineDark' : 'pine');
      const s = ch === 't' ? 0.95 + hash2(x, z, 5) * 0.3 : ch === 'd' ? 0.9 : 0.85 + hash2(x, z, 5) * 0.45;
      const px = cw(x) + (hash2(x, z, 1) - 0.5) * 1.2, pz = cw(z) + (hash2(x, z, 2) - 0.5) * 1.2;
      treeLists[kind].push({ x: px, y: gy(px, pz), z: pz, s, r: hash2(x, z, 3) * 6.28, key: x + ',' + z });
      L.trees[x + ',' + z] = { x, z, hp: ch === 'd' ? 2 : 3, kind: ch, px, pz, treeKind: kind, mesh: { position: { x: px, z: pz } } };
    }
  }
  for (const kind in treeLists) { const f = R.treeField(kind, treeLists[kind]); if (f) { f.parent = group.node; L.fields.push(f); L.trees['@' + kind] = f; } }
  R.addShadowCasters(L.fields);
  for (const k in cut) { const [x, z] = k.split(',').map(Number); const m = R.propOrSprite('treeStump', [1.4, 0.8]); m.position.x = cw(x); m.position.z = cw(z); m.position.y += gy(m.position.x, m.position.z); group.add(m); }
  // Трава и цветы — кросс-спрайты инстансами
  const decor = { grassTuft: [], flower: [], flowerB: [], bush: [], fern: [], reed: [], log: [], rock: [] };
  for (const p of decorFor(def)) { const X = cw(p.x) + (p.ox || 0) * 1.4, Z = cw(p.z) + (p.oz || 0) * 1.4; if (p.sprite === 'rock' || p.sprite === 'rockBig') { const m = R.propOrSprite(p.sprite, p.size, { y: p.y }); m.position.x = X; m.position.z = Z; m.position.y += gy(X, Z); m.rotation.y = hash2(p.x, p.z, 9) * 3; group.add(m); if (p.sprite === 'rockBig') L.solids.push({ x: X, z: Z, r: 0.7 }); } else decor[p.sprite].push({ x: X, y: gy(X, Z), z: Z, s: 0.8 + hash2(p.x, p.z, 8) * 0.5, r: hash2(p.x, p.z, 9) * 3 }); }
  for (const k in decor) { if (!decor[k].length) continue; const f = R.decorField(k, decor[k]); if (f) { f.parent = group.node; L.fields.push(f); } }
  // Реквизит
  for (const p of def.props) {
    if (p.appear && !G.flags[p.appear]) continue; if (p.gone && G.flags[p.gone]) continue;
    const m = R.propOrSprite(p.sprite, p.size, { y: p.y }); m.position.x = cw(p.x) + (p.ox || 0); m.position.z = cw(p.z) + (p.oz || 0); if (p.ry) m.rotation.y = p.ry; else if (m.isProp) m.rotation.y = (hash2(p.x, p.z, 12) - 0.5) * 0.6; group.add(m);
    if (p.sprite === 'torch' || p.sprite === 'web' || p.sprite === 'note') { // настенные: прижать к ближайшей стене
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]], gap = p.sprite === 'note' ? 0.03 : 0.15; for (const [dx, dz] of dirs) if (SOLID.has(cellAt(map, p.x + dx, p.z + dz))) { m.position.x += dx * (CS / 2 - gap); m.position.z += dz * (CS / 2 - gap); m.rotation.y = Math.atan2(-dx, -dz); break; }
      if (p.sprite === 'torch') m.position.y = 1.8; if (p.sprite === 'note') m.position.y = p.y || 1.2;
    }
    m.position.y += gy(m.position.x, m.position.z);
    if (m.isSprite && ['moonflower', 'torch', 'lantern', 'campfire', 'furnace'].includes(p.sprite)) m.setEmissive(true);
    const meta = m.node && m.node.metadata;
    const rotOff = (lx, lz) => { const a = m.rotation.y || 0; return { x: lx * Math.cos(a) + lz * Math.sin(a), z: -lx * Math.sin(a) + lz * Math.cos(a) }; }; // локальное смещение → мировое
    if (meta && meta.fire) { const fo = meta.fireOff ? rotOff(meta.fireOff.x || 0, meta.fireOff.z || 0) : { x: 0, z: meta.fire === true ? 0.55 : 0 }; const fy = meta.fireOff ? m.position.y + meta.fireOff.y : m.position.y + (meta.fire === true ? 0.9 : 0.3); L.fires.push(R.fire(m.position.x + fo.x, fy, m.position.z + fo.z, meta.fire)); }
    if (p.light || (meta && meta.light)) { const lt = (meta && meta.light) || { y: 0.8, color: p.sprite === 'campfire' || p.sprite === 'furnace' ? '#ff7a30' : '#ffc060', k: 1 }; const lo = rotOff(lt.x || 0, lt.z || 0); L.lights.push({ x: m.position.x + lo.x, y: m.position.y + lt.y, z: m.position.z + lo.z, color: lt.color, fire: p.sprite === 'campfire' || p.sprite === 'furnace' || p.sprite === 'torch', k: lt.k, intensity: 0 }); }
    if (p.sprite === 'torch') { const a = m.rotation.y || 0, so = R.decal('soot', m.position.x - Math.sin(a) * 0.12, m.position.y + 1.05, m.position.z - Math.cos(a) * 0.12, 1.3, a, true); group.add(so); }
    if (p.sprite === 'campfire' || p.sprite === 'furnace' || p.sprite === 'torch') L.heat.push({ x: m.position.x, z: m.position.z, r: p.sprite === 'torch' ? 2 : 4, k: p.sprite === 'furnace' ? 30 : p.sprite === 'campfire' ? 18 : 6 });
    if (m.isProp && def.outdoor) R.addShadowCasters(m.node.getChildMeshes());
    if (p.act) L.acts.push({ p, mesh: m, x: m.position.x, z: m.position.z, id: id + ':' + p.act + ':' + p.x + ',' + p.z });
    if (p.solid) L.solids.push({ x: m.position.x, z: m.position.z, r: p.size[0] * 0.35 });
    if (p.sprite === 'fence') for (const o of [-1, 0, 1]) L.solids.push({ x: m.position.x + o, z: m.position.z, r: 0.45 });
  }
  const dug = G.dug[id] || {}; for (const k in dug) { const [x, z] = k.split(',').map(Number); const m = R.propOrSprite('dirtPile', [1, 0.45], { y: 0.22 }); m.position.x = cw(x); m.position.z = cw(z); m.position.y += gy(m.position.x, m.position.z); group.add(m); }
  // NPC
  for (const n of def.npcs) {
    if (n.gone && G.flags[n.gone]) continue; if (n.appear && !G.flags[n.appear]) continue;
    const m = Models.character(n.sprite); m.position.x = cw(n.x); m.position.z = cw(n.z); group.add(m); R.addShadowCasters(m.meshes);
    if (n.float) { m.float = true; }
    L.npcs.push({ def: n, mesh: m, x: m.position.x, z: m.position.z, hx: m.position.x, hz: m.position.z, anim: 0, wander: rand(1, 4), wx: 0, wz: 0, moving: false, yaw: rand(0, 6.28) });
  }
  for (const e of def.enemies) {
    if (e.appear && !G.flags[e.appear]) continue; if (e.gone && G.flags[e.gone]) continue;
    if (e.night && Math.sin((G.time - 0.25) * Math.PI * 2) > 0.1) continue;
    const k = G.killed[e.id];
    if (k && !(ENEMY_TYPES[e.type].xp <= 30 && G.day - k >= 2 && !e.type.startsWith('bandit'))) continue;
    spawnEnemy(e);
  }
  for (const it of def.items) { const pk = G.picked[it.id]; if (pk && !(it.respawn && G.day - pk >= 2)) continue; spawnPickup(it.item, cw(it.x), cw(it.z), it.id, 1); }
  for (const d of ((G.dropped || {})[id] || [])) { if (!ITEMS[d.item] && d.item !== 'gold') continue; L.restoring = d.k; if (d.item === 'gold') spawnGold(d.x, d.z, d.q); else spawnPickup(d.item, d.x, d.z, null, d.q, d.inst || undefined); L.restoring = null; }
  for (const c of def.chests) {
    const opened = !!G.opened[c.id], locked = !!c.lock && !G.unlocked[id + ':chest:' + c.id];
    const m = R.propOrSprite(opened ? 'chestOpen' : locked ? 'lockedChest' : 'chest', [1.3, 0.9]); m.position.y += gy(cw(c.x), cw(c.z)); m.position.x = cw(c.x); m.position.z = cw(c.z); group.add(m);
    const dirs = [[0, -1], [-1, 0], [1, 0], [0, 1]]; for (const [dx, dz] of dirs) if (SOLID.has(cellAt(map, c.x + dx, c.z + dz))) { m.rotation.y = Math.atan2(-dx, -dz) + Math.PI; break; }
    L.chests.push({ def: c, mesh: m, x: m.position.x, z: m.position.z, opened, locked });
  }
  for (const key in L.locks) if (G.unlocked[id + ':' + key]) { L.locks[key].dispose(); delete L.locks[key]; }
  for (const key in L.doorMeshes) if (G.doors[id + ':' + key]) L.doorMeshes[key].setEnabled(false);
  const sp = spawnAt || def.spawn;
  if (sp.wx !== undefined) { P.x = sp.wx; P.z = sp.wz; } else { P.x = cw(sp.x); P.z = cw(sp.z); }
  P.y = 0; P.vy = 0; P.gy = gy(P.x, P.z); P.yaw = sp.yaw || 0; P.pitch = 0; P.dead = false; P.swing = 0; P.castAnim = 0; P.block = 0; P.webbed = 0;
  G.level = id; if (!G.explored[id]) G.explored[id] = {};
  SFX.ambient(def.outdoor ? 'outdoor' : def.kind === 'interior' ? 'outdoor' : 'dungeon');
  SFX.reverb(def.outdoor ? null : def.kind);
  { const gr = { village: [1, 1, 1, 1], forest: [0.94, 1.03, 0.95, 0.95], crypt: [0.84, 0.96, 1.14, 0.78], mine: [1.12, 0.99, 0.84, 0.9], interior: [1.06, 1, 0.93, 1] }[def.kind] || [1, 1, 1, 1]; R.setGrade(gr[0], gr[1], gr[2], gr[3]); }
  log(def.name, 'gold'); UI.locName(def.name);
  if (def.onEnter) def.onEnter();
}
function spawnEnemy(e) {
  const t = ENEMY_TYPES[e.type];
  const m = Models.character(t.sprite === 'spider' && e.type === 'spiderQueen' ? 'spiderQueen' : t.sprite === 'hunter' ? 'hunter' : t.sprite); m.position.x = cw(e.x); m.position.z = cw(e.z); L.group.add(m);
  if (t.float) m.float = true; if (L.def.outdoor) R.addShadowCasters(m.meshes);
  const en = { id: e.id, temp: !!e.temp, type: e.type, t, name: e.name || t.name, mesh: m, x: m.position.x, z: m.position.z, hp: e.hp || t.hp, maxHp: e.hp || t.hp, state: 'idle', cd: 0, flash: 0, drop: e.drop, wander: 0, wx: 0, wz: 0, dead: false, hx: cw(e.x), hz: cw(e.z), castT: 0, anim: 0, lunge: 0, slow: 0, boss: !!e.name, stagger: 0, staggerN: 0, burn: 0, voiceT: rand(2, 8), phase: 0, blockT: 0, friendly: !!e.friendly, talk: e.talk || null, poison: 0, webT: 0, yaw: rand(0, 6.28) };
  L.enemies.push(en); return en;
}
function spawnPickup(itemId, x, z, id, q, inst) {
  const it = ITEMS[itemId];
  const m = R.itemMesh(it.icon, { y: 0.45 }); m.rotation.y = Math.random() * 6.28; m.position.x = x; m.position.z = z; L.group.add(m);
  if (itemId === 'moonflower' || it.type === 'gem' || it.type === 'rune') m.setEmissive(true);
  let dyn = null; if (!id && !L.restoring) { G.dropped = G.dropped || {}; const arr = G.dropped[L.id] = G.dropped[L.id] || []; dyn = 'd' + uid(); arr.push({ k: dyn, item: itemId, x, z, q: q || 1, inst: inst || null }); if (arr.length > 40) { const old = arr.shift(); const op = L.pickups.find(p => p.dyn === old.k); if (op) { removeMesh(op.mesh); L.pickups.splice(L.pickups.indexOf(op), 1); } } }
  const pk = { id, dyn: dyn || (L.restoring ? L.restoring : null), item: itemId, q: q || 1, mesh: m, x, z, t: Math.random() * 6, inst, noPick: 0 }; L.pickups.push(pk); return pk;
}
function spawnGold(x, z, amount) {
  const m = R.itemMesh('gold', { y: 0.3 }); m.position.x = x; m.position.z = z; L.group.add(m);
  let dyn = null; if (!L.restoring) { G.dropped = G.dropped || {}; const arr = G.dropped[L.id] = G.dropped[L.id] || []; dyn = 'g' + uid(); arr.push({ k: dyn, item: 'gold', x, z, q: amount }); if (arr.length > 40) arr.shift(); } else dyn = L.restoring;
  L.pickups.push({ id: null, dyn, item: 'gold', q: amount, mesh: m, x, z, t: 0, noPick: 0 });
}
function spawnFx(spr, x, y, z, life, size, vel) {
  const m = spriteMesh(TEX.SPR[spr], size || [0.9, 0.9], { y: 0, emissive: true }); m.position.set(x, y + gy(x, z), z); L.group.add(m);
  L.fx.push({ mesh: m, life: life || 0.25, t: 0, vel });
}
function sparks(x, y, z, n, spr) { for (let i = 0; i < n; i++) spawnFx(spr || 'spark', x, y, z, 0.35 + Math.random() * 0.2, [0.18, 0.18], { x: rand(-3, 3), y: rand(1, 4), z: rand(-3, 3) }); }
function removeMesh(m) { L.group.remove(m); }
function removeTreeInstance(tr) { const f = L.trees['@' + tr.treeKind]; if (!f) return; const list = f.metadata.list, i = list.findIndex(t => t.key === tr.x + ',' + tr.z); if (i < 0) return; list.splice(i, 1); const mats = new Float32Array(list.length * 16); list.forEach((t, j) => { BABYLON.Matrix.Compose(new BABYLON.Vector3(t.s, t.s, t.s), BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, t.r || 0), new BABYLON.Vector3(t.x, t.y || 0, t.z)).copyToArray(mats, j * 16); }); f.thinInstanceSetBuffer('matrix', mats, 16, true); if (!list.length) f.setEnabled(false); }
const FLOAT = [];
function floatText(x, y, z, text, col) { FLOAT.push({ x, y: y + gy(x, z), z, text, t: 0, col: col || '#fff' }); if (FLOAT.length > 12) FLOAT.shift(); }
function freeCellNear(cx, cz, r) { for (let d = 0; d <= r; d++) for (let dz = -d; dz <= d; dz++) for (let dx = -d; dx <= d; dx++) { const x = cx + dx, z = cz + dz; if (!BLOCK.has(cellAt(L.map, x, z)) && !blocked(cw(x), cw(z), 0.4)) return [x, z]; } return null; }
function takeLight(color) { const s = R.takeLight(typeof color === 'number' ? '#' + color.toString(16).padStart(6, '0') : color); if (s) L.lightSlots.push(s); return s; }
function freeLight(s) { if (s) { R.freeLight(s); const i = L.lightSlots.indexOf(s); if (i >= 0) L.lightSlots.splice(i, 1); } }
// Назначить свободные слоты света ближайшим фонарям/кострам
function assignLights() {
  const pool = R.lightPool(), free = pool.filter(s => !s.used); if (!free.length) return;
  const near = L.lights.map(l => ({ l, d: dist2(P.x, P.z, l.x, l.z) })).sort((a, b) => a.d - b.d).slice(0, free.length);
  free.forEach((s, i) => { const n = near[i]; if (n) { s.pl.position.set(n.l.x, n.l.y, n.l.z); s.pl.diffuse = BABYLON.Color3.FromHexString(n.l.color); s.pl.intensity = n.l.intensity; } else s.pl.intensity = 0; });
}
function los(x0, z0, x1, z1) {
  const d = dist2(x0, z0, x1, z1), n = Math.ceil(d / 0.6);
  for (let i = 1; i < n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, cx = Math.floor(x / CS), cz = Math.floor(z / CS), ch = cellAt(L.map, cx, cz); if (SOLID.has(ch) && !(ch === 'L' && !L.locks[cx + ',' + cz]) && !(ch === 'O' && G.doors[L.id + ':' + cx + ',' + cz])) return false; }
  return true;
}

// ---------- Игрок ----------
const P = { x: 0, y: 0, z: 0, gy: 0, vy: 0, yaw: 0, pitch: 0, r: 0.45, h: 1.6, bob: 0, swing: 0, swingT: 0.42, swingHit: false, castAnim: 0, hurtT: 0, stepT: 0, moving: 0, dead: false, shake: 0, block: 0, blockHold: false, shiver: 0, webbed: 0 };
function blocked(x, z, r, ignoreSolids) {
  const map = L.map;
  for (const [dx, dz] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
    const cx = Math.floor((x + dx) / CS), cz = Math.floor((z + dz) / CS), ch = cellAt(map, cx, cz);
    if (BLOCK.has(ch)) { if (ch === 'L' && !L.locks[cx + ',' + cz]) continue; if (ch === 'O' && G.doors[L.id + ':' + cx + ',' + cz]) continue; return true; }
  }
  if (!ignoreSolids) for (const s of L.solids) if (dist2(x, z, s.x, s.z) < s.r + r) return true;
  return false;
}
function moveWithCollision(o, dx, dz, r) {
  if (!blocked(o.x + dx, o.z, r)) o.x += dx; else { const s = Math.sign(dx) * 0.02; if (!blocked(o.x + s, o.z, r)) o.x += s; }
  if (!blocked(o.x, o.z + dz, r)) o.z += dz; else { const s = Math.sign(dz) * 0.02; if (!blocked(o.x, o.z + s, r)) o.z += s; }
}
const inst = u => u ? G.inv.find(i => i.uid === u) : null;
const findStack = id => { const s = G.inv.find(i => i.id === id); return s ? s.uid : null; };
const weapon = () => inst(G.eq.weapon);
const wdef = () => { const w = weapon(); return w ? ITEMS[w.id] : null; };
function eqItem(slot) { return inst(G.eq[slot]); }
// Аффиксы: приставка (качество ковки) и прозвище (находка). Влияют на урон/броню и цену.
const AFFIX_PRE = [
  { id: 'rust', name: 'Ржавый', dmg: -0.15, val: 0.6, w: 1.2 },
  { id: 'worn', name: 'Побитый', dmg: -0.08, val: 0.8, w: 1.4 },
  { id: 'fine', name: 'Добротный', dmg: 0.12, val: 1.4, w: 1.0 },
  { id: 'keen', name: 'Отточенный', dmg: 0.22, val: 1.8, w: 0.6 },
  { id: 'master', name: 'Мастерский', dmg: 0.35, val: 2.6, w: 0.25 }
];
const AFFIX_SUF = [
  { id: 'pass', name: 'с перевала', val: 1.2, w: 1 }, { id: 'ash', name: 'из Пепельного леса', val: 1.3, w: 0.8 },
  { id: 'deep', name: 'из глубокой штольни', val: 1.5, w: 0.5 }, { id: 'old', name: 'старой ковки', val: 1.6, w: 0.4 }
];
function rollAffix(list, luck) { const w = list.map(a => a.w * (a.dmg > 0 || a.val > 1.3 ? 1 + luck : 1)); let t = w.reduce((a, b) => a + b, 0) * Math.random(); for (let i = 0; i < list.length; i++) { t -= w[i]; if (t <= 0) return list[i]; } return list[0]; }
// навесить аффиксы на найденный экземпляр (оружие/броня/щит/шлем)
function affixify(inst, id, luck) {
  const it = ITEMS[id]; if (!it || !['weapon', 'armor', 'shield', 'helmet'].includes(it.type)) return inst;
  luck = luck || 0;
  if (Math.random() < 0.55 + luck * 0.2) inst.pre = rollAffix(AFFIX_PRE, luck).id;
  if (Math.random() < 0.18 + luck * 0.25) inst.suf = rollAffix(AFFIX_SUF, luck).id;
  return inst;
}
const affixPre = i => AFFIX_PRE.find(a => a.id === i.pre);
const affixSuf = i => AFFIX_SUF.find(a => a.id === i.suf);
function affixMul(i) { const p = affixPre(i); return 1 + (p ? p.dmg : 0); }
function affixVal(i) { const p = affixPre(i), sf = affixSuf(i); return (p ? p.val : 1) * (sf ? sf.val : 1); }
function itemName(i) { const d = ITEMS[i.id], p = affixPre(i), sf = affixSuf(i); return (p ? p.name + ' ' : '') + (p ? d.name.toLowerCase() : d.name) + (i.plus ? ' +' + i.plus : '') + (i.ench ? ' ' + ENCH[i.ench].name : '') + (sf ? ' ' + sf.name : ''); }
function instDmg(i) { const d = ITEMS[i.id]; let v = d.dmg * (1 + (i.plus || 0) * 0.1) * (i.ench === 'ash' ? 1.15 : 1) * affixMul(i); if (i.dur !== undefined && i.dur <= 0) v *= 0.5; return v; }
function instArmor(i) { const d = ITEMS[i.id]; let v = (d.armor || 0) * (1 + (i.plus || 0) * 0.12) * affixMul(i) + (i.ench === 'ash' ? 3 : 0); if (i.dur !== undefined && i.dur <= 0) v *= 0.5; return v; }
function weaponDmg() { const w = weapon(); const base = w ? instDmg(w) : 3; const r = eqItem('ring'); const ring = r ? ITEMS[r.id].dmgMul : 1; return (1 + perkLvl('brawler') * 0.12) * base * (1 + G.skills.blade / 60) * (1 + (G.lvl - 1) * 0.04) * ring; }
function armorVal() { let a = 0; for (const s of ['armor', 'helmet', 'shield']) { const i = eqItem(s); if (i) a += instArmor(i); } return a * (1 + G.skills.armor / 80); }
function warmGear() { let w = 0; for (const s of ['armor', 'helmet', 'cloak']) { const i = eqItem(s); if (i) { w += ITEMS[i.id].warm || 0; if (i.ench === 'frost') w += 8; } } return w; }
function effMaxMp() { const a = eqItem('amulet'); return G.maxMp + (a && ITEMS[a.id].mp ? ITEMS[a.id].mp : 0); }
function effMaxHp() { const a = eqItem('amulet'); return G.maxHp + (a && ITEMS[a.id].hp ? ITEMS[a.id].hp : 0); }
function effMaxHpOf(g) { const u = g.eq && g.eq.amulet, a = u && (g.inv || []).find(i => i.uid === u); return g.maxHp + (a && ITEMS[a.id] && ITEMS[a.id].hp ? ITEMS[a.id].hp : 0); }
function effMaxSta() { return Math.round(G.maxSta * (G.rest < 25 ? 0.7 : 1) * (G.warmth > 85 ? 0.8 : 1)); }
function wearItem(slot, n) { n *= perkLvl('thrift') ? 0.5 : 1; const i = eqItem(slot); if (i && i.dur !== undefined) { const was = i.dur; i.dur = Math.max(0, i.dur - n); if (was > 0 && i.dur <= 0) log(`${itemName(i)}: сломано! Нужен ремонт у наковальни.`, 'red'); else if (was > 20 && i.dur <= 20) log(`${itemName(i)} вот-вот сломается`, 'red'); } }
function skillUse(k, n) {
  G.skillUse[k] += n || 1;
  const need = 6 + Math.floor(G.skills[k] / 4);
  if (G.skillUse[k] >= need) { G.skillUse[k] = 0; G.skills[k]++; const names = { blade: 'Клинок', destr: 'Разрушение', armor: 'Доспех', craft: 'Ремесло', alch: 'Алхимия', lock: 'Взлом' }; log(`Навык «${names[k]}» повышен до ${G.skills[k]}`, 'blue'); }
}
const PERKS = {
  tough:   { name: 'Крепкая шкура', text: '+15 здоровья, −10% урона. Бить будут так же часто, но реже насмерть', max: 3 },
  brawler: { name: 'Тяжёлая рука', text: '+12% к урону. Проблемы решаются не быстрее, но громче', max: 3 },
  swift:   { name: 'Лёгкий шаг', text: '+8% скорости, +20 выносливости. Убегать — тоже тактика', max: 2 },
  mage:    { name: 'Ясный ум', text: '+15 маны, +20% к урону заклинаний. Умные тоже дерутся', max: 3 },
  parry:   { name: 'Чувство боя', text: 'Окно парирования вдвое шире. Наконец-то честный навык', max: 1 },
  thrift:  { name: 'Бережливость', text: 'Снаряжение изнашивается вдвое медленнее. Брандт будет недоволен', max: 1 },
  scout:   { name: 'Глаз следопыта', text: 'Травы и жилы видно дальше, добыча щедрее. Собирательство — основа экономики', max: 2 },
  haggler: { name: 'Купеческий говор', text: 'Цены на 12% выгоднее. Спасение мира окупается медленно', max: 2 }
};
function perkLvl(k) { return (G.perks && G.perks[k]) || 0; }
function offerPerks() {
  const pool = Object.keys(PERKS).filter(k => perkLvl(k) < PERKS[k].max);
  if (!pool.length) return;
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const pick = pool.slice(0, 3);
  Dialog.show({ name: `Уровень ${G.lvl}`, voice: null, text: 'Ты стал опытнее. Это значит, что теперь ты делаешь те же ошибки, но осознанно.\n\nВыбери, к чему лежит рука.', opts: pick.map(k => ({ label: PERKS[k].name + (perkLvl(k) ? ' ' + (perkLvl(k) + 1) : ''), main: true, go: () => {
    G.perks = G.perks || {}; G.perks[k] = perkLvl(k) + 1;
    if (k === 'tough') G.maxHp += 15; if (k === 'swift') G.maxSta += 20; if (k === 'mage') G.maxMp += 15;
    G.hp = effMaxHp(); G.mp = effMaxMp(); G.sta = effMaxSta();
    log('Получен перк: ' + PERKS[k].name + ' — ' + PERKS[k].text, 'gold'); SFX.quest(); return 'close';
  } })).concat([{ label: 'Позже', go: () => 'close' }]) });
}
function levelUp() { G.lvl++; G.maxHp += 12; G.maxMp += 6; G.maxSta += 6; G.hp = effMaxHp(); G.mp = effMaxMp(); G.sta = effMaxSta(); log(`Уровень ${G.lvl}. Ты стал сильнее — примерно на столько, на сколько мир стал опаснее. Чистый ноль, но с фанфарами.`, 'gold'); SFX.level(); G.perkPending = (G.perkPending || 0) + 1; vibrate(60); }
function gainXp(n) { G.xp += n; while (G.xp >= xpNeed()) { G.xp -= xpNeed(); levelUp(); } }
function xpNeed() { return 80 + (G.lvl - 1) * 70; }

function attack() {
  if (P.swing > 0 || P.dead || UI.open || P.block > 0) return;
  const w = wdef(); const cost = w ? w.sta : 4;
  if (G.sta < cost) { log('Нет сил для удара', 'red'); UI.shakeBtn('bAttack'); return; }
  G.sta -= cost; P.swingT = w ? w.spd : 0.3; P.swing = P.swingT; P.swingHit = false; SFX.swing(); UI.hintSeen('attack');
}
function startBlock() { if (P.dead || UI.open) return; if (!G.eq.shield && !wdef()) return; if (!P.blockHold) P.blockT = G.playTime; P.block = 1; P.blockHold = true; UI.hintSeen('block'); }
function endBlock() { P.blockHold = false; P.block = 0; }
function castSpell() {
  if (P.castAnim > 0 || P.dead || UI.open) return;
  const sp = SPELLS[G.spell];
  if (G.mp < sp.mp) { log('Не хватает маны', 'blue'); UI.shakeBtn('bSpell'); return; }
  G.mp -= sp.mp; P.castAnim = 0.5; UI.hintSeen('spell');
  if (sp.self) { G.hp = Math.min(effMaxHp(), G.hp + sp.heal + G.skills.destr * 0.4); SFX.heal(); floatText(P.x, P.h + 0.5, P.z, '+' + Math.round(sp.heal), '#9ad27a'); skillUse('destr'); return; }
  if (G.spell === 'ice') SFX.ice(); else SFX.fire();
  const dir = viewDir();
  const m = spriteMesh(TEX.SPR[sp.sprite], [0.6, 0.6], { y: 0, emissive: true, own: true }); if (G.spell === 'ash') m.material.color.setRGB(0.85, 0.65, 0.24);
  m.position.set(P.x + dir.x * 0.8, P.gy + P.h + P.y - 0.2, P.z + dir.z * 0.8); L.group.add(m);
  const light = takeLight(sp.color);
  L.projectiles.push({ mesh: m, light, vx: dir.x * sp.speed, vy: dir.y * sp.speed, vz: dir.z * sp.speed, life: 1.6, dmg: (sp.dmg + G.skills.destr * 0.5) * (1 + (G.lvl - 1) * 0.04), fromPlayer: true, slow: sp.slow || 0, spell: G.spell, aoe: sp.aoe || 0 });
  skillUse('destr');
}
function viewDir() { const cp = Math.cos(P.pitch); return { x: -Math.sin(P.yaw) * cp, y: Math.sin(P.pitch), z: -Math.cos(P.yaw) * cp }; }
function facingDot(x, z) { const d = viewDir(); const dx = x - P.x, dz = z - P.z, l = Math.hypot(dx, dz) || 1; return (dx / l) * d.x + (dz / l) * d.z; }

function damagePlayer(n, src, raw) {
  if (P.dead) return;
  const ar = armorVal(); let dmg = raw ? Math.round(n) : Math.max(1, Math.round(n * (20 / (20 + ar)) * rand(0.85, 1.15) * (1 - perkLvl('tough') * 0.1)));
  if (raw) { G.hp -= dmg; P.hurtT = 0.35; if (G.hp <= 0 && !P.dead) { G.hp = 0; P.dead = true; G.stats.deaths = (G.stats.deaths || 0) + 1; SFX.die(); P.deathTimer = setTimeout(() => { if (P.dead) UI.show('death'); }, 900); } return; }
  const facing = src && src.x !== undefined ? facingDot(src.x, src.z) > 0.3 : true;
  if (P.block > 0 && facing) { const sh = eqItem('shield'); dmg = Math.round(dmg * (sh ? 0.3 : 0.6)); G.sta -= 6; SFX.block(); sparks(P.x + viewDir().x, P.h, P.z + viewDir().z, 4); if (sh) wearItem('shield', 1.5); else wearItem('weapon', 1); if (G.sta <= 0) { G.sta = 0; P.block = 0; P.blockHold = false; log('Руки устали держать блок', 'red'); } if (src && src.t) src.cd = Math.max(src.cd, 0.6); }
  else { P.hurtT = 0.35; P.shake = 0.25; SFX.hurt(); vibrate(30); skillUse('armor'); wearItem('armor', 1); if (Math.random() < 0.4) wearItem('helmet', 1); }
  G.hp -= dmg;
  if (src && src.t && src.t.poison && Math.random() < src.t.poison && G.poison <= 0 && !(P.block > 0 && facing)) { G.poison = 12; log('Ты отравлен! Нужно противоядие.', 'green'); }
  $('dmg').style.opacity = '1'; setTimeout(() => $('dmg').style.opacity = '0', 180);
  if (G.hp <= 0) { G.hp = 0; P.dead = true; G.stats.deaths = (G.stats.deaths || 0) + 1; SFX.die(); P.deathTimer = setTimeout(() => { if (P.dead) UI.show('death'); }, 900); }
}
function damageEnemy(en, n, knock, kind) {
  if (en.dead) return;
  const w = wdef(), wi = weapon();
  if (kind === 'melee' && en.t.bones && w && w.crush) n *= 1.8;
  if (kind === 'melee' && en.t.ghost && !(w && w.silver)) n *= 0.5;
  if (en.blockT > 0 && kind === 'melee') { n *= 0.25; SFX.block(); floatText(en.x, en.t.size[1] + 0.3, en.z, 'блок', '#c9bea3'); }
  if (kind === 'melee' && wi && wi.ench) { if (wi.ench === 'fire') { n += 6; en.burn = 3; } if (wi.ench === 'frost') en.slow = 3; if (wi.ench === 'life') G.hp = Math.min(effMaxHp(), G.hp + 2); if (wi.ench === 'ash') en.burn = 4; }
  const dmg = Math.round(n * rand(0.8, 1.2)); en.hp -= dmg; en.flash = 0.15; if (en.friendly) { en.friendly = false; log(`${en.name} нападает на тебя!`, 'red'); if (en.type.startsWith('bandit') || en.type === 'chief') for (const o of L.enemies) if (o.friendly && (o.type.startsWith('bandit') || o.type === 'chief') && dist2(o.x, o.z, en.x, en.z) < 9) { o.friendly = false; o.state = 'chase'; o.talk = null; } } en.state = 'chase'; if (en.t.bones || en.t.ghost) SFX.hitBone(); else SFX.hit();
  spawnFx(en.t.bones || en.t.ghost ? 'hitFx' : 'bloodFx', en.x + rand(-0.3, 0.3), en.t.size[1] * 0.6, en.z + rand(-0.3, 0.3), 0.22);
  if (en.t.bones && kind === 'melee') sparks(en.x, en.t.size[1] * 0.6, en.z, 3);
  floatText(en.x, en.t.size[1] + 0.3, en.z, '-' + dmg, kind === 'spell' ? '#8fb3ff' : '#ffd080');
  if (kind === 'melee') { vibrate(10); wearItem('weapon', w && w.tool === 'axe' ? 1.5 : 1); }
  UI.target(en);
  if (dmg >= en.maxHp * 0.15 && en.staggerN < 3) { en.stagger = 0.5; en.cd = Math.max(en.cd, 0.5); en.staggerN++; }
  if (knock) { const dx = en.x - P.x, dz = en.z - P.z, l = Math.hypot(dx, dz) || 1; moveWithCollision(en, dx / l * 0.5, dz / l * 0.5, 0.4); }
  if (en.hp <= 0) killEnemy(en);
  else if (en.boss && en.hp < en.maxHp * 0.5 && en.phase === 0) bossPhase(en);
}
function bossPhase(en) {
  en.phase = 1;
  if (en.t.boss === 'lich') { for (let i = 0; i < 2; i++) { const c = freeCellNear(Math.floor(en.x / CS) + (i ? 2 : -2), Math.floor(en.z / CS), 2); if (c) { const s = spawnEnemy({ id: 'summon_' + uid(), temp: true, type: 'skeleton', x: c[0], z: c[1] }); s.state = 'chase'; } } log('Ворлат: «Вставайте. Он не за вами — он за ключом. Значит, и за вами».', 'gold'); SFX.voice('ghost'); }
  if (en.t.boss === 'queen') { G.poison = Math.max(G.poison, 6); P.webbed = 3; log('Матка оплела тебя паутиной!', 'red'); }
  if (en.t.boss === 'bear') { en.t = Object.assign({}, en.t, { speed: en.t.speed * 1.3, dmg: en.t.dmg * 1.2 }); log('Шатун ревёт от ярости!', 'red'); SFX.voice('bear'); }
  if (en.t.boss === 'chief') { log('Хродгар уходит в глухую защиту!', 'red'); en.blockT = 3; }
}
function killEnemy(en) {
  if (en.dead) return; en.dead = true; if (!en.temp) G.killed[en.id] = G.day; G.stats.kills++; const i = L.enemies.indexOf(en); if (i >= 0) L.enemies.splice(i, 1); en.mesh.dying = true; en.mesh.baseY = en.mesh.position.y; L.fx.push({ mesh: en.mesh, life: 1.4, t: 0, dying: true, base: en.mesh.position.y });
  gainXp(en.t.xp); log(`${en.name} повержен (+${en.t.xp} опыта)`, 'green'); SFX.dieFoe(en.t.voice); vibrate(40);
  const gold = Math.round(rand(en.t.gold[0], en.t.gold[1])); if (gold > 0) spawnGold(en.x + rand(-0.3, 0.3), en.z + rand(-0.3, 0.3), gold);
  for (const [it, p] of en.t.drop) if (Math.random() < p) { let px = en.x + rand(-0.7, 0.7), pz = en.z + rand(-0.7, 0.7); if (blocked(px, pz, 0.2)) { px = en.x; pz = en.z; } const d = ITEMS[it], inst = ['weapon', 'armor', 'shield', 'helmet'].includes(d.type) ? affixify({ dur: d.maxDur, plus: 0, ench: null }, it, perkLvl('scout') * 0.3) : undefined; spawnPickup(it, px, pz, null, 1, inst); }
  if (en.drop) { addItem(en.drop, 1); log(`С тела: ${ITEMS[en.drop].name}`, 'gold'); }
  if (en.id === 'f_bear') addItem('bear_pelt', 1);
  if (en.t.bones) { const lv = L; setTimeout(() => { if (L === lv) spawnFx('bones', en.x, 0.25, en.z, 60, [1.2, 0.5]); }, 1200); }
  if (!en.t.bones && !en.t.ghost) { const dm = R.decal('blood', en.x, gy(en.x, en.z) + 0.03, en.z, 1.1 + Math.random() * 0.6, Math.random() * 6.28); L.group.add(dm); }
  if (en.id === 'd_boss') { G.flags.bossDead = true; log('Ворлат рассыпался в пепел. Крипта затихла.', 'gold'); }
  if (en.id === 'f_chief') { G.flags.chiefDead = true; log('Атаман Хродгар мёртв.', 'gold'); }
  if (en.id === 'm_boss') { G.flags.queenDead = true; log('Паучья матка издохла. Шахта чиста.', 'gold'); }
  if (en.id === 'f_bear') G.flags.bearDead = true;
  if (en.id === 'f_ansgar') G.flags.ansgarDead = true;
  Quests.check();
}
function addItem(id, q, silent, props) {
  q = q || 1; const d = ITEMS[id]; let added;
  if (STACKABLE.has(d.type) && !props) { const s = G.inv.find(i => i.id === id); if (s) { s.q += q; added = s; } else { added = { uid: uid(), id, q }; G.inv.push(added); } }
  else for (let i = 0; i < q; i++) { added = Object.assign({ uid: uid(), id, q: 1, dur: d.maxDur, plus: 0, ench: null }, props || {}); G.inv.push(added); }
  if (!silent) { log(`Получено: ${itemName(added)}${q > 1 ? ' ×' + q : ''}`, 'gold'); SFX.pickup(); UI.toast(added, q); }
  G.stats.picked++; Quests.check(); return added;
}
function removeItem(id, q) { q = q || 1; while (q > 0) { let i = G.inv.findIndex(s => s.id === id && !Object.values(G.eq).includes(s.uid)); if (i < 0) i = G.inv.findIndex(s => s.id === id); if (i < 0) return false; const s = G.inv[i]; if (s.q > q) { s.q -= q; q = 0; } else { q -= s.q; G.inv.splice(i, 1); for (const k in G.eq) if (G.eq[k] === s.uid) G.eq[k] = null; G.quick = G.quick.map(u => u === s.uid ? null : u); } } return true; }
function removeInst(u) { const i = G.inv.findIndex(s => s.uid === u); if (i < 0) return; G.inv.splice(i, 1); for (const k in G.eq) if (G.eq[k] === u) G.eq[k] = null; G.quick = G.quick.map(x => x === u ? null : x); }
function countItem(id) { return G.inv.filter(i => i.id === id).reduce((a, i) => a + i.q, 0); }
function hasTool(t) { return G.inv.some(s => ITEMS[s.id].tool === t); }
function equipItem(u) { const i = inst(u); if (!i) return; const d = ITEMS[i.id]; if (!SLOTS.includes(d.type)) return; G.eq[d.type] = u; SFX.pickup(); }
function consume(u) {
  const i = inst(u); if (!i) return; const it = ITEMS[i.id];
  if (it.hp) G.hp = Math.min(effMaxHp(), G.hp + it.hp); if (it.mp) G.mp = Math.min(effMaxMp(), G.mp + it.mp);
  if (it.food) G.hunger = Math.min(100, G.hunger + it.food); if (it.drink) G.thirst = Math.min(100, G.thirst + it.drink); if (it.cure) G.poison = 0; if (it.warmT) G.warmT = it.warmT;
  if (it.type === 'potion' && !it.food) G.thirst = Math.min(100, G.thirst + 5);
  removeItem(i.id, 1); if (it.type === 'food') SFX.eat(); else SFX.drink(); log(`${it.type === 'food' ? 'Съедено' : 'Выпито'}: ${it.name}`, 'green');
}
function drinkFlask() { if (!countItem('flask')) return false; if (!G.flaskWater) { log('Фляга пуста. Наполни у колодца или пруда.', 'red'); return false; } G.flaskWater--; G.thirst = Math.min(100, G.thirst + 35); SFX.drink(); log(`Глоток из фляги (${G.flaskWater}/3)`, 'blue'); return true; }
const QUICK_N = 4;
function setQuick(u) { // назначить в первую свободную ячейку (или снять, если уже там)
  const qi = G.quick.indexOf(u); if (qi >= 0) { G.quick[qi] = null; log('Убрано из ячейки ' + (qi + 1)); return; }
  let f = G.quick.indexOf(null); if (f < 0) f = QUICK_N - 1; G.quick[f] = u; const it = inst(u); log((it ? ITEMS[it.id].name : 'Предмет') + ' → ячейка ' + (f + 1), 'gold');
}
function useQuick(n) { UI.hintSeen('quick'); const u = G.quick[n]; if (!u) { log('Пустая ячейка. Назначь в сумке: предмет → «В ячейку».', 'red'); return; } const i = inst(u); if (!i) { G.quick[n] = null; return; } if (i.id === 'flask') drinkFlask(); else consume(u); }

// ---------- Ввод: см. input.js ----------

// ---------- Взаимодействие ----------
function nearWater() { const cx = Math.floor(P.x / CS), cz = Math.floor(P.z / CS); for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (cellAt(L.map, cx + dx, cz + dz) === 'w') return true; return false; }
function findInteract() {
  if (!L) return null;
  let best = null, bd = 3.7;
  const consider = (x, z, obj) => { const d = dist2(P.x, P.z, x, z); if (d < bd && facingDot(x, z) > 0.55) { bd = d; best = obj; } };
  for (const n of L.npcs) consider(n.x, n.z, { kind: 'npc', n, label: `Поговорить: ${n.def.name}` });
  for (const en of L.enemies) if (en.friendly && en.talk) consider(en.x, en.z, { kind: 'enemyTalk', en, label: `Поговорить: ${en.name}` });
  for (const c of L.chests) if (!c.opened) consider(c.x, c.z, { kind: 'chest', c, label: c.locked ? (countItem('lockpick') ? `Взломать сундук (замок ${c.def.lock})` : 'Сундук заперт — нужна отмычка') : 'Открыть сундук' });
  for (const d of L.def.doors) consider(cw(d.cx), cw(d.cz), { kind: 'door', d, label: d.label });
  for (const key in L.locks) { const [x, z] = key.split(',').map(Number); const isK = L.map[z][x] === 'K'; consider(cw(x), cw(z), { kind: 'lock', key, x, z, pick: isK, label: isK ? (countItem('lockpick') ? 'Взломать замок' : 'Заперто — нужна отмычка') : countItem('key_rusty') ? 'Отпереть дверь' : 'Дверь заперта' }); }
  for (const key in L.doorMeshes) { const [x, z] = key.split(',').map(Number); consider(cw(x), cw(z), { kind: 'swing', key, x, z, label: G.doors[L.id + ':' + key] ? 'Закрыть дверь' : 'Открыть дверь' }); }
  for (const a of L.acts) {
    const t = a.p.act, cd = G.gather[a.id] || 0, ready = !cd || G.day - cd >= (t === 'gem' ? 3 : 1);
    const label = t === 'anvil' ? 'Наковальня: ковка, улучшение, ремонт' : t === 'furnace' ? 'Плавильня: руда → слитки' : t === 'cauldron' ? 'Котёл: алхимия' : t === 'altar' ? 'Алтарь: зачарование рунами' : t === 'campfire' ? 'Костёр: готовить / отдохнуть' : t === 'bed' ? 'Лечь спать' : t === 'sign' ? 'Прочитать указатель' : t === 'read' ? (a.p.label || 'Прочитать')
      : t === 'ore' ? (!ready ? 'Жила выработана' : hasTool('pick') ? 'Добыть руду' : 'Руда (нужна кирка)') : t === 'gem' ? (!ready ? 'Пусто' : hasTool('pick') ? 'Добыть самоцвет' : 'Самоцветы (нужна кирка)') : t === 'stump' ? (!ready ? 'Пень' : hasTool('axe') ? 'Нарубить дров' : 'Дрова (нужен топор)') : t === 'well' ? (a.p.label || 'Набрать воды / напиться') : t;
    consider(a.x, a.z, { kind: 'act', a, label });
  }
  if (!best) { const d = viewDir(); for (let s = 1.2; s <= 5.2; s += 0.8) { const cx = Math.floor((P.x + d.x * s) / CS), cz = Math.floor((P.z + d.z * s) / CS); const tr = L.trees[cx + ',' + cz]; if (tr) { best = { kind: 'tree', tr, label: hasTool('axe') ? `Срубить дерево (${tr.hp})` : 'Дерево (нужен топор)' }; break; } } }
  if (!best && nearWater()) best = { kind: 'water', label: countItem('flask') && G.flaskWater < 3 ? 'Напиться и наполнить флягу' : 'Напиться' };
  if (!best && hasTool('shovel') && L.def.outdoor && P.pitch < -0.35) { const d = viewDir(); const cx = Math.floor((P.x + d.x * 2.4) / CS), cz = Math.floor((P.z + d.z * 2.4) / CS); const ch = cellAt(L.map, cx, cz); if (ch === '.' || ch === 'g' || ch === ',') { const dug = (G.dug[L.id] || {})[cx + ',' + cz], tr = L.def.treasure, isTr = tr && tr.x === cx && tr.z === cz && countItem('treasure_map') && !G.flags.treasureFound; best = { kind: 'dig', cx, cz, label: dug && !isTr ? 'Здесь уже копали' : isTr ? 'Копать здесь (карта)' : 'Копать' }; } }
  return best;
}
function drinkWater() { G.thirst = Math.min(100, G.thirst + 40); SFX.drink(); if (countItem('flask')) { G.flaskWater = 3; log('Напился и наполнил флягу', 'blue'); } else log('Напился воды', 'blue'); }
function interact() {
  if (UI.open || P.dead) return;
  const t = findInteract(); if (!t) return;
  UI.hintSeen('use');
  if (t.kind === 'npc') Dialog.start(t.n.def.id);
  else if (t.kind === 'enemyTalk') Dialog.start(t.en.talk);
  else if (t.kind === 'chest') {
    if (t.c.locked) { if (!countItem('lockpick')) { log('Нужна отмычка. Брандт продаёт, разбойники носят.', 'red'); return; } Mini.lockpick(t.c.def.lock, ok => { if (ok) { t.c.locked = false; G.unlocked[L.id + ':chest:' + t.c.def.id] = 1; t.c.mesh.material.map = TEX.SPR.chest; SFX.unlock(); log('Замок поддался.', 'gold'); skillUse('lock', 2); } }); return; }
    t.c.opened = true; G.opened[t.c.def.id] = 1; t.c.mesh.material.map = TEX.SPR.chestOpen; SFX.open();
    const loot = t.c.def.loot; if (loot.gold) { G.gold += loot.gold; log(`+${loot.gold} золота`, 'gold'); SFX.gold(); }
    for (const it of loot.items) { const added = addItem(it, 1); if (added && !added.q2) affixify(added, it, perkLvl('scout') * 0.3); }
    if (loot.random) { const pool = ['gem_red', 'gem_blue', 'gem_purple', 'potion_hp', 'lockpick', 'ingot', 'rune_fire', 'rune_frost']; addItem(pool[Math.floor(hash2(t.c.def.x, t.c.def.z, G.day) * pool.length)], 1); }
  } else if (t.kind === 'door') { if (t.d.locked && !G.flags[t.d.locked]) { log(t.d.lockedText || 'Заперто.', 'red'); return; } if (t.d.sealed && G.flags[t.d.sealed]) { log(t.d.sealedText || 'Заперто наглухо.', 'red'); return; } changeLevel(t.d.to, t.d.spawn); }
  else if (t.kind === 'swing') { const k = L.id + ':' + t.key; G.doors[k] = !G.doors[k]; L.doorMeshes[t.key].setEnabled(!G.doors[k]); SFX.door(); }
  else if (t.kind === 'lock') {
    if (t.pick) { if (!countItem('lockpick')) { log('Нужна отмычка.', 'red'); return; } Mini.lockpick(2, ok => { if (ok) { G.unlocked[L.id + ':' + t.key] = 1; L.group.remove(L.locks[t.key]); delete L.locks[t.key]; SFX.unlock(); log('Замок открыт.', 'gold'); skillUse('lock', 3); } }); return; }
    if (countItem('key_rusty')) { removeItem('key_rusty'); G.unlocked[L.id + ':' + t.key] = 1; L.group.remove(L.locks[t.key]); delete L.locks[t.key]; SFX.unlock(); log('Ржавый ключ повернулся. Дверь открыта.', 'gold'); }
    else log('Заперто. Нужен ключ.', 'red');
  } else if (t.kind === 'tree') {
    if (!hasTool('axe')) { log('Нужен топор.', 'red'); return; } if (P.swing > 0) return;
    P.swing = 0.6; P.swingT = 0.6; P.swingHit = true; SFX.chop(); wearItem('weapon', 1); vibrate(15); t.tr.hp--; sparks(t.tr.mesh.position.x, 1.2, t.tr.mesh.position.z, 3, 'wood');
    if (t.tr.hp <= 0) { const tr = t.tr; removeTreeInstance(tr); delete L.trees[tr.x + ',' + tr.z]; mapSet(tr.x, tr.z, L.def.kind === 'forest' ? 'g' : '.'); (G.cut[L.id] = G.cut[L.id] || {})[tr.x + ',' + tr.z] = G.day; const m = R.propOrSprite('treeStump', [1.4, 0.8]); m.position.x = cw(tr.x); m.position.z = cw(tr.z); L.group.add(m); SFX.treeFall(); addItem('wood', tr.kind === 'd' ? 2 : 3); G.stats.chopped++; if (Math.random() < 0.15) addItem('mushroom', 1); }
  } else if (t.kind === 'water') drinkWater();
  else if (t.kind === 'dig') {
    if (P.swing > 0) return; const key = t.cx + ',' + t.cz; const dug = G.dug[L.id] = G.dug[L.id] || {}; const tr0 = L.def.treasure, isTreasure = tr0 && tr0.x === t.cx && tr0.z === t.cz && countItem('treasure_map') && !G.flags.treasureFound; if (dug[key] && !isTreasure) { log('Здесь уже копали.', 'red'); return; }
    P.swing = 0.6; P.swingT = 0.6; P.swingHit = true; SFX.dig(); wearItem('weapon', 1); G.stats.dug++;
    dug[key] = G.day; const m = R.propOrSprite('dirtPile', [1, 0.45], { y: 0.22 }); m.position.x = cw(t.cx); m.position.z = cw(t.cz); m.position.y += gy(m.position.x, m.position.z); L.group.add(m);
    const tr = L.def.treasure; if (tr && tr.x === t.cx && tr.z === t.cz && countItem('treasure_map') && !G.flags.treasureFound) { G.flags.treasureFound = 1; G.gold += 250; addItem('gem_blue', 1); addItem('rune_ash', 1); addItem('sword_steel', 1, false, { plus: 2 }); log('Клад разбойников! +250 золота', 'gold'); SFX.level(); G.quests.treasure = 2; Quests.check(); return; }
    const r = Math.random();
    const rich = hash2(t.cx, t.cz, 31) < 0.06; // «подозрительные» клетки (1 из 16) — богаче
    if (rich) { if (r < 0.5) { const gg = Math.floor(rand(15, 45)); G.gold += gg; log(`Кошель в земле: +${gg} золота`, 'gold'); SFX.gold(); } else if (r < 0.75) addItem('lockpick', 2); else if (r < 0.92) addItem('gem_red', 1); else addItem('gem_purple', 1); }
    else if (r < 0.55) log('Земля и камни.', 'blue'); else if (r < 0.8) addItem(Math.random() < 0.5 ? 'mushroom' : 'herb', 1); else if (r < 0.9 && L.def.kind !== 'village') addItem('ore', 1); else if (r < 0.97) { const gg = Math.floor(rand(3, 12)); G.gold += gg; log(`Пара монет в земле: +${gg}`, 'gold'); SFX.gold(); } else if (r < 0.995) addItem('lockpick', 1); else addItem('gem_red', 1);
  } else if (t.kind === 'act') {
    const a = t.a, k = a.p.act;
    if (k === 'anvil') Craft.open('anvil'); else if (k === 'furnace') Craft.open('furnace'); else if (k === 'cauldron') Craft.open('cauldron'); else if (k === 'altar') { if (G.quests.seal === 1 && countItem('key_seal')) Dialog.start('altar'); else Craft.open('altar'); } else if (k === 'campfire') UI.campfire(); else if (k === 'bed') UI.sleep(true);
    else if (k === 'sign') Dialog.show({ name: 'Указатель', text: a.p.text, opts: [{ label: 'Дальше', go: () => 'close' }] });
    else if (k === 'read') { const opts = []; if (a.p.aloud) opts.push({ label: 'Прочитать вслух', go: () => { readAloud(a); return 'close'; } }); opts.push({ label: 'Закрыть', go: () => 'close' }); Dialog.show({ name: a.p.title || 'Надпись', text: a.p.text, opts }); if (a.p.give && !G.picked[a.id]) { G.picked[a.id] = 1; addItem(a.p.give, 1); } if (a.p.flag) G.flags[a.p.flag] = 1; }
    else if (k === 'well') drinkWater();
    else if (k === 'ore' || k === 'gem') {
      if (!hasTool('pick')) { log('Нужна кирка. Брандт продаёт, или выкуй сам.', 'red'); return; }
      if (G.gather[a.id] && G.day - G.gather[a.id] < (k === 'gem' ? 3 : 1)) { log('Жила пока пуста', 'red'); return; }
      Mini.mine((bonus, cancelled) => { if (cancelled) { log('Добыча прервана.', 'red'); return; } G.gather[a.id] = G.day; SFX.mine(); P.swing = 0.5; P.swingT = 0.5; P.swingHit = true; a.mesh.material.map = TEX.SPR.oreEmpty; wearItem('weapon', 1.5); G.stats.mined++; sparks(a.x, 0.6, a.z, 5); skillUse('craft');
        if (k === 'ore') { addItem('ore', 1 + (bonus ? 1 : 0) + (Math.random() < 0.3 ? 1 : 0)); if (Math.random() < 0.12) addItem(['gem_red', 'gem_purple', 'gem_blue'][Math.floor(Math.random() * 3)], 1); }
        else { const r = Math.random(); addItem(r < 0.45 ? 'gem_red' : r < 0.8 ? 'gem_purple' : 'gem_blue', 1 + (bonus ? 1 : 0)); } });
    } else if (k === 'stump') {
      if (!hasTool('axe')) { log('Нужен топор.', 'red'); return; }
      if (G.gather[a.id] && G.day - G.gather[a.id] < 1) { log('Здесь уже всё вырублено', 'red'); return; }
      G.gather[a.id] = G.day; SFX.chop(); P.swing = 0.6; P.swingT = 0.6; P.swingHit = true; addItem('wood', 2); wearItem('weapon', 1);
    }
  }
}
function readAloud(a) {
  if ((G.flags.readAloud || 0) >= 2) { log('Ты уже знаешь, чем это кончается. Губы не слушаются.', 'blue'); return; }
  log('Ты произносишь слова вслух. Воздух холодеет.', 'red'); SFX.voice('ghost');
  const c = freeCellNear(Math.floor(P.x / CS), Math.floor(P.z / CS) + 2, 3); if (c) { const en = spawnEnemy({ id: 'aloud_' + uid(), temp: true, type: 'wraith', x: c[0], z: c[1] }); en.state = 'chase'; }
  G.flags.readAloud = (G.flags.readAloud || 0) + 1; gainXp(20);
}
let changing = false;
function changeLevel(to, spawn) {
  if (changing || P.dead) return; changing = true;
  // улица → улица: затемнение цветом тумана (перевал в дымке), а не чёрный экран; в помещения — чёрный
  const soft = L && L.def.outdoor && WORLDS[to] && WORLDS[to].outdoor; const fc = R.scene.fogColor; $('fade').style.background = soft ? `rgb(${Math.round(fc.r * 255)},${Math.round(fc.g * 255)},${Math.round(fc.b * 255)})` : '#000';
  $('fade').classList.add('on');
  setTimeout(() => { if (P.dead) { changing = false; $('fade').classList.remove('on'); return; } loadLevel(to, spawn); Save.auto(); setTimeout(() => { $('fade').classList.remove('on'); changing = false; }, soft ? 80 : 150); }, soft ? 380 : 520);
}
function refreshGatherSprites() { for (const a of L.acts) if (a.p.act === 'ore' || a.p.act === 'gem') a.mesh.material.map = (G.gather[a.id] && G.day - G.gather[a.id] < (a.p.act === 'gem' ? 3 : 1)) ? TEX.SPR.oreEmpty : TEX.SPR[a.p.sprite]; }

// ---------- Погода и температура ----------
function envTemp() {
  const k = L.def.kind, t = G.time, day = Math.max(0, Math.sin((t - 0.25) * Math.PI * 2));
  let temp = k === 'interior' ? 19 : k === 'crypt' ? 3 : k === 'mine' ? 6 : k === 'forest' ? -2 + day * 15 : 1 + day * 17;
  if (L.def.outdoor) { if (G.weather.type === 'rain') temp -= 4 - (eqItem('cloak') ? 3 : 0); if (G.weather.type === 'snow') temp -= 9; }
  let heat = 0; for (const h of L.heat) { const d = dist2(P.x, P.z, h.x, h.z); if (d < h.r) heat = Math.max(heat, h.k * (1 - d / h.r)); }
  const gear = warmGear(); return temp + heat + (temp > 14 ? gear * 0.5 : gear) + (G.warmT > 0 ? 12 : 0);
}
function updateWeather(dt) {
  const w = G.weather; w.until -= dt;
  if (w.until <= 0) { const r = Math.random(); w.type = r < 0.55 ? 'clear' : r < 0.8 ? 'rain' : 'snow'; w.until = rand(240, 600); if (L.def.outdoor) log(w.type === 'rain' ? 'Начинается дождь.' : w.type === 'snow' ? 'С перевала идёт снег.' : 'Небо проясняется.', 'blue'); }
}

// ---------- Обновление ----------
let lastT = performance.now(), exploreT = 0, warnT = 0, autosaveT = 0, ambT = 3, heartT = 0, crackleT = 1;
function update(dt) {
  if (!L || !G) return;
  G.playTime += dt;
  const paused = UI.open || P.dead || document.body.classList.contains('portrait') || (typeof Layout !== 'undefined' && Layout.active);
  if (!paused) { G.time = (G.time + dt / 480) % 1; if (G.time < G.lastTime) G.day++; G.lastTime = G.time; updateWeather(dt); }
  // ночью в лесу и за воротами бродят твари: чем дальше от деревни, тем чаще
  if (L.def.outdoor && !paused) {
    const night = Math.sin((G.time - 0.25) * Math.PI * 2) < -0.15;
    if (night && G.nightWave !== G.day + ':' + L.id && L.enemies.length < 14) {
      G.nightWave = G.day + ':' + L.id;
      const n = L.id === 'forest' ? 4 : 2, types = L.id === 'forest' ? ['wolf', 'wolf', 'spider', 'skeleton'] : ['wolf', 'skeleton'];
      for (let i = 0; i < n; i++) {
        let tries = 24, cx = 0, cz = 0, ok = false;
        while (tries-- > 0) { cx = 1 + Math.floor(Math.random() * (L.map[0].length - 2)); cz = 1 + Math.floor(Math.random() * (L.map.length - 2)); const ch = cellAt(L.map, cx, cz);
          if ((ch === '.' || ch === 'g' || ch === ',') && dist2(cw(cx), cw(cz), P.x, P.z) > 22) { ok = true; break; } }
        if (!ok) continue;
        const en = spawnEnemy({ id: 'night' + G.day + '_' + L.id + '_' + i, type: types[Math.floor(Math.random() * types.length)], x: cx, z: cz, temp: true });
        if (en) { en.hp = en.maxHp = Math.round(en.maxHp * 1.25); en.night = true; }
      }
      log('Стемнело. В темноте кто-то воет.', 'red');
    }
    if (!night && G.nightWave) { for (const en of [...L.enemies]) if (en.night && dist2(en.x, en.z, P.x, P.z) > 26) { const i = L.enemies.indexOf(en); if (i >= 0) { L.enemies.splice(i, 1); L.group.remove(en.mesh); } } G.nightWave = null; }
  }
  if (G.flags.endingKeep && L.id === 'village' && Math.sin((G.time - 0.25) * Math.PI * 2) < 0.05 && G.nightSpawnDay !== G.day) { G.nightSpawnDay = G.day; for (const e of L.def.enemies) if (e.night && !L.enemies.some(o => o.id === e.id)) { spawnEnemy(e); log('От часовни тянет холодом. Кто-то поднялся.', 'red'); } }
  if (!paused) { const sens = 0.0042 * (OPTS.sens || 1); P.yaw -= IN.lookDX * sens - IN.gyroYaw; P.pitch = clamp(P.pitch - IN.lookDY * sens * (OPTS.invertY ? -1 : 1) + IN.gyroPitch, -1.2, 1.2); }
  IN.lookDX = 0; IN.lookDY = 0; IN.gyroYaw = 0; IN.gyroPitch = 0;
  let mx = 0, mz = 0;
  if (!paused) {
    if (IN.joy) { const dx = IN.joy.x - IN.joy.ox, dy = IN.joy.y - IN.joy.oy, l = Math.hypot(dx, dy); const k = Math.min(1, l / 48); if (l > 4) { mx = dx / l * k; mz = dy / l * k; } }
    if (IN.keys.KeyW || IN.keys.ArrowUp) mz -= 1; if (IN.keys.KeyS || IN.keys.ArrowDown) mz += 1; if (IN.keys.KeyA || IN.keys.ArrowLeft) mx -= 1; if (IN.keys.KeyD || IN.keys.ArrowRight) mx += 1;
    const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
  }
  let speed = 5.6 * (1 + perkLvl('swift') * 0.08) * (G.rest <= 0 ? 0.7 : 1) * (G.hunger <= 0 ? 0.85 : 1) * (G.warmth < 12 ? 0.8 : 1);
  if (P.webbed > 0) { P.webbed -= dt; speed *= 0.35; }
  if (P.swim) speed *= 0.5; else if (P.wade > 0.25) speed *= 0.7;
  if (mz > 0.2) speed *= 0.6; else if (Math.abs(mx) > 0.5 && mz > -0.3) speed *= 0.75;
  if (P.swing > 0 || P.block > 0) speed *= 0.55;
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
  moveWithCollision(P, (fx * -mz + rx * mx) * speed * dt, (fz * -mz + rz * mx) * speed * dt, P.r);
  P.moving = Math.hypot(mx, mz); if (P.moving > 0.1) UI.hintSeen('move');
  if (IN.jump) { IN.jump = false; if (P.y <= 0.001 && !paused && G.sta >= 10) { P.vy = 5.2; G.sta -= 10; } }
  const wasAir = P.y > 0.05, fallV = P.vy;
  P.vy -= 16 * dt; P.y += P.vy * dt; if (P.y < 0) { P.y = 0; P.vy = 0; }
  P.gy = gy(P.x, P.z);
  // --- вода: брод, плавание, погружение ---
  const wy = L.def.outdoor ? Terrain.waterY : -99, depth = wy - P.gy;
  P.wade = Math.max(0, depth); P.swim = depth > 1.15;
  if (P.swim) { const surf = wy - 0.55; P.y += (surf - P.gy - P.y) * Math.min(1, dt * 6); P.vy = 0; G.sta = Math.max(0, G.sta - dt * 3.5); if (G.sta <= 0) G.hp -= dt * 3; }
  if (P.wade > 0.25 && !P.inWater) { P.inWater = true; SFX.splash(); spawnFx('hitFx', P.x, 0.2, P.z, 0.3, [1.2, 1.2]); }
  else if (P.wade <= 0.2 && P.inWater) { P.inWater = false; SFX.splash(); }
  { const camY = P.gy + P.h + P.y, under = camY < wy - 0.05; R.setUnderwater(under ? G.playTime : 0); if (under !== P.under) { P.under = under; SFX.muffle(under); } }
  // урон от падения: с обрыва больно, в воду — нет
  if (wasAir && P.y <= 0.001 && fallV < -11 && P.wade < 0.5) { const dmg = Math.min(55, Math.round((-fallV - 12) * 3.4)); if (dmg > 0) { damagePlayer(dmg, null, true); SFX.hurt(); P.shake = 0.4; log('Ты жёстко приземлился (-' + dmg + ')', 'red'); } }
  if (P.moving > 0.1 && P.y === 0) { P.bob += dt * 9 * P.moving; P.stepT -= dt * P.moving; if (P.stepT <= 0) { P.stepT = 0.42; SFX.step(L.def.kind === 'interior' ? 'wood' : L.def.outdoor ? '' : 'stone'); } }
  if (P.block > 0 && !P.blockHold) P.block = 0;
  if (!paused) {
    G.hunger = Math.max(0, G.hunger - dt * 100 / 2400); G.rest = Math.max(0, G.rest - dt * 100 / 2400);
    G.thirst = Math.max(0, G.thirst - dt * 100 / (G.warmth > 85 ? 900 : 1800));
    if (G.warmT > 0) G.warmT -= dt;
    const target = clamp(50 + (envTemp() - 10) * 3, 0, 100); G.warmth += (target - G.warmth) * Math.min(1, dt * 0.06);
    warnT -= dt; if (warnT <= 0) { warnT = 40; if (G.hunger < 20) log(G.hunger <= 0 ? 'Ты умираешь от голода. Ирония: в сумке лежит хлеб' : 'Живот сводит от голода. Поешь.', 'red'); else if (G.thirst < 20) log(G.thirst <= 0 ? 'Горло пересохло. Ты умираешь от жажды' : 'Хочется пить. Найди воду или флягу.', 'red'); else if (G.warmth < 20) log('Ты замерзаешь. Костёр, плащ или отвар.', 'red'); else if (G.warmth > 88) log('Жарко. Пей больше.', 'red'); else if (G.rest < 20) log('Глаза слипаются. Найди кровать или костёр.', 'red'); }
    if (G.poison > 0) { G.poison -= dt; G.hp -= dt * 2; }
    if (G.hunger <= 0) G.hp -= dt * 0.5; if (G.thirst <= 0) G.hp -= dt * 0.8; if (G.warmth < 10) G.hp -= dt * 0.35;
    if (G.hp <= 0 && !P.dead) { G.hp = 0; P.dead = true; G.stats.deaths = (G.stats.deaths || 0) + 1; SFX.die(); P.deathTimer = setTimeout(() => { if (P.dead) UI.show('death'); }, 900); }
  }
  const hungry = G.hunger < 20 || G.thirst < 20, cold = G.warmth < 25;
  G.sta = Math.min(effMaxSta(), G.sta + dt * (P.moving > 0.1 ? 4 : 9) * (hungry ? 0.4 : 1) * (cold ? 0.5 : 1));
  G.mp = Math.min(effMaxMp(), G.mp + dt * 0.9);
  const ar = eqItem('armor'), regenEnch = ar && ar.ench === 'life' ? 0.4 : 0;
  if (!hungry && G.poison <= 0 && !P.dead) G.hp = Math.min(effMaxHp(), G.hp + dt * (0.35 + regenEnch));
  P.shiver = cold ? Math.min(1, P.shiver + dt) : Math.max(0, P.shiver - dt);
  if (P.swing > 0) {
    P.swing -= dt;
    if (!P.swingHit && P.swing < P.swingT * 0.65) {
      P.swingHit = true; let hit = false; const w = wdef(), reach = w ? w.reach : 2.0;
      for (const en of [...L.enemies]) { if (en.dead) continue; const d = dist2(P.x, P.z, en.x, en.z); if (d < reach + en.t.size[0] * 0.3 && facingDot(en.x, en.z) > 0.6 && los(P.x, P.z, en.x, en.z)) { damageEnemy(en, weaponDmg(), true, 'melee'); hit = true; } }
      if (hit) { skillUse('blade'); UI.hintSeen('attack'); }
    }
  }
  if (P.castAnim > 0) P.castAnim -= dt;
  if (P.hurtT > 0) P.hurtT -= dt; if (P.shake > 0) P.shake -= dt;
  for (const en of [...L.enemies]) if (!en.dead) updateEnemy(en, dt, paused);
  for (const n of L.npcs) updateNpc(n, dt, paused);
  for (let i = L.projectiles.length - 1; i >= 0; i--) {
    const p = L.projectiles[i]; p.life -= dt; const m = p.mesh;
    m.position.x += p.vx * dt; m.position.y += p.vy * dt; m.position.z += p.vz * dt; if (p.light) p.light.pl.position.copyFrom(m.position);
    const pg = gy(m.position.x, m.position.z); let die = p.life <= 0 || blocked(m.position.x, m.position.z, 0.2, true) || m.position.y < pg || m.position.y > pg + 3.4;
    if (!die && p.fromPlayer) { for (const en of L.enemies) if (dist2(m.position.x, m.position.z, en.x, en.z) < 0.8 + en.t.size[0] * 0.35 && Math.abs(m.position.y - gy(en.x, en.z) - en.t.size[1] / 2) < en.t.size[1] * 0.7) { die = true; break; } }
    if (!die && !p.fromPlayer && dist2(m.position.x, m.position.z, P.x, P.z) < 0.9 && Math.abs(m.position.y - (P.gy + P.y + 1)) < 1.4) { damagePlayer(p.dmg, { x: m.position.x, z: m.position.z }); die = true; SFX.boom(); }
    if (die) {
      if (p.fromPlayer) { const R = p.aoe || 1.2; let any = false; for (const en of [...L.enemies]) if (dist2(m.position.x, m.position.z, en.x, en.z) < R + en.t.size[0] * 0.35) { damageEnemy(en, p.dmg, false, 'spell'); if (p.slow) en.slow = p.slow; if (p.spell === 'ash' || p.spell === 'fire') en.burn = 3; any = true; } if (any) SFX.boom(); }
      spawnFx(p.spell === 'ice' ? 'hitFx' : 'fireball', m.position.x, m.position.y - pg, m.position.z, 0.18, p.aoe ? [3, 3] : [1.4, 1.4]); freeLight(p.light); removeMesh(m); L.projectiles.splice(i, 1);
    }
  }
  for (let i = L.fx.length - 1; i >= 0; i--) {
    const f = L.fx[i]; f.t += dt;
    if (f.dying) { const k = f.t / f.life; f.mesh.update(dt, null); f.mesh.material.opacity = 1 - Math.max(0, k - 0.6) * 2.5; }
    else if (f.vel) { f.mesh.position.x += f.vel.x * dt; f.mesh.position.y += f.vel.y * dt; f.mesh.position.z += f.vel.z * dt; f.vel.y -= 12 * dt; }
    else if (f.life < 1) { const s = 1 + f.t / f.life; f.mesh.scale.set(s, s, 1); }
    if (f.t >= f.life) { removeMesh(f.mesh); L.fx.splice(i, 1); }
  }
  for (let i = FLOAT.length - 1; i >= 0; i--) { FLOAT[i].t += dt; if (FLOAT[i].t > 1) FLOAT.splice(i, 1); }
  for (let i = L.pickups.length - 1; i >= 0; i--) {
    const p = L.pickups[i]; p.t += dt; p.mesh.position.y = gy(p.x, p.z) + (p.item === 'gold' ? 0.05 : 0.3) + Math.sin(p.t * 3) * 0.06; if (p.item !== 'gold') p.mesh.rotation.y += dt * 0.9;
    if (p.noPick > 0) { p.noPick -= dt; if (dist2(P.x, P.z, p.x, p.z) > 1.6) p.noPick = 0; }
    if (!paused && p.noPick <= 0 && dist2(P.x, P.z, p.x, p.z) < 1.25) {
      if (p.item === 'gold') { G.gold += p.q; log(`+${p.q} золота`, 'gold'); SFX.gold(); } else addItem(p.item, p.q, false, p.inst);
      if (p.id) G.picked[p.id] = G.day; if (p.dyn && G.dropped && G.dropped[L.id]) { const arr = G.dropped[L.id], j = arr.findIndex(d => d.k === p.dyn); if (j >= 0) arr.splice(j, 1); } removeMesh(p.mesh); L.pickups.splice(i, 1);
    }
  }
  const bobY = Math.sin(P.bob) * 0.06 * P.moving, bobX = Math.cos(P.bob * 0.5) * 0.04 * P.moving, shk = (P.shake > 0 ? P.shake * 0.15 : 0) + P.shiver * 0.02;
  camera.position.set(P.x + bobX * rx + (Math.random() - 0.5) * shk, P.gy + P.h + P.y + bobY + (Math.random() - 0.5) * shk, P.z + bobX * rz);
  camera.rotation.y = P.yaw + Math.PI; camera.rotation.x = -P.pitch; camera.rotation.z = P.hurtT > 0 ? Math.sin(P.hurtT * 30) * 0.02 : 0;
  exploreT -= dt; if (exploreT <= 0) { exploreT = 0.3; const ex = G.explored[L.id], cx = Math.floor(P.x / CS), cz = Math.floor(P.z / CS), R = L.def.outdoor ? 5 : 3; for (let z = cz - R; z <= cz + R; z++) for (let x = cx - R; x <= cx + R; x++) if (Math.hypot(x - cx, z - cz) <= R + 0.5) ex[x + ',' + z] = 1; }
  autosaveT += dt; if (autosaveT > 120 && !paused) { autosaveT = 0; Save.auto(); UI.saveIcon(); }
  let light = 1;
  const flick = 0.9 + Math.sin(G.playTime * 23) * 0.06 + Math.sin(G.playTime * 7.3) * 0.05;
  if (L.def.outdoor) {
    const t = G.time, sun = Math.max(0, Math.sin((t - 0.25) * Math.PI * 2)), wt = G.weather.type;
    light = 0.18 + sun * 0.82; if (wt !== 'clear') light *= 0.75;
    const dusk = Math.max(0, 1 - Math.abs(Math.sin((t - 0.25) * Math.PI * 2) - 0.12) * 3) * (wt !== 'clear' ? 0.3 : 1); L.dusk = dusk;
    const sky = { r: lerp(0.03, 0.42, light) + dusk * 0.25, g: lerp(0.03, 0.6, light) + dusk * 0.05, b: lerp(0.07, 0.88, light) };
    const fog = { r: Math.min(1, lerp(0.05, 0.62, light) + dusk * 0.45), g: lerp(0.04, 0.7, light) + dusk * 0.12, b: lerp(0.1, 0.86, light) };
    if (wt !== 'clear') { for (const c of [sky, fog]) { c.r = c.r * 0.5 + 0.28; c.g = c.g * 0.5 + 0.3; c.b = c.b * 0.5 + 0.36; } }
    if (L.def.kind === 'forest') { sky.r *= 0.85; sky.g *= 0.85; sky.b *= 0.85; }
    R.daylight(light, t, dusk, wt, L.def.kind, new BABYLON.Color3(sky.r, sky.g, sky.b), new BABYLON.Color3(fog.r, fog.g, fog.b));
    if (L.mountains) { L.mountains.position.set(P.x, 0, P.z); L.mountains.userData.far.material.emissiveColor.set(fog.r * 0.7 + sky.r * 0.2, fog.g * 0.7 + sky.g * 0.2, fog.b * 0.75 + sky.b * 0.2); L.mountains.userData.near.material.emissiveColor.set(fog.r * 0.5 + sky.r * 0.2, fog.g * 0.5 + sky.g * 0.2, fog.b * 0.6 + sky.b * 0.2); }
    for (const lt of L.lights) lt.intensity = ((lt.fire ? 1.6 : 1.3) * (1 - light) * flick + (lt.fire ? 0.5 : 0)) * (lt.k || 1) * 2.2;
    { const wm = R.tileMat('water').diffuseTexture; wm.uOffset = (wm.uOffset + dt * 0.03) % 1; wm.vOffset = (wm.vOffset + dt * 0.012) % 1; }
    R.moveWeather(L.ash, P.x, P.z); R.moveWeather(L.snow, P.x, P.z); R.moveWeather(L.rain, P.x, P.z); R.moveWeather(L.fireflies, P.x, P.z);
    if (L.wt !== wt || L.lightQ !== (light > 0.4)) { L.wt = wt; L.lightQ = light > 0.4; R.setWeatherRate(L.ash, wt === 'clear' ? 1 : 0); R.setWeatherRate(L.snow, wt === 'snow' ? 1 : 0); R.setWeatherRate(L.rain, wt === 'rain' ? 1 : 0); R.setWeatherRate(L.fireflies, light < 0.4 ? 1 : 0); }
  } else {
    R.torch.intensity = (L.def.kind === 'interior' ? 0.8 : 1.6) * flick;
    for (const lt of L.lights) lt.intensity = 2.4 * flick * (lt.k || 1);
    if (L.ash) R.moveWeather(L.ash, P.x, P.z);
  }
  R.torch.position.set(P.x, P.gy + P.h + P.y + 0.3, P.z); assignLights();
  R.setWind(L.def.outdoor ? (G.weather.type === 'clear' ? 1 : 2.2) : 0.25);
  // перк предлагаем в спокойный момент: не в бою, не поверх окна
  if (G.perkPending > 0 && !UI.open && !P.dead && !changing && !Mini.active && !L.enemies.some(e => e.state === 'chase' && !e.friendly && dist2(e.x, e.z, P.x, P.z) < 14)) { G.perkPending--; offerPerks(); }
  { // тени в помещении отбрасывает ближайший крупный огонь
    let best = null, bd = 1e9; for (const lt of L.lights) { if (!lt.fire) continue; const d = dist2(P.x, P.z, lt.x, lt.z); if (d < bd) { bd = d; best = lt; } }
    if (best && bd < 100) R.setShadowSource(best.x, best.y + 0.2, best.z, null, true); else R.setShadowSource(0, -100, 0, null, false);
  }
  { const w = wdef(), sh = eqItem('shield'); R.viewmodel(w ? w.view : 'hand', sh ? ITEMS[sh.id].view : null); R.viewmodelUpdate(P.swing, P.swingT || 1, P.block > 0 ? 1 : 0, P.bob, P.moving, P.castAnim > 0 ? 1 : 0); }
  for (const en of L.enemies) { if (en.flash > 0) { en.flash -= dt; en.mesh.material.color.setRGB(1, 0.3, 0.3); } else if (en.slow > 0) en.mesh.material.color.setRGB(0.6, 0.8, 1.2); else if (en.burn > 0) en.mesh.material.color.setRGB(1.2, 0.8, 0.5); else en.mesh.material.color.setRGB(1, 1, 1); }
  for (const en of L.enemies) en.mesh.update(dt, { moving: en.moved, speed: en.t.speed }); for (const n of L.npcs) n.mesh.update(dt, { moving: n.moving, speed: 1.4 });
  { let fd = null; for (const h of L.heat) if (h.k >= 18) { const d = dist2(P.x, P.z, h.x, h.z); if (d < 6 && (fd === null || d < fd)) fd = d; } SFX.fireLoop(fd); crackleT -= dt; if (crackleT <= 0) { crackleT = rand(0.15, 0.6); if (fd !== null) SFX.crackle(fd); } }
  ambT -= dt; if (ambT <= 0) { ambT = rand(4, 10); if (!paused) SFX.ambientTick(L.def.outdoor ? 'outdoor' : L.def.kind === 'interior' ? '' : 'dungeon', light < 0.4); }
  const lowHp = G.hp < effMaxHp() * 0.25 && !P.dead; if (lowHp) { heartT -= dt; if (heartT <= 0) { heartT = 1.1; SFX.heartbeat(); } } MUSIC.duck(lowHp ? 0.45 : 1);
  if (L.enemies.some(en => en.state === 'chase' && !en.friendly && dist2(P.x, P.z, en.x, en.z) < 16)) G.combatUntil = G.playTime + 5;
  MUSIC.set(G.combatUntil > G.playTime ? 'combat' : L.def.music); MUSIC.update(); SFX.weather(L.def.outdoor ? G.weather.type : 'clear');
  UI.tick(dt);
}
function updateNpc(n, dt, paused) {
  n.mesh.position.x = n.x; n.mesh.position.z = n.z; n.mesh.position.y = gy(n.x, n.z);
  { const d = dist2(P.x, P.z, n.x, n.z); if (n.mesh.lookAt) { if (d < 7) { let a = Math.atan2(P.x - n.x, P.z - n.z) - n.mesh.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); n.mesh.lookAt(clamp(a, -1.1, 1.1), clamp((P.gy + P.h - n.mesh.position.y - 1.6) * 0.25, -0.3, 0.3)); } else n.mesh.lookAt(0, 0); } }
  if (n.def.float) n.mesh.position.y += 0.3 + Math.sin(G.playTime * 1.5) * 0.15;
  { const dxp = P.x - n.x, dzp = P.z - n.z; const near = Math.hypot(dxp, dzp) < 4; const want = n.moving ? Math.atan2(n.wx, n.wz) : near ? Math.atan2(dxp, dzp) : n.yaw; let d = want - n.mesh.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); n.mesh.rotation.y += d * Math.min(1, dt * 6); }
  if (paused || !n.def.wander) return;
  n.wander -= dt;
  if (n.wander <= 0) { n.wander = rand(2, 6); if (Math.random() < 0.5) { n.moving = false; n.wx = n.wz = 0; } else { const a = rand(0, Math.PI * 2); n.wx = Math.cos(a); n.wz = Math.sin(a); n.moving = true; if (dist2(n.x, n.z, n.hx, n.hz) > n.def.wander * CS) { const dx = n.hx - n.x, dz = n.hz - n.z, l = Math.hypot(dx, dz); n.wx = dx / l; n.wz = dz / l; } } }
  if (n.moving) { const ox = n.x, oz = n.z; moveWithCollision(n, n.wx * 1.4 * dt, n.wz * 1.4 * dt, 0.4); if (dist2(n.x, n.z, P.x, P.z) < 1.6) { n.x = ox; n.z = oz; } n.anim += dt; }
}
function updateEnemy(en, dt, paused) {
  const px0 = en.x, pz0 = en.z; en.mesh.position.x = en.x; en.mesh.position.z = en.z; if (!en.mesh.dying) en.mesh.position.y = gy(en.x, en.z);
  if (en.t.float) en.mesh.position.y += 0.2 + Math.sin(G.playTime * 2 + en.x) * 0.15;
  if (en.lunge > 0) en.lunge -= dt;
  { const sc = en.mesh.rotation; const want = (en.state === 'chase' && !en.friendly) ? Math.atan2(P.x - en.x, P.z - en.z) : (en.wx || en.wz) ? Math.atan2(en.wx, en.wz) : en.yaw; let dd = want - sc.y; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); sc.y += dd * Math.min(1, dt * 7); if (en.stagger > 0) sc.z = Math.sin(G.playTime * 30) * 0.08; else sc.z = 0; }
  en.moved = false;
  if (paused) return;
  if (en.burn > 0) { en.burn -= dt; en.hp -= dt * 3; if (Math.random() < dt * 4) spawnFx('fireball', en.x + rand(-0.4, 0.4), en.t.size[1] * rand(0.2, 0.9), en.z, 0.3, [0.35, 0.35], { x: 0, y: 1.5, z: 0 }); if (en.hp <= 0) { killEnemy(en); return; } else if (en.boss && en.hp < en.maxHp * 0.5 && en.phase === 0) bossPhase(en); }
  if (en.stagger > 0) { en.stagger -= dt; return; }
  if (en.blockT > 0) en.blockT -= dt;
  if (en.friendly && en.type.startsWith('bandit') && L.enemies.some(o => !o.friendly && o.state === 'chase' && (o.type.startsWith('bandit') || o.type === 'chief') && dist2(o.x, o.z, en.x, en.z) < 7)) { en.friendly = false; en.state = 'chase'; SFX.voice('human'); }
  if (en.friendly) { en.wander -= dt; if (en.wander <= 0) { en.wander = rand(2, 5); en.wx = rand(-0.3, 0.3); en.wz = rand(-0.3, 0.3); } moveWithCollision(en, en.wx * dt, en.wz * dt, 0.4); en.moved = Math.hypot(en.x - px0, en.z - pz0) > 0.002; return; }
  const d = dist2(P.x, P.z, en.x, en.z), t = en.t;
  let spd = t.speed; if (en.slow > 0) { en.slow -= dt; spd *= 0.5; }
  let moved = false;
  en.voiceT -= dt; if (en.voiceT <= 0 && d < 14) { en.voiceT = rand(4, 12); SFX.voice(t.voice); }
  if (en.state === 'idle') {
    if (d < t.aggro && (facingDot(en.x, en.z) > -0.3 || d < 4) && los(en.x, en.z, P.x, P.z)) { en.state = 'chase'; SFX.voice(t.voice); en.voiceT = rand(4, 10); }
    en.wander -= dt;
    if (en.wander <= 0) { en.wander = rand(1.5, 4); const a = rand(0, Math.PI * 2); en.wx = Math.cos(a) * 0.4; en.wz = Math.sin(a) * 0.4; if (dist2(en.x, en.z, en.hx, en.hz) > 6) { const dx = en.hx - en.x, dz = en.hz - en.z, l = Math.hypot(dx, dz); en.wx = dx / l * 0.5; en.wz = dz / l * 0.5; } if (Math.random() < 0.4) { en.wx = 0; en.wz = 0; } }
    if (en.wx || en.wz) { moveWithCollision(en, en.wx * spd * dt, en.wz * spd * dt, 0.4); moved = true; }
  } else {
    if (d > t.aggro * 2.2) { en.state = 'idle'; return; }
    const dx = P.x - en.x, dz = P.z - en.z, l = d || 1;
    en.cd -= dt;
    if (t.ranged) {
      en.castT -= dt;
      if (d < 5.5 && en.castT > 0.6) { const a = Math.atan2(en.z - P.z, en.x - P.x); moveWithCollision(en, Math.cos(a) * spd * 0.9 * dt, Math.sin(a) * spd * 0.9 * dt, 0.4); moved = true; } // держит дистанцию
      if (d > 4 && d < 16 && en.castT <= 0 && los(en.x, en.z, P.x, P.z)) {
        en.castT = 2.6; const m = spriteMesh(TEX.SPR.fireball, [0.7, 0.7], { y: 0, emissive: true, own: true }); m.position.set(en.x, gy(en.x, en.z) + 1.6, en.z); L.group.add(m); m.material.color.setRGB(0.6, 0.4, 1); en.mesh.hit();
        const light = takeLight(0x9040ff); const ty = P.gy + P.h + P.y - 0.3, vy = (ty - (gy(en.x, en.z) + 1.6)) / (d / 11);
        L.projectiles.push({ mesh: m, light, vx: dx / l * 11, vy, vz: dz / l * 11, life: 2.2, dmg: t.dmg, fromPlayer: false }); SFX.fire();
      }
    }
    if (t.boss === 'chief' && en.blockT <= 0 && Math.random() < dt * 0.25) en.blockT = 1.2;
    // раненые звери отходят зализать раны и снова бросаются
    if (!t.boss && en.hp < en.maxHp * 0.25 && en.fleeT === undefined && Math.random() < dt * 0.9) en.fleeT = rand(1.4, 2.6);
    if (en.fleeT > 0) { en.fleeT -= dt; const a = Math.atan2(en.z - P.z, en.x - P.x); moveWithCollision(en, Math.cos(a) * spd * 1.15 * dt, Math.sin(a) * spd * 1.15 * dt, 0.4); en.moved = true; en.mesh.windup(0); en.wind = 0; return; }
    if (en.fleeT !== undefined && en.fleeT <= 0) en.fleeT = undefined;
    // стая окружает: каждый зверь держит свой сектор вокруг игрока
    if (t.pack) { const mates = L.enemies.filter(o => o.type === en.type && !o.dead); const i = mates.indexOf(en); if (i >= 0 && mates.length > 1 && d < 9 && d > t.reach) { const want = Math.atan2(P.z - en.z, P.x - en.x) + (i - (mates.length - 1) / 2) * 0.75; en.packA = want; } }
    if (d > t.reach) {
      let ax = dx / l, az = dz / l; if (en.packA !== undefined && d > t.reach + 1.2) { const ca = Math.cos(en.packA), sa = Math.sin(en.packA); ax = ax * 0.55 + ca * 0.45; az = az * 0.55 + sa * 0.45; const ll = Math.hypot(ax, az) || 1; ax /= ll; az /= ll; }
      const sx = ax * spd * dt, sz = az * spd * dt, ox = en.x, oz = en.z; moveWithCollision(en, sx, sz, 0.4); moved = true;
      if (en.sideT > 0) { en.sideT -= dt; en.x = ox; en.z = oz; const a = Math.atan2(dz, dx) + en.side * Math.PI / 2; moveWithCollision(en, Math.cos(a) * spd * dt, Math.sin(a) * spd * dt, 0.4); }
      else if (Math.hypot(en.x - ox, en.z - oz) < Math.hypot(sx, sz) * 0.3) { en.side = en.side || (Math.random() < 0.5 ? 1 : -1); en.sideT = 0.6; en.sideN = (en.sideN || 0) + 1; if (en.sideN % 3 === 0) en.side = -en.side; const a = Math.atan2(dz, dx) + en.side * Math.PI / 2; moveWithCollision(en, Math.cos(a) * spd * dt, Math.sin(a) * spd * dt, 0.4); }
      if (los(en.x, en.z, P.x, P.z)) en.noLosT = 0; else { en.noLosT = (en.noLosT || 0) + dt; if (en.noLosT > 6) { en.state = 'idle'; en.noLosT = 0; en.sideN = 0; } }
    } else if (en.wind > 0) { // замах уже идёт — довести до удара
      en.wind -= dt; en.mesh.windup(1 - Math.max(0, en.wind) / (t.wind || 0.45));
      if (en.wind <= 0) {
        en.mesh.windup(0);
        if (dist2(P.x, P.z, en.x, en.z) < t.reach + 0.6 && los(en.x, en.z, P.x, P.z)) {
          const parried = P.block > 0 && P.blockT > G.playTime - 0.28 * (1 + perkLvl('parry')) && facingDot(en.x, en.z) > 0.2;
          if (parried) { UI.hintSeen('parry'); en.stagger = 1.1; en.cd = Math.max(en.cd, 1.2); SFX.block(); SFX.hammer(); vibrate(30); sparks(P.x + viewDir().x * 0.8, P.gy + P.h, P.z + viewDir().z * 0.8, 8); floatText(en.x, t.size[1] + 0.4, en.z, 'парирование!', '#ffd060'); skillUse('armor'); P.shake = 0.25; }
          else damagePlayer(t.dmg, en);
        }
        en.lunge = 0.18; en.mesh.hit();
        if (t.boss === 'bear') { en.stagger = 0.9; en.staggerN = Math.min(en.staggerN, 2); }
      }
    } else if (en.cd <= 0 && los(en.x, en.z, P.x, P.z)) { en.cd = t.cd + (t.wind || 0.45); en.wind = t.wind || 0.45; en.mesh.windup(0.05); SFX.voice(t.voice); }
    for (const o of L.enemies) if (o !== en) { const od = dist2(en.x, en.z, o.x, o.z); if (od < 1.1 && od > 0.001) { en.x += (en.x - o.x) / od * 0.03; en.z += (en.z - o.z) / od * 0.03; } }
  }
  en.moved = moved || Math.hypot(en.x - px0, en.z - pz0) > 0.002;
}

// ---------- Лог ----------
function log(msg, cls) {
  const el = $('log'); const d = document.createElement('div'); d.textContent = msg; if (cls) d.className = cls; el.appendChild(d);
  while (el.children.length > 4) el.removeChild(el.firstChild);
  setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 1100); }, 4500);
}

// ---------- Главный цикл ----------
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (G && L) { update(dt); if (!UI.open || UI.needFrame) { R.render(); UI.needFrame = false; } }
  UI.drawHud(dt);
}
