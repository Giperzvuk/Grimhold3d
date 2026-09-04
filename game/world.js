// ---------- Карты, данные мира и сборка геометрии (v0.2) ----------
const CS = 3; // размер клетки в мировых единицах
const hash2 = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + (s || 0) * 1442695041) ^ 0x5bd1e995; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ================= ДЕРЕВНЯ =================
const VILLAGE_MAP = [
  '####################################',
  '####################################',
  '##TTTT......TT......TTTT.....TTT.###',
  '##TT.T...TT..T....TT...T.........###',
  '##T..............,,,.........,,,,###',
  '##..............,,.,,.......,,..,,G#',
  '##....CCCCC....,,...,,.....,,....,G#',
  '##....CCCCC...,,......,,..,,......##',
  '##....CCCCC..,,........,,,,.......##',
  '##....CCDCC.,,..........,,........##',
  '##......,,,,,............,,.......##',
  '##.....,,.................,,......##',
  '##....,,....HHHH...........,,.....##',
  '##...,,.....HHHH....HHHHH..,,.....##',
  '##...,......HHHH....HHHHH..,,.....##',
  '##...,,.....HHHH....HHHHH..,,.....##',
  '##....,,,,..................,,....##',
  '##T.....,,,,,,,,,,,,,,,,,,,,,,,...##',
  '##TT.....................,,...,...##',
  '##TTT..HHHHH............,,..WWWWW.##',
  '##TT...HHHHH...........,,...WWWWW.##',
  '##T....HHHHH..........,,....WWDWW.##',
  '##.....HHHHH.........,,......,....##',
  '##T..................,,.....ww....##',
  '##TT................,,.....wwww...##',
  '##TTT..............,,......wwww...##',
  '##TTTT.....HHHH...,,........ww....##',
  '##TTTTT....HHHH...,,....T.........##',
  '##TTTTTT...HHHH..,,....TT.........##',
  '##TTTTT.........,,....TTT...T.....##',
  '##TTTT.........,,....TTTT..TT.....##',
  '##TTT.........,,....TTTTT.TTT.....##',
  '##TT.........,,.....TTTTTTTTTT....##',
  '##T..........,......TTTTTTTTTT....##',
  '####################################',
  '####################################'
];

const VILLAGE = {
  id: 'village', name: 'Гримхолд', map: VILLAGE_MAP, outdoor: true, kind: 'village', music: 'village',
  spawn: { x: 13, z: 32, yaw: 0 },
  roofs: [
    { x0: 12, z0: 12, x1: 15, z1: 15, base: 3, rise: 2.2, tex: 'roof' }, { x0: 20, z0: 13, x1: 24, z1: 15, base: 3, rise: 2.2, tex: 'roof' },
    { x0: 7, z0: 19, x1: 11, z1: 22, base: 3, rise: 2.2, tex: 'roof' }, { x0: 11, z0: 26, x1: 14, z1: 28, base: 3, rise: 2.2, tex: 'roof' },
    { x0: 28, z0: 19, x1: 32, z1: 21, base: 3, rise: 2.4, tex: 'thatch' }, { x0: 6, z0: 6, x1: 10, z1: 9, base: 5, rise: 2.6, tex: 'ceiling' }
  ],
  npcs: [
    { id: 'elder', name: 'Староста Освин', sprite: 'elder', x: 16, z: 11, size: [1.5, 2.5] },
    { id: 'smith', name: 'Кузнец Брандт', sprite: 'smith', x: 18, z: 16, size: [1.5, 2.5] },
    { id: 'healer', name: 'Знахарка Ильва', sprite: 'healer', x: 11, z: 24, size: [1.5, 2.5] },
    { id: 'guard', name: 'Стражник Оле', sprite: 'guard', x: 32, z: 6, size: [1.5, 2.5] },
    { id: 'villager1', name: 'Пастух Йорн', sprite: 'villager1', x: 24, z: 11, size: [1.5, 2.5], wander: 3 },
    { id: 'villager2', name: 'Тётушка Грета', sprite: 'villager2', x: 14, z: 17, size: [1.5, 2.5], wander: 2 }
  ],
  enemies: [
    { id: 'v_wolf1', type: 'wolf', x: 6, z: 25 }, { id: 'v_wolf2', type: 'wolf', x: 8, z: 29 }, { id: 'v_wolf3', type: 'wolf', x: 7, z: 31 },
    { id: 'v_wolf4', type: 'wolf', x: 26, z: 29 }, { id: 'v_gob1', type: 'goblin', x: 27, z: 3 }, { id: 'v_gob2', type: 'goblin', x: 25, z: 4 },
    { id: 'v_wr1', type: 'wraith', x: 6, z: 11, appear: 'endingKeep', night: true }, { id: 'v_wr2', type: 'wraith', x: 10, z: 12, appear: 'endingKeep', night: true }
  ],
  items: [
    { id: 'v_herb1', item: 'herb', x: 4, z: 23 }, { id: 'v_herb2', item: 'herb', x: 26, z: 23 }, { id: 'v_herb3', item: 'herb', x: 27, z: 3 },
    { id: 'v_herb4', item: 'herb', x: 30, z: 27 }, { id: 'v_pot1', item: 'potion_hp', x: 31, z: 12 }, { id: 'v_mush1', item: 'mushroom', x: 3, z: 17 }, { id: 'v_mush2', item: 'mushroom', x: 17, z: 33 },
    { id: 'v_herb5', item: 'herb', x: 3, z: 5 }, { id: 'v_herb6', item: 'herb', x: 33, z: 12 }, { id: 'v_herb7', item: 'herb', x: 25, z: 25 }, { id: 'v_herb8', item: 'herb', x: 5, z: 33 }, { id: 'v_mush3', item: 'mushroom', x: 25, z: 31 }
  ].map(i => (i.item === 'herb' || i.item === 'mushroom') ? Object.assign(i, { respawn: true }) : i),
  chests: [{ id: 'v_chest1', x: 33, z: 24, loot: { gold: 25, items: ['potion_hp', 'bread'] } }, { id: 'v_chest2', x: 3, z: 3, lock: 1, loot: { gold: 40, items: ['lockpick', 'gem_red'] } }],
  props: [
    { sprite: 'grave', x: 4, z: 8, size: [1, 1.2], act: 'read', title: 'Могильный камень', label: 'Прочитать надпись', text: '«Освин Старший, староста Гримхолда. Сорок лет держал перевал».\n\nНиже кто-то процарапал гвоздём: «и дочь под замком».\n\nЕщё ниже, другой рукой и явно позже: «а ещё он должен мне за телегу».' }, { sprite: 'grave', x: 4, z: 10, size: [1, 1.2], act: 'read', title: 'Могильный камень', label: 'Прочитать надпись', text: '«Торвальд и Ульф, рудокопы. Шахта взяла их».\n\nКамень стоит без могилы: тел не нашли. Формулировку «шахта взяла» придумал староста — она удобная, у неё нет подлежащего, которое можно вызвать на разговор.' }, { sprite: 'grave', x: 12, z: 6, size: [1, 1.2], act: 'read', title: 'Могильный камень', label: 'Прочитать надпись', text: '«Ворлат, священник. Хранил Печать».\n\nДата стёрта. Земля просела внутрь: могила пуста. Судя по направлению, копали изнутри, и это тот случай, когда лучше не додумывать.' },
    { sprite: 'torch', x: 8, z: 10, size: [0.5, 1], y: 2.2 },
    { sprite: 'signpost', x: 13, z: 17, size: [1.2, 1.2], act: 'sign', text: '← Часовня и крипта (не рекомендуется) · Кузница и площадь ↑ · Таверна «Пепельный лис» → · Лесные ворота ↗ (тоже не рекомендуется)\n\nВнизу приписка: «Указатель поставлен общиной. Ответственности община не несёт».' },
    { sprite: 'anvil', x: 19, z: 17, size: [1.3, 0.9], act: 'anvil', solid: true }, { sprite: 'furnace', x: 21, z: 17, size: [1.5, 1.3], act: 'furnace', solid: true, light: true }, { sprite: 'barrel', x: 20, z: 18, size: [0.9, 0.9], solid: true },
    { sprite: 'altar', x: 11, z: 9, size: [1.5, 1.2], act: 'altar', solid: true }, { sprite: 'well', x: 17, z: 13, size: [1.6, 1.4], act: 'well', solid: true },
    { sprite: 'cauldron', x: 12, z: 25, size: [1.2, 1.1], act: 'cauldron', solid: true },
    { sprite: 'barrel', x: 27, z: 22, size: [0.9, 0.9], solid: true }, { sprite: 'crate', x: 33, z: 20, size: [0.9, 0.9], solid: true }, { sprite: 'barrel', x: 33, z: 21, size: [0.9, 0.9], solid: true },
    { sprite: 'lantern', x: 29, z: 22, size: [0.5, 0.8], y: 2.0, light: true }, { sprite: 'lantern', x: 31, z: 22, size: [0.5, 0.8], y: 2.0, light: true },
    { sprite: 'lantern', x: 16, z: 16, size: [0.5, 0.8], y: 2.0, light: true }, { sprite: 'lantern', x: 12, z: 23, size: [0.5, 0.8], y: 2.0, light: true }, { sprite: 'lantern', x: 33, z: 7, size: [0.5, 0.8], y: 2.0, light: true },
    { sprite: 'fence', x: 16, z: 12, size: [3, 1.2], y: 0.6 }, { sprite: 'fence', x: 19, z: 12, size: [3, 1.2], y: 0.6 }, { sprite: 'fence', x: 16, z: 15, size: [3, 1.2], y: 0.6 },
    { sprite: 'fence', x: 25, z: 13, size: [3, 1.2], y: 0.6 }, { sprite: 'fence', x: 25, z: 15, size: [3, 1.2], y: 0.6 },
    { sprite: 'fence', x: 6, z: 20, size: [3, 1.2], y: 0.6 }, { sprite: 'fence', x: 6, z: 22, size: [3, 1.2], y: 0.6 },
    { sprite: 'stump', x: 15, z: 30, size: [1, 0.7], act: 'stump' }, { sprite: 'stump', x: 31, z: 31, size: [1, 0.7], act: 'stump' },
    { sprite: 'rock', x: 30, z: 3, size: [1.2, 0.7] }, { sprite: 'rockBig', x: 3, z: 12, size: [2, 1] }, { sprite: 'rockBig', x: 32, z: 30, size: [2, 1] },
    { sprite: 'campfire', x: 24, z: 8, size: [1.1, 1.1], act: 'campfire', light: true }
  ],
  doors: [
    { cx: 8, cz: 9, to: 'crypt', label: 'Спуститься в крипту', spawn: { x: 19, z: 2, yaw: Math.PI }, sealed: 'cryptSealed', sealedText: 'Свод осел. Под часовней — камень.' },
    { cx: 30, cz: 21, to: 'tavern', label: 'Войти в таверну «Пепельный лис»', spawn: { x: 7, z: 8, yaw: 0 } },
    { cx: 34, cz: 5, to: 'forest', label: 'Выйти на лесную тропу', spawn: { x: 2, z: 20, yaw: -Math.PI / 2 } },
    { cx: 34, cz: 6, to: 'forest', label: 'Выйти на лесную тропу', spawn: { x: 2, z: 20, yaw: -Math.PI / 2 } }
  ]
};

// ================= ТАВЕРНА =================
const TAVERN = {
  id: 'tavern', name: 'Таверна «Пепельный лис»', outdoor: false, kind: 'interior', music: 'tavern',
  map: [
    '##############',
    '#~~~~~~~~#~~~#',
    '#~~~~~~~~O~~~#',
    '#~~cccc~~#####',
    '#~~cccc~~~~~~#',
    '#~~~~~~~~~~~~#',
    '#~~~~~~~~~~~~#',
    '#~~~~~~~~~~~~#',
    '#~~~~~~~~~~~~#',
    '#~~~~~~X~~~~~#',
    '##############'
  ],
  spawn: { x: 7, z: 8, yaw: 0 },
  npcs: [
    { id: 'innkeeper', name: 'Трактирщица Марта', sprite: 'innkeeper', x: 7, z: 1, size: [1.5, 2.5] },
    { id: 'miner', name: 'Рудокоп Хальвар', sprite: 'miner', x: 2, z: 7, size: [1.5, 2.5], gone: 'minerGone' },
    { id: 'drunk', name: 'Пьяный Свен', sprite: 'villager1', x: 11, z: 6, size: [1.5, 2.5] }
  ],
  enemies: [], items: [{ id: 't_bread', item: 'bread', x: 4, z: 3 }], chests: [{ id: 't_chest1', x: 11, z: 1, lock: 1, loot: { gold: 35, items: ['lockpick', 'lockpick', 'potion_hp'] } }],
  props: [
    { sprite: 'table', x: 7, z: 2, size: [1.6, 0.9], solid: true }, { sprite: 'table', x: 4, z: 4, size: [1.6, 0.9], solid: true }, { sprite: 'table', x: 9, z: 7, size: [1.6, 0.9], solid: true },
    { sprite: 'barrel', x: 12, z: 2, size: [0.9, 0.9], solid: true }, { sprite: 'crate', x: 10, z: 2, size: [0.9, 0.9], solid: true }, { sprite: 'crate', x: 1, z: 1, size: [0.9, 0.9], solid: true },
    { sprite: 'campfire', x: 12, z: 5, size: [1.1, 1.1], act: 'campfire', light: true },
    { sprite: 'book', x: 5, z: 1, size: [0.6, 0.45], y: 0.25, act: 'read', title: 'Книга постояльцев', label: 'Полистать книгу постояльцев', text: 'Последние записи: «Эйнар, торговец — 3 ночи, уплачено». «Дровосек из долины — 1 ночь, не уплачено, ушёл до рассвета». Между строк, карандашом, рукой Марты: «Э. не вернулся. 7 дней».' },
    { sprite: 'bed', x: 11, z: 8, size: [1.8, 0.9], act: 'bed', solid: true }, { sprite: 'bed', x: 2, z: 8, size: [1.8, 0.9], act: 'bed', solid: true },
    { sprite: 'torch', x: 1, z: 4, size: [0.5, 1], y: 2.1 }, { sprite: 'torch', x: 12, z: 5, size: [0.5, 1], y: 2.1 }, { sprite: 'torch', x: 7, z: 0, size: [0.5, 1], y: 2.1 }
  ],
  doors: [{ cx: 7, cz: 9, to: 'village', floor: true, label: 'Выйти на улицу', spawn: { x: 30, z: 22, yaw: Math.PI } }]
};

// ================= ЛЕС =================
function genForest() {
  const W = 44, H = 44, g = Array.from({ length: H }, () => Array(W).fill('g'));
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    if (x < 1 || z < 1 || x >= W - 1 || z >= H - 1 || z < 4 || (z > H - 4 && x > 20)) { g[z][x] = '#'; continue; }
    const r = hash2(x, z, 7);
    if (r < 0.05) g[z][x] = 't'; else if (r < 0.24) g[z][x] = 'T'; else if (r < 0.265) g[z][x] = 'd';
  }
  const clear = (cx, cz, r, ch) => { for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (Math.hypot(x - cx, z - cz) <= r && g[z][x] !== '#') g[z][x] = ch || 'g'; };
  const path = pts => { for (let i = 0; i < pts.length - 1; i++) { let [x, z] = pts[i]; const [tx, tz] = pts[i + 1]; while (x !== tx) { g[z][x] = ','; x += Math.sign(tx - x); } while (z !== tz) { g[z][x] = ','; z += Math.sign(tz - z); } g[z][x] = ','; } };
  clear(14, 30, 2.4, 'w'); clear(36, 9, 3.6); clear(11, 35, 3); clear(32, 32, 3.2); clear(22, 6, 2.6); clear(16, 12, 1.5); clear(2, 20, 1.5);
  path([[1, 20], [8, 20], [8, 12], [22, 12], [22, 5]]); path([[22, 12], [34, 12], [36, 9]]); path([[8, 20], [8, 32], [11, 34]]); path([[22, 12], [30, 20], [30, 30]]);
  g[3][22] = 'D'; g[20][0] = 'G'; g[21][0] = 'G'; g[20][1] = ','; g[21][1] = 'g';
  return g.map(r => r.join(''));
}
const FOREST = {
  id: 'forest', name: 'Пепельный лес', map: genForest(), outdoor: true, kind: 'forest', music: 'forest',
  spawn: { x: 2, z: 20, yaw: -Math.PI / 2 },
  roofs: [],
  npcs: [{ id: 'hunter', name: 'Охотник Ансгар', sprite: 'hunter', x: 11, z: 36, size: [1.5, 2.5], gone: 'ansgarGone' }],
  enemies: [
    { id: 'f_wolf1', type: 'wolf', x: 14, z: 20 }, { id: 'f_wolf2', type: 'wolf', x: 26, z: 22 }, { id: 'f_wolf3', type: 'wolf', x: 6, z: 28 }, { id: 'f_wolf4', type: 'wolf', x: 18, z: 34 },
    { id: 'f_ban1', type: 'bandit', x: 34, z: 8, friendly: true }, { id: 'f_ban2', type: 'banditAxe', x: 38, z: 10, friendly: true }, { id: 'f_ban3', type: 'bandit', x: 36, z: 12, friendly: true }, { id: 'f_ban4', type: 'banditAxe', x: 33, z: 12, friendly: true },
    { id: 'f_chief', type: 'chief', x: 37, z: 7, name: 'Атаман Хродгар', friendly: true, talk: 'chief' },
    { id: 'f_bear', type: 'bear', x: 32, z: 31, name: 'Медведь-шатун', drop: 'bear_claw' }, { id: 'f_ansgar', type: 'hunterFoe', x: 11, z: 36, name: 'Охотник Ансгар', appear: 'ansgarFight' },
    { id: 'f_gob1', type: 'goblin', x: 24, z: 8 }, { id: 'f_gob2', type: 'goblin', x: 20, z: 8 }, { id: 'f_spider1', type: 'spider', x: 26, z: 5 }
  ],
  items: [
    { id: 'f_letter', item: 'letter', x: 16, z: 13 }, { id: 'f_herb1', item: 'herb', x: 13, z: 28 }, { id: 'f_herb2', item: 'herb', x: 16, z: 32 }, { id: 'f_herb3', item: 'herb', x: 38, z: 20 }, { id: 'f_herb4', item: 'herb', x: 6, z: 12 }, { id: 'f_herb5', item: 'herb', x: 26, z: 36 }, { id: 'f_herb6', item: 'herb', x: 40, z: 16 },
    { id: 'f_mush1', item: 'mushroom', x: 10, z: 24 }, { id: 'f_mush2', item: 'mushroom', x: 28, z: 26 }, { id: 'f_mush3', item: 'mushroom', x: 40, z: 30 }, { id: 'f_mush4', item: 'mushroom', x: 5, z: 38 }, { id: 'f_mush5', item: 'mushroom', x: 18, z: 18 }, { id: 'f_mush6', item: 'mushroom', x: 30, z: 6 },
    { id: 'f_pot1', item: 'potion_hp', x: 36, z: 10 }, { id: 'f_wood1', item: 'wood', x: 12, z: 36 }, { id: 'f_wood2', item: 'wood', x: 10, z: 36 }
  ].map(i => (i.item === 'herb' || i.item === 'mushroom') ? Object.assign(i, { respawn: true }) : i),
  chests: [{ id: 'f_chest1', x: 38, z: 8, lock: 2, loot: { gold: 90, items: ['treasure_map', 'potion_hp', 'rune_fire'] } }, { id: 'f_chest2', x: 34, z: 33, loot: { gold: 30, items: ['helmet_iron'] } }, { id: 'f_chest3', x: 9, z: 35, lock: 1, loot: { gold: 40, items: ['ledger', 'meat'] } }],
  treasure: { x: 33, z: 34 },
  props: [
    { sprite: 'corpse', x: 16, z: 12, size: [1.8, 0.5], y: 0.25 }, { sprite: 'crate', x: 15, z: 12, size: [0.9, 0.9], solid: true },
    { sprite: 'tent', x: 35, z: 7, size: [2.4, 1.4], solid: true }, { sprite: 'tent', x: 38, z: 11, size: [2.4, 1.4], solid: true }, { sprite: 'campfire', x: 36, z: 9, size: [1.1, 1.1], act: 'campfire', light: true },
    { sprite: 'barrel', x: 34, z: 10, size: [0.9, 0.9], solid: true }, { sprite: 'crate', x: 37, z: 12, size: [0.9, 0.9], solid: true },
    { sprite: 'tent', x: 10, z: 34, size: [2.4, 1.4], solid: true }, { sprite: 'campfire', x: 12, z: 35, size: [1.1, 1.1], act: 'campfire', light: true }, { sprite: 'stump', x: 13, z: 36, size: [1, 0.7], act: 'stump' },
    { sprite: 'stump', x: 9, z: 22, size: [1, 0.7], act: 'stump' }, { sprite: 'stump', x: 24, z: 16, size: [1, 0.7], act: 'stump' }, { sprite: 'stump', x: 30, z: 24, size: [1, 0.7], act: 'stump' },
    { sprite: 'bones', x: 31, z: 32, size: [1.2, 0.5], y: 0.25 }, { sprite: 'bones', x: 33, z: 31, size: [1.2, 0.5], y: 0.25 },
    { sprite: 'rockBig', x: 20, z: 6, size: [2, 1] }, { sprite: 'rockBig', x: 24, z: 6, size: [2, 1] }, { sprite: 'rock', x: 30, z: 32, size: [1.2, 0.7] },
    { sprite: 'signpost', x: 9, z: 20, size: [1.2, 1.2], act: 'sign', text: '↑ Старая шахта (пауки) · Лагерь у скал → (разбойники) · Охотничья стоянка ↓ (охотник; тоже вооружён, но с ним хотя бы можно поговорить)' },
    { sprite: 'note', x: 36, z: 6, size: [0.5, 0.5], y: 1.2, act: 'read', title: 'Бирка на палатке', label: 'Прочитать бирку', text: '«Кто тронет сундук — тому Хродгар руку отрубит. Кто найдёт карту — тот дурак: копать без лопаты». Ниже: «Свен, если это ты — иди домой».' },
    { sprite: 'torch', x: 22, z: 4, size: [0.5, 1], y: 2.2 }, { sprite: 'web', x: 25, z: 5, size: [1.2, 1.2], y: 1.3 }
  ],
  doors: [
    { cx: 0, cz: 20, to: 'village', label: 'Вернуться в Гримхолд', spawn: { x: 33, z: 5, yaw: Math.PI / 2 } },
    { cx: 0, cz: 21, to: 'village', label: 'Вернуться в Гримхолд', spawn: { x: 33, z: 5, yaw: Math.PI / 2 } },
    { cx: 22, cz: 3, to: 'mine', label: 'Войти в старую шахту', spawn: { x: 20, z: 2, yaw: Math.PI } }
  ]
};

// ================= ПОДЗЕМЕЛЬЯ (комнаты + коридоры) =================
function carveRooms(W, H, rooms, links, extras) {
  const g = Array.from({ length: H }, () => Array(W).fill('#'));
  const fill = (x0, z0, x1, z1) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) g[z][x] = '.'; };
  for (const k in rooms) fill(...rooms[k]);
  const c = k => { const r = rooms[k]; return [Math.floor((r[0] + r[2]) / 2), Math.floor((r[1] + r[3]) / 2)]; };
  for (const [a, b] of links) { const [ax, az] = c(a), [bx, bz] = c(b); for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) g[az][x] = '.'; for (let z = Math.min(az, bz); z <= Math.max(az, bz); z++) g[z][bx] = '.'; }
  for (const [x, z, ch] of extras || []) g[z][x] = ch;
  return g.map(r => r.join(''));
}
const CRYPT_ROOMS = { R0: [17, 1, 22, 5], R1: [4, 3, 11, 8], R2: [27, 4, 35, 9], R3: [14, 12, 24, 18], R4: [3, 14, 9, 20], R5: [30, 14, 37, 22], R6: [12, 24, 20, 30], R7: [26, 28, 36, 36] };
const CRYPT = {
  id: 'crypt', name: 'Крипта Гримхолда', outdoor: false, kind: 'crypt', music: 'dungeon',
  map: carveRooms(40, 40, CRYPT_ROOMS, [['R0', 'R3'], ['R3', 'R1'], ['R3', 'R2'], ['R1', 'R4'], ['R2', 'R5'], ['R3', 'R6'], ['R6', 'R7']], [[31, 27, 'L'], [19, 1, 'X']]),
  spawn: { x: 19, z: 2, yaw: Math.PI },
  npcs: [{ id: 'ghost', name: 'Призрак Элинор', sprite: 'ghost', x: 5, z: 16, size: [1.5, 2.2], float: true, gone: 'ghostGone' }],
  enemies: [
    { id: 'd_sk1', type: 'skeleton', x: 6, z: 5 }, { id: 'd_sk2', type: 'skeleton', x: 9, z: 7 },
    { id: 'd_gob1', type: 'goblin', x: 29, z: 6 }, { id: 'd_gob2', type: 'goblin', x: 33, z: 8 }, { id: 'd_gob3', type: 'goblin', x: 31, z: 5 },
    { id: 'd_sk3', type: 'skeleton', x: 16, z: 14 }, { id: 'd_gob4', type: 'goblin', x: 22, z: 17 }, { id: 'd_gh1', type: 'wraith', x: 20, z: 13 },
    { id: 'd_sk4', type: 'skeleton', x: 7, z: 19, name: 'Хранитель ключа', hp: 80, drop: 'key_rusty' },
    { id: 'd_gob5', type: 'goblin', x: 33, z: 16 }, { id: 'd_gob6', type: 'goblin', x: 35, z: 20 }, { id: 'd_wolf1', type: 'wolf', x: 32, z: 20 },
    { id: 'd_sk5', type: 'skeleton', x: 14, z: 26 }, { id: 'd_sk6', type: 'skeleton', x: 19, z: 29 }, { id: 'd_gh2', type: 'wraith', x: 16, z: 28 },
    { id: 'd_boss', type: 'lich', x: 31, z: 33, name: 'Некромант Ворлат', drop: 'key_seal' },
    { id: 'd_sk7', type: 'skeleton', x: 28, z: 30 }, { id: 'd_sk8', type: 'skeleton', x: 34, z: 30 }
  ],
  items: [
    { id: 'd_pot1', item: 'potion_hp', x: 4, z: 4 }, { id: 'd_pot2', item: 'potion_mp', x: 34, z: 5 }, { id: 'd_pot3', item: 'potion_hp', x: 15, z: 17 },
    { id: 'd_pot4', item: 'potion_hp', x: 13, z: 29 }, { id: 'd_herb1', item: 'herb', x: 36, z: 21 }, { id: 'd_mush1', item: 'mushroom', x: 3, z: 20 }, { id: 'd_mush2', item: 'mushroom', x: 12, z: 30 }
  ],
  chests: [
    { id: 'd_chest1', x: 10, z: 4, loot: { gold: 40, items: ['armor_leather'] } },
    { id: 'd_chest2', x: 34, z: 9, loot: { gold: 30, items: ['sword_iron'] } },
    { id: 'd_chest3', x: 8, z: 15, loot: { gold: 20, items: ['potion_hp', 'potion_mp'] } },
    { id: 'd_chest4', x: 36, z: 15, loot: { gold: 60, items: ['armor_chain'] } },
    { id: 'd_chest6', x: 20, z: 25, loot: { gold: 10, items: ['locket'] } },
    { id: 'd_chest5', x: 35, z: 35, loot: { gold: 150, items: ['blade_ash', 'potion_hp'] } }
  ],
  props: [
    { sprite: 'torch', x: 17, z: 1, size: [0.5, 1], y: 2.1 }, { sprite: 'torch', x: 22, z: 1, size: [0.5, 1], y: 2.1 },
    { sprite: 'barrel', x: 23, z: 17, size: [1, 1.1], act: 'well', solid: true, label: 'Напиться из бочки с дождевой водой' },
    { sprite: 'torch', x: 14, z: 12, size: [0.5, 1], y: 2.1 }, { sprite: 'torch', x: 24, z: 18, size: [0.5, 1], y: 2.1 },
    { sprite: 'torch', x: 26, z: 28, size: [0.5, 1], y: 2.1 }, { sprite: 'torch', x: 36, z: 28, size: [0.5, 1], y: 2.1 },
    { sprite: 'bones', x: 7, z: 4, size: [1.2, 0.5], y: 0.25 }, { sprite: 'bones', x: 20, z: 15, size: [1.2, 0.5], y: 0.25 }, { sprite: 'bones', x: 30, z: 31, size: [1.2, 0.5], y: 0.25 },
    { sprite: 'bones', x: 4, z: 19, size: [1.2, 0.5], y: 0.25 }, { sprite: 'grave', x: 13, z: 25, size: [1, 1.2] }, { sprite: 'grave', x: 19, z: 25, size: [1, 1.2] },
    { sprite: 'grave', x: 3, z: 15, size: [1, 1.2] }, { sprite: 'grave', x: 9, z: 14, size: [1, 1.2] }, { sprite: 'web', x: 4, z: 3, size: [1.2, 1.2], y: 1.3 }, { sprite: 'web', x: 35, z: 4, size: [1.2, 1.2], y: 1.3 },
    { sprite: 'barrel', x: 22, z: 5, size: [0.9, 0.9], solid: true }, { sprite: 'crate', x: 17, z: 5, size: [0.9, 0.9], solid: true },
    { sprite: 'note', x: 21, z: 2, size: [0.7, 0.7], y: 1.6, act: 'read', title: 'Надпись на стене', label: 'Прочитать надпись на стене', text: 'Выцарапано на камне, буквы в ладонь:\n\n«ПЕПЕЛ СПИТ. НЕ БУДИ ЕГО ИМЕНЕМ».\n\nНиже — само имя, длинное, шипящее. Староста просил не читать его вслух.', aloud: true },
    { sprite: 'book', x: 5, z: 4, size: [0.6, 0.45], y: 0.25, act: 'read', title: 'Страница дневника', label: 'Взять страницу дневника', text: '«Гримхолд стоит на выгоревшей горе. Пепел не даёт мёртвым уснуть. Печать держит не их — она держит пепел. Пока ключ в замке, гора молчит».', give: 'diary1' },
    { sprite: 'book', x: 28, z: 5, size: [0.6, 0.45], y: 0.25, act: 'read', title: 'Страница дневника', label: 'Взять страницу дневника', text: '«Освин-старший хоронил здесь тех, кого не хотел видеть на общем кладбище. Дочь — тоже. Я молчал. За это мне обещали покой. Мне соврали».', give: 'diary2' },
    { sprite: 'book', x: 13, z: 25, size: [0.6, 0.45], y: 0.25, act: 'read', title: 'Страница дневника', label: 'Взять страницу дневника', text: '«Печать не сорвана. Её сняли. Освин-младший приходил ночью с ключом отца и просил дать ему поговорить. Я дал. Теперь ключ у меня, а он боится вернуться. Спросите его, что ему сказал отец».', give: 'diary3' },
    { sprite: 'grave', x: 4, z: 17, size: [1, 1.2], act: 'read', title: 'Могила без имени', label: 'Прочитать', text: 'Камень без имени. Кто-то выцарапал ногтем: «Э.» — и сердце.' }
  ],
  doors: [{ cx: 19, cz: 1, to: 'village', label: 'Подняться на поверхность', floor: true, spawn: { x: 8, z: 10, yaw: Math.PI }, locked: null }]
};

const MINE_ROOMS = { R0: [18, 1, 22, 4], R1: [5, 4, 12, 9], R2: [28, 5, 36, 10], R3: [14, 13, 25, 19], R4: [4, 15, 10, 22], R5: [30, 15, 37, 23], R6: [12, 25, 21, 31], R7: [26, 28, 37, 37], R8: [3, 26, 8, 31] };
const MINE = {
  id: 'mine', name: 'Старая шахта', outdoor: false, kind: 'mine', music: 'dungeon',
  map: carveRooms(40, 40, MINE_ROOMS, [['R0', 'R3'], ['R3', 'R1'], ['R3', 'R2'], ['R1', 'R4'], ['R2', 'R5'], ['R3', 'R6'], ['R6', 'R7'], ['R5', 'R7'], ['R6', 'R8']], [[20, 1, 'X'], [10, 28, 'K'], [19, 30, 'X']]),
  spawn: { x: 20, z: 2, yaw: Math.PI },
  npcs: [],
  enemies: [
    { id: 'm_sp1', type: 'spider', x: 7, z: 6 }, { id: 'm_sp2', type: 'spider', x: 10, z: 8 }, { id: 'm_gob1', type: 'goblin', x: 30, z: 7 }, { id: 'm_gob2', type: 'goblin', x: 34, z: 9 },
    { id: 'm_sp3', type: 'spider', x: 16, z: 15 }, { id: 'm_sp4', type: 'spider', x: 23, z: 18 }, { id: 'm_bat1', type: 'spider', x: 6, z: 17 }, { id: 'm_sp5', type: 'spider', x: 8, z: 21 },
    { id: 'm_gob3', type: 'goblin', x: 33, z: 17 }, { id: 'm_gob4', type: 'goblin', x: 35, z: 21 }, { id: 'm_sp6', type: 'spider', x: 31, z: 22 },
    { id: 'm_sp7', type: 'spider', x: 14, z: 27 }, { id: 'm_sp8', type: 'spider', x: 19, z: 30 },
    { id: 'm_boss', type: 'spiderQueen', x: 31, z: 33, name: 'Паучья матка', drop: 'pickaxe_old' },
    { id: 'm_sp9', type: 'spider', x: 28, z: 30 }, { id: 'm_sp10', type: 'spider', x: 35, z: 31 }
  ],
  items: [
    { id: 'm_pot1', item: 'potion_hp', x: 6, z: 5 }, { id: 'm_pot2', item: 'potion_g', x: 12, z: 9 }, { id: 'm_moon1', item: 'moonflower', x: 36, z: 22, respawn: true }, { id: 'm_moon2', item: 'moonflower', x: 5, z: 21, respawn: true },
    { id: 'm_moon3', item: 'moonflower', x: 36, z: 36, respawn: true }, { id: 'm_moon4', item: 'moonflower', x: 27, z: 36, respawn: true }, { id: 'm_moon5', item: 'moonflower', x: 5, z: 29, respawn: true }, { id: 'm_mush1', item: 'mushroom', x: 15, z: 18 }, { id: 'm_mush2', item: 'mushroom', x: 20, z: 31 },
    { id: 'm_wood1', item: 'wood', x: 19, z: 4 }, { id: 'm_wood2', item: 'wood', x: 22, z: 4 }, { id: 'm_pot3', item: 'potion_hp', x: 34, z: 16 }
  ],
  chests: [
    { id: 'm_chest1', x: 11, z: 5, loot: { gold: 35, items: ['ore', 'ore', 'potion_g'] } }, { id: 'm_chest2', x: 35, z: 6, loot: { gold: 25, items: ['mace_iron'] } },
    { id: 'm_chest3', x: 9, z: 22, loot: { gold: 40, items: ['shield_wood', 'ore'] } }, { id: 'm_chest4', x: 36, z: 37, loot: { gold: 120, items: ['armor_plate', 'potion_g'] } },
    { id: 'm_chest5', x: 4, z: 27, lock: 2, loot: { gold: 60, items: ['rune_frost', 'gem_blue', 'gem_purple'] } }
  ],
  props: [
    { sprite: 'torch', x: 18, z: 1, size: [0.5, 1], y: 2.1 }, { sprite: 'torch', x: 22, z: 1, size: [0.5, 1], y: 2.1 }, { sprite: 'torch', x: 14, z: 13, size: [0.5, 1], y: 2.1 }, { sprite: 'torch', x: 25, z: 19, size: [0.5, 1], y: 2.1 },
    { sprite: 'barrel', x: 21, z: 4, size: [1, 1.1], act: 'well', solid: true, label: 'Напиться из бочки рудокопов' },
    { sprite: 'support', x: 20, z: 8, size: [2.6, 3], y: 1.5 }, { sprite: 'support', x: 13, z: 16, size: [2.6, 3], y: 1.5 }, { sprite: 'support', x: 26, z: 16, size: [2.6, 3], y: 1.5 }, { sprite: 'support', x: 16, z: 22, size: [2.6, 3], y: 1.5 },
    { sprite: 'ore', x: 5, z: 4, size: [1.1, 0.7], act: 'ore' }, { sprite: 'ore', x: 12, z: 4, size: [1.1, 0.7], act: 'ore' }, { sprite: 'ore', x: 28, z: 10, size: [1.1, 0.7], act: 'ore' }, { sprite: 'ore', x: 36, z: 5, size: [1.1, 0.7], act: 'ore' },
    { sprite: 'ore', x: 4, z: 15, size: [1.1, 0.7], act: 'ore' }, { sprite: 'ore', x: 10, z: 20, size: [1.1, 0.7], act: 'ore' }, { sprite: 'ore', x: 37, z: 15, size: [1.1, 0.7], act: 'ore' }, { sprite: 'ore', x: 30, z: 23, size: [1.1, 0.7], act: 'ore' },
    { sprite: 'ore', x: 12, z: 31, size: [1.1, 0.7], act: 'ore' }, { sprite: 'ore', x: 21, z: 25, size: [1.1, 0.7], act: 'ore' }, { sprite: 'ore', x: 26, z: 37, size: [1.1, 0.7], act: 'ore' }, { sprite: 'ore', x: 37, z: 28, size: [1.1, 0.7], act: 'ore' },
    { sprite: 'gemVein', x: 3, z: 30, size: [1.1, 0.7], act: 'gem' }, { sprite: 'gemVein', x: 7, z: 31, size: [1.1, 0.7], act: 'gem' }, { sprite: 'gemVein', x: 8, z: 26, size: [1.1, 0.7], act: 'gem' }, { sprite: 'gemVein', x: 37, z: 36, size: [1.1, 0.7], act: 'gem' }, { sprite: 'gemVein', x: 26, z: 29, size: [1.1, 0.7], act: 'gem' },
    { sprite: 'rockBig', x: 27, z: 29, size: [1.6, 1.2], act: 'read', title: 'Разобранный завал', label: 'Осмотреть завал', text: 'Камни разобраны и сложены вдоль стены. Изнутри. Тот, кто был по ту сторону, копал долго — ногти оставили борозды на крепи.' },
    { sprite: 'note', x: 30, z: 36, size: [0.5, 0.5], y: 0.4, act: 'read', title: 'Записка углём на крепи', label: 'Прочитать записку', text: '«День третий. Хальвар завалил вход. Мы слышали, как он уходил. Воды нет. Скажите Грете, что Торвальд не мучился». Ниже другой рукой: «Мучился».', give: 'note_mine' },
    { sprite: 'web', x: 5, z: 8, size: [1.4, 1.4], y: 1.4 }, { sprite: 'web', x: 24, z: 13, size: [1.4, 1.4], y: 1.4 }, { sprite: 'web', x: 13, z: 30, size: [1.4, 1.4], y: 1.4 }, { sprite: 'web', x: 27, z: 29, size: [1.4, 1.4], y: 1.4 }, { sprite: 'web', x: 36, z: 29, size: [1.4, 1.4], y: 1.4 },
    { sprite: 'bones', x: 16, z: 14, size: [1.2, 0.5], y: 0.25 }, { sprite: 'bones', x: 33, z: 35, size: [1.2, 0.5], y: 0.25 }, { sprite: 'crate', x: 21, z: 3, size: [0.9, 0.9], solid: true }, { sprite: 'barrel', x: 19, z: 3, size: [0.9, 0.9], solid: true },
    { sprite: 'campfire', x: 18, z: 4, size: [1.1, 1.1], act: 'campfire', light: true }
  ],
  doors: [{ cx: 20, cz: 1, to: 'forest', label: 'Выйти из шахты', floor: true, spawn: { x: 22, z: 5, yaw: Math.PI } }, { cx: 19, cz: 30, to: 'delve', label: 'Спуститься в заброшенную штольню', floor: true }]
};

// ================= ДОМА ДЕРЕВНИ: двери и интерьеры генерируются по прямоугольникам 'H' =================
const HOUSE_NAMES = [
  { name: 'Дом старосты', book: 'Приходская книга. Последняя запись рукой старосты: «Урожай сдан. Дочь — в порядке. Не ходить к часовне после заката»', carpet: true },
  { name: 'Дом кузнеца', book: 'Тетрадь заказов Брандта: «Оле — наконечники, 12 шт. Ансгар — топор, ждёт с весны. Ильва — котёл залатать. Староста — засов на погреб, срочно»' },
  { name: 'Дом знахарки', book: 'Травник. Между страниц засушенный лунный цветок. Пометка: «Собирать только ночью, у воды. Две головки на котёл — не больше»', carpet: true },
  { name: 'Дом пастуха', book: 'Пастушьи заметки Йорна: «Волки зашли за ограду третью ночь подряд. Считал овец — семнадцать. Было двадцать»' }
];
const HOUSES = {};
(function genHouses() {
  const map = VILLAGE_MAP, H = map.length, W = map[0].length, seen = new Set(); let n = 0;
  const setCh = (x, z, ch) => { const r = map[z].split(''); r[x] = ch; map[z] = r.join(''); };
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    if (map[z][x] !== 'H' || seen.has(x + ',' + z)) continue;
    let x1 = x, z1 = z; while (map[z][x1 + 1] === 'H') x1++; while (map[z1 + 1] && map[z1 + 1][x] === 'H') z1++;
    for (let zz = z; zz <= z1; zz++) for (let xx = x; xx <= x1; xx++) seen.add(xx + ',' + zz);
    if (n >= HOUSE_NAMES.length) continue;
    // дверь в середине нижней стены, если под ней проходимо; иначе — верхней
    const dx = Math.floor((x + x1) / 2); let dz = z1, out = { x: dx, z: z1 + 1 }, yawIn = 0, yawOut = Math.PI;
    if (!'.,:'.includes(map[z1 + 1][dx])) { dz = z; out = { x: dx, z: z - 1 }; yawIn = Math.PI; yawOut = 0; if (!'.,:'.includes(map[z - 1][dx])) continue; }
    setCh(dx, dz, 'D');
    const id = 'house' + (n + 1), spec = HOUSE_NAMES[n], w = x1 - x + 1, d = z1 - z + 1, iw = w + 2, ih = d + 2; // интерьер повторяет размер дома
    const rows = []; for (let r = 0; r < ih; r++) { let line = ''; for (let c = 0; c < iw; c++) line += (r === 0 || r === ih - 1 || c === 0 || c === iw - 1) ? '#' : (spec.carpet && r >= 2 && r <= ih - 3 && c >= 2 && c <= iw - 3) ? 'c' : '~'; rows.push(line); }
    const doorCol = dx - x + 1, exitRow = yawIn === 0 ? ih - 2 : 1; { const r = rows[exitRow].split(''); r[doorCol] = 'X'; rows[exitRow] = r.join(''); }
    const inSpawn = { x: doorCol, z: yawIn === 0 ? ih - 3 : 2, yaw: yawIn };
    const far = yawIn === 0 ? 1 : ih - 2, torchZ = Math.floor(ih / 2), mid = Math.floor(ih / 2);
    // Расстановка по свободным клеткам: мебель не встаёт на спавн, на выход и друг на друга
    const busy = new Set([inSpawn.x + ',' + inSpawn.z, doorCol + ',' + exitRow, doorCol + ',' + (yawIn === 0 ? ih - 3 : 2)]);
    const free = (cx, cz) => cx > 0 && cz > 0 && cx < iw - 1 && cz < ih - 1 && !busy.has(cx + ',' + cz);
    const put = (sprite, cands, extra) => { for (const [cx, cz] of cands) if (free(cx, cz)) { busy.add(cx + ',' + cz); return Object.assign({ sprite, x: cx, z: cz }, extra); } return null; };
    const props = [], add = pr => { if (pr) props.push(pr); return pr; };
    add(put('bed', [[1, far], [iw - 2, far], [1, mid]], { size: [1.8, 0.9], act: 'bed', solid: true }));
    const table = add(put('table', [[Math.floor(iw / 2), mid], [Math.floor(iw / 2) - 1, mid], [2, mid], [iw - 2, mid]], { size: [1.6, 0.9], solid: true }));
    if (table) props.push({ sprite: 'book', x: table.x, z: table.z, size: [0.6, 0.45], y: 0.75, ox: 0.3, act: 'read', title: spec.name, label: 'Полистать книгу', text: spec.book });
    add(put(iw > 5 ? 'barrel' : 'crate', [[iw - 2, far], [iw - 2, mid], [1, ih - 2]], { size: [0.9, 0.9], solid: true }));
    if (iw > 5) add(put('crate', [[iw - 3, far], [2, far], [iw - 2, mid + 1]], { size: [0.9, 0.9], solid: true }));
    if (n === 1) add(put('anvil', [[1, mid + 1], [1, mid], [2, ih - 2]], { size: [1.3, 0.9], act: 'anvil', solid: true }));
    if (n === 2) add(put('cauldron', [[iw - 2, mid + 1], [iw - 2, mid], [iw - 3, ih - 2]], { size: [1.2, 1.1], act: 'cauldron', solid: true }));
    const chest = put('chest', [[iw - 2, yawIn === 0 ? 2 : ih - 3], [1, mid + 1], [2, 2], [iw - 2, ih - 2]], {});
    const chestPos = chest ? { x: chest.x, z: chest.z } : { x: iw - 2, z: mid };
    props.push({ sprite: 'torch', x: 1, z: torchZ, size: [0.5, 1], y: 2.1 }, { sprite: 'torch', x: iw - 2, z: torchZ, size: [0.5, 1], y: 2.1 });
    HOUSES[id] = { id, name: spec.name, outdoor: false, kind: 'interior', music: 'village', map: rows, spawn: inSpawn, npcs: [], enemies: [],
      items: n === 2 ? [{ id: id + '_herb', item: 'herb', x: 1, z: 1 }] : [],
      chests: [{ id: id + '_chest', x: chestPos.x, z: chestPos.z, lock: 1, loot: { gold: 8 + n * 5, items: [['bread', 'pelt'], ['ingot', 'lockpick'], ['potion_hp', 'moonflower'], ['bread', 'meat']][n] } }],
      props, doors: [{ cx: doorCol, cz: exitRow, to: 'village', floor: true, label: 'Выйти на улицу', spawn: { x: out.x, z: out.z, yaw: yawOut } }] };
    VILLAGE.doors.push({ cx: dx, cz: dz, to: id, label: 'Войти: ' + spec.name.toLowerCase(), spawn: inSpawn });
    n++;
  }
})();
// ================= БОКОВЫЕ ШТОЛЬНИ: генерируются по семени, меняются раз в день =================
function makeDelve(seed) {
  const W = 34, H = 34, rnd = (i) => hash2(seed, i, 77);
  const rooms = {}, n = 6 + Math.floor(rnd(1) * 3);
  for (let i = 0; i < n; i++) {
    const w = 4 + Math.floor(rnd(i * 5 + 2) * 5), h = 4 + Math.floor(rnd(i * 5 + 3) * 5);
    const x = 2 + Math.floor(rnd(i * 5 + 4) * (W - w - 4)), z = 2 + Math.floor(rnd(i * 5 + 5) * (H - h - 4));
    rooms['R' + i] = [x, z, x + w, z + h];
  }
  const links = []; for (let i = 1; i < n; i++) links.push(['R' + (i - 1), 'R' + i]);
  if (n > 3) links.push(['R0', 'R' + (n - 2)]);
  const c = k => { const r = rooms[k]; return [Math.floor((r[0] + r[2]) / 2), Math.floor((r[1] + r[3]) / 2)]; };
  const [ex, ez] = c('R0'), [bx, bz] = c('R' + (n - 1));
  const map = carveRooms(W, H, rooms, links, [[ex, ez, 'X']]);
  const props = [], items = [], enemies = [], chests = [];
  for (let i = 0; i < n; i++) {
    const [cx, cz] = c('R' + i);
    props.push({ sprite: 'torch', x: rooms['R' + i][0], z: cz, size: [0.5, 1], y: 2.1 });
    if (i > 0 && rnd(i + 40) < 0.75) props.push({ sprite: 'support', x: cx, z: rooms['R' + i][1] + 1, size: [1.6, 2.4] });
    if (rnd(i + 60) < 0.7) props.push({ sprite: hash2(seed, i, 9) < 0.5 ? 'ore' : 'gemVein', x: cx + 1, z: cz + 1, size: [1.2, 1.1], act: hash2(seed, i, 9) < 0.5 ? 'ore' : 'gem' });
    if (rnd(i + 80) < 0.5) props.push({ sprite: 'bones', x: cx - 1, z: cz, size: [1.2, 0.5], y: 0.25 });
    if (rnd(i + 90) < 0.5) items.push({ id: 'dl_i' + i, item: hash2(seed, i, 11) < 0.5 ? 'mushroom' : 'ore', x: cx, z: cz + 1 });
    if (i > 0) { const k = rnd(i + 100); const t = k < 0.4 ? 'spider' : k < 0.7 ? 'skeleton' : k < 0.9 ? 'goblin' : 'wraith';
      enemies.push({ id: 'dl_e' + i + 'a', type: t, x: cx, z: cz }); if (rnd(i + 110) < 0.6) enemies.push({ id: 'dl_e' + i + 'b', type: t, x: cx + 1, z: cz }); }
  }
  chests.push({ id: 'dl_chest', x: bx, z: bz, lock: 1 + Math.floor(rnd(200) * 2), loot: { gold: 60 + Math.floor(rnd(201) * 90), items: [], random: true } });
  enemies.push({ id: 'dl_boss', type: rnd(202) < 0.5 ? 'spiderQueen' : 'wraith', x: bx, z: bz - 1, name: rnd(202) < 0.5 ? 'Матка глубин' : 'Страж штольни' });
  return { id: 'delve', name: 'Заброшенная штольня', outdoor: false, kind: 'mine', music: 'dungeon', map, spawn: { x: ex, z: ez + 1, yaw: 0 },
    npcs: [], enemies, items, chests, props, doors: [{ cx: ex, cz: ez, to: 'mine', floor: true, label: 'Выбраться наверх', spawn: { x: 20, z: 3, yaw: 0 } }] };
}
const WORLDS = Object.assign({ village: VILLAGE, tavern: TAVERN, forest: FOREST, crypt: CRYPT, mine: MINE, delve: makeDelve(1) }, HOUSES);
// Расчистка деревьев/воды под сущностями (для процедурных карт)
for (const id in WORLDS) {
  const w = WORLDS[id]; const rows = w.map.map(r => r.split(''));
  const fix = (x, z) => { const ch = rows[z] && rows[z][x]; if (ch === 'T' || ch === 't' || ch === 'd' || ch === 'w') rows[z][x] = w.kind === 'forest' ? 'g' : '.'; };
  w.npcs.forEach(n => fix(n.x, n.z)); w.enemies.forEach(n => fix(n.x, n.z)); w.items.forEach(n => fix(n.x, n.z)); w.chests.forEach(n => fix(n.x, n.z)); w.props.forEach(p => { if (p.act) fix(p.x, p.z); });
  w.map = rows.map(r => r.join(''));
}

// ---------- Сборка геометрии ----------
const SOLID = new Set(['#', 'H', 'C', 'W', 'D', 'G', 'L', 'K', 'O']);
const BLOCK = new Set(['#', 'H', 'C', 'W', 'D', 'G', 'L', 'K', 'O', 'w', 'T', 't', 'd']);
function cellAt(map, x, z) { if (z < 0 || z >= map.length || x < 0 || x >= map[0].length) return '#'; return map[z][x]; }

class GeoBuilder {
  constructor() { this.p = []; this.n = []; this.uv = []; }
  quad(a, b, c, d, n, us, vs, u0, v0) {
    u0 = u0 || 0; v0 = v0 || 0;
    const P = this.p, N = this.n, U = this.uv;
    P.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let i = 0; i < 6; i++) N.push(...n);
    U.push(u0, v0, u0 + us, v0, u0 + us, v0 + vs, u0, v0, u0 + us, v0 + vs, u0, v0 + vs);
  }
  build() { return { positions: this.p, normals: this.n, uvs: this.uv }; }
  get empty() { return this.p.length === 0; }
}
function wallBlock(gb, x, z, h, map, y0, solidSet) {
  y0 = y0 || 0; solidSet = solidSet || SOLID;
  const X = x * CS, Z = z * CS, X1 = X + CS, Z1 = Z + CS, Y = y0 + h, ur = 0.5, vr = h / CS * 0.5, hq = hash2(x, z, 7), ux = hq < 0.5 ? 0 : 0.5, uz = ((hq * 4) & 1) ? 0.5 : 0, v0 = ((hq * 8) & 1) ? 0.5 : 0;
  if (!solidSet.has(cellAt(map, x, z + 1))) gb.quad([X, y0, Z1], [X1, y0, Z1], [X1, Y, Z1], [X, Y, Z1], [0, 0, 1], ur, vr, ux, v0);
  if (!solidSet.has(cellAt(map, x, z - 1))) gb.quad([X1, y0, Z], [X, y0, Z], [X, Y, Z], [X1, Y, Z], [0, 0, -1], ur, vr, 0.5 - ux, v0);
  if (!solidSet.has(cellAt(map, x + 1, z))) gb.quad([X1, y0, Z1], [X1, y0, Z], [X1, Y, Z], [X1, Y, Z1], [1, 0, 0], ur, vr, 0.5 - uz, v0);
  if (!solidSet.has(cellAt(map, x - 1, z))) gb.quad([X, y0, Z], [X, y0, Z1], [X, Y, Z1], [X, Y, Z], [-1, 0, 0], ur, vr, uz, v0);
}
// Квад с подразбиением nx×ny (для «пещерной» геометрии со смещением вершин)
function subQuad(gb, a, b, c, d, n, us, vs, u0, v0, nx, ny) {
  const L = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const t0 = i / nx, t1 = (i + 1) / nx, s0 = j / ny, s1 = (j + 1) / ny; // a→b по «u», a→d по «v»
    const p = (t, sv) => L(L(a, b, t), L(d, c, t), sv);
    gb.quad(p(t0, s0), p(t1, s0), p(t1, s1), p(t0, s1), n, us / nx, vs / ny, (u0 || 0) + us * t0, (v0 || 0) + vs * s0);
  }
}
function wallBlockSub(gb, x, z, h, map, y0, nx, ny) {
  y0 = y0 || 0; const X = x * CS, Z = z * CS, X1 = X + CS, Z1 = Z + CS, Y = y0 + h, ur = 0.5, vr = h / CS * 0.5, hq = hash2(x, z, 7), ux = hq < 0.5 ? 0 : 0.5, uz = ((hq * 4) & 1) ? 0.5 : 0, v0 = ((hq * 8) & 1) ? 0.5 : 0;
  if (!SOLID.has(cellAt(map, x, z + 1))) subQuad(gb, [X, y0, Z1], [X1, y0, Z1], [X1, Y, Z1], [X, Y, Z1], [0, 0, 1], ur, vr, ux, v0, nx, ny);
  if (!SOLID.has(cellAt(map, x, z - 1))) subQuad(gb, [X1, y0, Z], [X, y0, Z], [X, Y, Z], [X1, Y, Z], [0, 0, -1], ur, vr, 0.5 - ux, v0, nx, ny);
  if (!SOLID.has(cellAt(map, x + 1, z))) subQuad(gb, [X1, y0, Z1], [X1, y0, Z], [X1, Y, Z], [X1, Y, Z1], [1, 0, 0], ur, vr, 0.5 - uz, v0, nx, ny);
  if (!SOLID.has(cellAt(map, x - 1, z))) subQuad(gb, [X, y0, Z], [X, y0, Z1], [X, Y, Z1], [X, Y, Z], [-1, 0, 0], ur, vr, uz, v0, nx, ny);
}
function floorCellSub(gb, x, z, y, n) { const X = x * CS, Z = z * CS, hq = hash2(x, z, 11); subQuad(gb, [X, y, Z], [X, y, Z + CS], [X + CS, y, Z + CS], [X + CS, y, Z], [0, 1, 0], 0.5, 0.5, hq < 0.5 ? 0 : 0.5, ((hq * 4) & 1) ? 0.5 : 0, n, n); }
function ceilCellSub(gb, x, z, y, n) { const X = x * CS, Z = z * CS, hq = hash2(x, z, 13); subQuad(gb, [X, y, Z], [X + CS, y, Z], [X + CS, y, Z + CS], [X, y, Z + CS], [0, -1, 0], 0.5, 0.5, hq < 0.5 ? 0 : 0.5, ((hq * 4) & 1) ? 0.5 : 0, n, n); }
// 3D value-noise и смещение вершин как функция позиции: общие вершины соседних граней смещаются одинаково — щелей нет
const hash3 = (x, y, z, s) => hash2(x * 7 + 3, y * 13 + z * 31 + 5, s);
function vnoise3(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = x - xi, fy = y - yi, fz = z - zi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, s);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(c(0, 0, 0), c(1, 0, 0), sx), l(c(0, 1, 0), c(1, 1, 0), sx), sy), l(l(c(0, 0, 1), c(1, 0, 1), sx), l(c(0, 1, 1), c(1, 1, 1), sx), sy), sz);
}
function displaceGeo(geo, ampXZ, ampY0, ampY1, H, seed) {
  const P = geo.positions, N = geo.normals, f = 0.55; seed = seed || 0;
  for (let i = 0; i < P.length; i += 3) {
    const x = Math.round(P[i] * 256) / 256, y = Math.round(P[i + 1] * 256) / 256, z = Math.round(P[i + 2] * 256) / 256;
    const ay = ampY0 + (ampY1 - ampY0) * Math.max(0, Math.min(1, y / H));
    P[i] = x + (vnoise3(x * f, y * f, z * f, seed + 1) - 0.5) * 2 * ampXZ; P[i + 1] = y + (vnoise3(x * f + 9, y * f, z * f + 4, seed + 2) - 0.5) * 2 * ay; P[i + 2] = z + (vnoise3(x * f + 3, y * f + 7, z * f, seed + 3) - 0.5) * 2 * ampXZ;
  }
  for (let i = 0; i < P.length; i += 9) { // плоские нормали на треугольник
    const ax = P[i + 3] - P[i], ay = P[i + 4] - P[i + 1], az = P[i + 5] - P[i + 2], bx = P[i + 6] - P[i], by = P[i + 7] - P[i + 1], bz = P[i + 8] - P[i + 2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    if (nx * N[i] + ny * N[i + 1] + nz * N[i + 2] < 0) { nx = -nx; ny = -ny; nz = -nz; } // ориентируем по исходной нормали
    for (let k = 0; k < 9; k += 3) { N[i + k] = nx; N[i + k + 1] = ny; N[i + k + 2] = nz; }
  }
  return geo;
}
function floorCell(gb, x, z, y) { const X = x * CS, Z = z * CS, hq = hash2(x, z, 11); gb.quad([X, y, Z], [X, y, Z + CS], [X + CS, y, Z + CS], [X + CS, y, Z], [0, 1, 0], 0.5, 0.5, hq < 0.5 ? 0 : 0.5, ((hq * 4) & 1) ? 0.5 : 0); }
// Клетка пола по рельефу: S×S квадов с высотами из Terrain, нормаль по наклону (плоская на квад — низкополигональный вид)
function terrainCell(gb, x, z, yOff) {
  const S = Terrain.S, ds = CS / S, hq = hash2(x, z, 11), U0 = hq < 0.5 ? 0 : 0.5, V0 = ((hq * 4) & 1) ? 0.5 : 0, yo = yOff || 0;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const X = x * CS + i * ds, Z = z * CS + j * ds, si = x * S + i, sj = z * S + j;
    const h00 = Terrain.sample(si, sj) + yo, h01 = Terrain.sample(si, sj + 1) + yo, h11 = Terrain.sample(si + 1, sj + 1) + yo, h10 = Terrain.sample(si + 1, sj) + yo;
    const dhx = ((h10 + h11) - (h00 + h01)) / 2 / ds, dhz = ((h01 + h11) - (h00 + h10)) / 2 / ds, nl = Math.hypot(dhx, 1, dhz);
    gb.quad([X, h00, Z], [X, h01, Z + ds], [X + ds, h11, Z + ds], [X + ds, h10, Z], [-dhx / nl, 1 / nl, -dhz / nl], 0.5 / S, 0.5 / S, U0 + i * 0.5 / S, V0 + j * 0.5 / S);
  }
}
function ceilCell(gb, x, z, y) { const X = x * CS, Z = z * CS, hq = hash2(x, z, 13); gb.quad([X, y, Z], [X + CS, y, Z], [X + CS, y, Z + CS], [X, y, Z + CS], [0, -1, 0], 0.5, 0.5, hq < 0.5 ? 0 : 0.5, ((hq * 4) & 1) ? 0.5 : 0); }
function roofGeo(x0, z0, x1, z1, yBase, rise, overhang) {
  const gb = new GeoBuilder();
  const X0 = x0 * CS - overhang, X1 = (x1 + 1) * CS + overhang, Z0 = z0 * CS - overhang, Z1 = (z1 + 1) * CS + overhang;
  const alongX = (X1 - X0) >= (Z1 - Z0), top = yBase + rise;
  if (alongX) {
    const zm = (Z0 + Z1) / 2;
    gb.quad([X0, yBase, Z1], [X1, yBase, Z1], [X1, top, zm], [X0, top, zm], [0, 0.7, 0.7], (X1 - X0) / CS, 1.2);
    gb.quad([X1, yBase, Z0], [X0, yBase, Z0], [X0, top, zm], [X1, top, zm], [0, 0.7, -0.7], (X1 - X0) / CS, 1.2);
    gb.quad([X0, yBase, Z0], [X0, yBase, Z1], [X0, top, zm], [X0, top, zm], [-1, 0, 0], 1, 1);
    gb.quad([X1, yBase, Z1], [X1, yBase, Z0], [X1, top, zm], [X1, top, zm], [1, 0, 0], 1, 1);
  } else {
    const xm = (X0 + X1) / 2;
    gb.quad([X1, yBase, Z1], [X1, yBase, Z0], [xm, top, Z0], [xm, top, Z1], [0.7, 0.7, 0], (Z1 - Z0) / CS, 1.2);
    gb.quad([X0, yBase, Z0], [X0, yBase, Z1], [xm, top, Z1], [xm, top, Z0], [-0.7, 0.7, 0], (Z1 - Z0) / CS, 1.2);
    gb.quad([X1, yBase, Z0], [X0, yBase, Z0], [xm, top, Z0], [xm, top, Z0], [0, 0, -1], 1, 1);
    gb.quad([X0, yBase, Z1], [X1, yBase, Z1], [xm, top, Z1], [xm, top, Z1], [0, 0, 1], 1, 1);
  }
  return gb.build();
}

const KIND = {
  village: { wall: 'rock', wallH: 7, floor: 'grass', path: 'dirt', ceil: null, h: 3 },
  forest: { wall: 'rock', wallH: 7, floor: 'grassDark', path: 'dirt', ceil: null, h: 3 },
  interior: { wall: 'logs', wallH: 3, floor: 'boards', path: 'boards', ceil: 'planks', h: 3 },
  crypt: { wall: 'crypt', wallH: 3, floor: 'flag', path: 'flag', ceil: 'ceiling', h: 3 },
  mine: { wall: 'mine', wallH: 3.5, floor: 'gravel', path: 'gravel', ceil: 'rock', h: 3.5 }
};

// buildLevel — см. render.js (Babylon)

// Декор: трава, цветы, камни — детерминированно по хэшу
function decorFor(def) {
  const out = [], map = def.map;
  if (!def.outdoor) return out;
  for (let z = 1; z < map.length - 1; z++) for (let x = 1; x < map[0].length - 1; x++) {
    const ch = map[z][x]; if (ch !== '.' && ch !== 'g') continue;
    const r = hash2(x, z, 21);
    const nearWater = cellAt(map, x - 1, z) === 'w' || cellAt(map, x + 1, z) === 'w' || cellAt(map, x, z - 1) === 'w' || cellAt(map, x, z + 1) === 'w';
    if (nearWater && r < 0.55) { out.push({ sprite: 'reed', x, z, size: [0.7, 1.1], y: 0.5, ox: hash2(x, z, 22) - 0.5, oz: hash2(x, z, 23) - 0.5 }); continue; }
    if (r < 0.34) out.push({ sprite: 'grassTuft', x, z, size: [0.7, 0.45], y: 0.22, ox: hash2(x, z, 22) - 0.5, oz: hash2(x, z, 23) - 0.5 });
    else if (r < 0.40) out.push({ sprite: hash2(x, z, 24) < 0.5 ? 'flower' : 'flowerB', x, z, size: [0.5, 0.5], y: 0.25, ox: hash2(x, z, 22) - 0.5, oz: hash2(x, z, 23) - 0.5 });
    else if (r < 0.46 && def.kind === 'forest') out.push({ sprite: 'fern', x, z, size: [1, 0.7], y: 0.3, ox: hash2(x, z, 22) - 0.5, oz: hash2(x, z, 23) - 0.5 });
    else if (r < 0.485) out.push({ sprite: 'bush', x, z, size: [1.3, 0.8], y: 0.4, ox: hash2(x, z, 22) - 0.5, oz: hash2(x, z, 23) - 0.5 });
    else if (r < 0.50 && def.kind === 'forest') out.push({ sprite: 'log', x, z, size: [1.8, 0.5], y: 0.2, ox: hash2(x, z, 22) - 0.5, oz: hash2(x, z, 23) - 0.5 });
    else if (r < 0.515 && (cellAt(map, x - 1, z) === '#' || cellAt(map, x + 1, z) === '#' || cellAt(map, x, z - 1) === '#')) out.push({ sprite: 'rock', x, z, size: [1.2, 0.7], y: 0.35 });
    else if (r > 0.93 && Terrain.active) { // валуны на крутых склонах и у подножия скал
      const slope = Math.abs(Terrain.base(x + 1, z) - Terrain.base(x - 1, z)) + Math.abs(Terrain.base(x, z + 1) - Terrain.base(x, z - 1));
      if (slope > 1.6) out.push({ sprite: hash2(x, z, 25) < 0.4 ? 'rockBig' : 'rock', x, z, size: [1.2, 0.7], y: 0.35, ox: hash2(x, z, 22) - 0.5, oz: hash2(x, z, 23) - 0.5 });
    }
  }
  return out;
}
