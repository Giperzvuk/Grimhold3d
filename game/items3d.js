// ---------- Низкополигональные модели предметов и декора (вершинные цвета, один материал → инстансы) ----------
'use strict';
const Items3D = (() => {
  let scene = null, matte = null, glow = null, leaf = null; const cache = {};
  const WINDY = new Set(['grassTuft', 'flower', 'flowerB', 'bush', 'fern', 'reed']); // качается на ветру
  const V = BABYLON.Vector3, MB = BABYLON.MeshBuilder;
  const hash = (x, y, s) => { let h2 = (x * 374761393 + y * 668265263 + (s || 0) * 1442695041) ^ 0x5bd1e995; h2 = (h2 ^ (h2 >>> 13)) * 1274126177; return ((h2 ^ (h2 >>> 16)) >>> 0) / 4294967296; };
  const hex = h => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  function mats() {
    if (matte) return; matte = new BABYLON.StandardMaterial('item_matte', scene); matte.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05); matte.maxSimultaneousLights = 12; matte.backFaceCulling = false;
    glow = new BABYLON.StandardMaterial('item_glow', scene); glow.specularColor = BABYLON.Color3.Black(); glow.emissiveColor = new BABYLON.Color3(0.55, 0.55, 0.55); glow.linkEmissiveWithDiffuse = true; glow.maxSimultaneousLights = 12; glow.backFaceCulling = false;
    leaf = new BABYLON.StandardMaterial('item_leaf', scene); leaf.specularColor = BABYLON.Color3.Black(); leaf.maxSimultaneousLights = 12; leaf.backFaceCulling = false;
    if (leaf.psx) { leaf.psx.wind = 0.035; leaf.markAsDirty(BABYLON.Material.MiscDirtyFlag); }
  }
  // окрасить меш вершинным цветом (лёгкое затемнение нижних граней — объём даже без света)
  function paint(m, col, shade) {
    const [r, g, b] = hex(col); const n = m.getTotalVertices(), nr = m.getVerticesData(BABYLON.VertexBuffer.NormalKind), cols = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { const k = shade === false ? 1 : 0.82 + 0.18 * Math.max(0, nr ? nr[i * 3 + 1] : 1) + 0.06 * (nr ? nr[i * 3] : 0); cols[i * 4] = r * k; cols[i * 4 + 1] = g * k; cols[i * 4 + 2] = b * k; cols[i * 4 + 3] = 1; }
    m.setVerticesData(BABYLON.VertexBuffer.ColorKind, cols); return m;
  }
  // Примитивы: все принимают {x,y,z, rx,ry,rz, glow}
  const place = (m, o) => { m.position.set(o.x || 0, o.y || 0, o.z || 0); m.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0); m.material = o.glow ? glow : matte; m.isPickable = false; return m; };
  const box = (w, h, d, col, o) => { o = o || {}; const m = MB.CreateBox('b', { width: w, height: h, depth: d }, scene); paint(m, col); return place(m, o); };
  const cyl = (dTop, dBot, h, col, o, tess) => { o = o || {}; const m = MB.CreateCylinder('c', { diameterTop: dTop, diameterBottom: dBot, height: h, tessellation: tess || 6 }, scene); paint(m, col); return place(m, o); };
  const sph = (d, col, o, seg, sx, sy, sz) => { o = o || {}; const m = MB.CreateSphere('s', { diameter: d, segments: seg || 3 }, scene); if (sx) m.scaling.set(sx, sy, sz); paint(m, col); return place(m, o); };
  const tor = (d, t, col, o) => { o = o || {}; const m = MB.CreateTorus('t', { diameter: d, thickness: t, tessellation: 8 }, scene); paint(m, col); return place(m, o); };
  const cone = (d, h, col, o) => cyl(0, d, h, col, o, 4);
  // ---- сборщики предметов: возвращают массив мешей (локальные координаты, центр ~ (0,0.2,0)) ----
  const STEEL = '#b8bcc4', DARK = '#3a3430', WOOD = '#6b4a2a', GOLD = '#e0b040', LEATHER = '#7a5030', IRON = '#6a6a70';
  const B = {};
  const blade = (len, w, col) => [box(w, len, 0.02, col || STEEL, { y: len / 2 + 0.16 }), box(w * 0.35, len * 0.9, 0.028, '#e8ecf0', { y: len / 2 + 0.16 })];
  const hilt = (col) => [box(0.24, 0.045, 0.05, col || '#8a7030', { y: 0.16 }), cyl(0.05, 0.055, 0.16, LEATHER, { y: 0.07 }), sph(0.07, col || '#8a7030', { y: -0.02 }, 2)];
  B.sword = () => [...blade(0.62, 0.07), ...hilt()];
  B.dagger = () => [...blade(0.34, 0.06), ...hilt(DARK)];
  B.spear = () => [cyl(0.04, 0.045, 1.2, WOOD, { y: 0.5 }), cone(0.09, 0.22, STEEL, { y: 1.2 }), box(0.14, 0.03, 0.03, DARK, { y: 1.08 })];
  B.axe = () => [cyl(0.05, 0.055, 0.8, WOOD, { y: 0.35 }), box(0.06, 0.26, 0.08, IRON, { y: 0.62, x: 0.03 }), box(0.22, 0.3, 0.035, STEEL, { y: 0.62, x: 0.15 }), box(0.06, 0.32, 0.04, '#e8ecf0', { y: 0.62, x: 0.25 })];
  B.mace = () => [cyl(0.045, 0.05, 0.6, WOOD, { y: 0.25 }), sph(0.22, IRON, { y: 0.6 }, 2), ...[0, 1, 2, 3].map(i => box(0.06, 0.06, 0.06, STEEL, { y: 0.6, x: Math.cos(i * 1.57) * 0.13, z: Math.sin(i * 1.57) * 0.13 })), box(0.06, 0.06, 0.06, STEEL, { y: 0.73 })];
  B.pick = () => [cyl(0.045, 0.05, 0.8, WOOD, { y: 0.35 }), box(0.5, 0.06, 0.06, IRON, { y: 0.7 }), cone(0.06, 0.14, STEEL, { y: 0.7, x: 0.3, rz: -1.57 }), cone(0.06, 0.14, STEEL, { y: 0.7, x: -0.3, rz: 1.57 })];
  B.shovel = () => [cyl(0.04, 0.045, 0.8, WOOD, { y: 0.4 }), box(0.22, 0.28, 0.03, IRON, { y: -0.08 }), box(0.14, 0.05, 0.06, WOOD, { y: 0.8 })];
  B.shield = () => [cyl(0.62, 0.62, 0.04, IRON, { y: 0.3, rx: 1.57 }, 8), tor(0.6, 0.05, DARK, { y: 0.3, rx: 1.57 }), sph(0.14, STEEL, { y: 0.3, z: -0.04 }, 2)];
  B.shieldWood = () => [cyl(0.62, 0.62, 0.05, WOOD, { y: 0.3, rx: 1.57 }, 8), box(0.62, 0.04, 0.06, IRON, { y: 0.3 }), box(0.04, 0.62, 0.06, IRON, { y: 0.3 }), sph(0.12, IRON, { y: 0.3, z: -0.04 }, 2)];
  B.helmet = () => [sph(0.4, STEEL, { y: 0.2 }, 3, 1, 0.8, 1), box(0.06, 0.2, 0.04, STEEL, { y: 0.1, z: 0.19 }), box(0.42, 0.04, 0.42, DARK, { y: 0.05 })];
  B.armor = () => [box(0.42, 0.44, 0.24, STEEL, { y: 0.24 }), box(0.14, 0.12, 0.26, IRON, { y: 0.42, x: -0.26 }), box(0.14, 0.12, 0.26, IRON, { y: 0.42, x: 0.26 }), box(0.2, 0.3, 0.26, '#d0d4da', { y: 0.24 })];
  B.armorL = () => [box(0.4, 0.42, 0.22, LEATHER, { y: 0.23 }), box(0.42, 0.06, 0.24, DARK, { y: 0.3 }), box(0.14, 0.1, 0.24, '#5a3820', { y: 0.4, x: -0.24 }), box(0.14, 0.1, 0.24, '#5a3820', { y: 0.4, x: 0.24 })];
  B.furCoat = () => [box(0.44, 0.5, 0.26, '#6a4a30', { y: 0.27 }), box(0.48, 0.12, 0.3, '#a08060', { y: 0.5 }), box(0.14, 0.34, 0.14, '#6a4a30', { y: 0.22, x: -0.29 }), box(0.14, 0.34, 0.14, '#6a4a30', { y: 0.22, x: 0.29 })];
  B.cloak = () => [box(0.4, 0.62, 0.05, '#2a3a5a', { y: 0.31, rx: 0.15 }), box(0.44, 0.1, 0.07, '#3a4a6a', { y: 0.6 }), sph(0.08, GOLD, { y: 0.6, z: 0.05 }, 2)];
  B.amulet = () => [tor(0.36, 0.025, GOLD, { y: 0.3, rx: 1.57 }), cone(0.14, 0.16, '#40a0e0', { y: 0.1, rx: 3.14, glow: true }), sph(0.06, GOLD, { y: 0.18 }, 2)];
  B.locket = () => [tor(0.36, 0.025, GOLD, { y: 0.3, rx: 1.57 }), cyl(0.16, 0.16, 0.04, GOLD, { y: 0.1, rx: 1.57 }, 8), sph(0.05, '#e04060', { y: 0.1, z: -0.03 }, 2)];
  B.ring = () => [tor(0.22, 0.05, GOLD, { y: 0.2, rx: 1.57 }), sph(0.07, '#e04060', { y: 0.31 }, 2, 1, 1, 1)];
  B.bread = () => [sph(0.36, '#c89a50', { y: 0.12 }, 3, 1.3, 0.6, 0.8), box(0.3, 0.02, 0.06, '#e8c890', { y: 0.23, ry: 0.4 })];
  B.meat = () => [sph(0.3, '#b04040', { y: 0.14 }, 3, 1.3, 0.8, 1), cyl(0.05, 0.05, 0.4, '#f0e8d8', { y: 0.12, rz: 1.57 }), sph(0.09, '#f0e8d8', { y: 0.12, x: 0.22 }, 2), sph(0.09, '#f0e8d8', { y: 0.12, x: -0.22 }, 2)];
  B.meatCooked = () => [sph(0.3, '#7a4020', { y: 0.14 }, 3, 1.3, 0.8, 1), cyl(0.05, 0.05, 0.4, '#e0d8c8', { y: 0.12, rz: 1.57 }), sph(0.09, '#e0d8c8', { y: 0.12, x: 0.22 }, 2), sph(0.09, '#e0d8c8', { y: 0.12, x: -0.22 }, 2)];
  B.herb = () => [cyl(0.02, 0.025, 0.36, '#3a7a2a', { y: 0.18 }), ...[0, 1, 2, 3, 4].map(i => box(0.09, 0.22, 0.015, i % 2 ? '#5aa040' : '#4a9030', { y: 0.2 + i * 0.05, ry: i * 1.25, rz: 0.9, x: Math.cos(i * 1.25) * 0.08, z: -Math.sin(i * 1.25) * 0.08 }))];
  B.mushroom = () => [cyl(0.08, 0.1, 0.24, '#e8dcc0', { y: 0.12 }), sph(0.32, '#c04030', { y: 0.26 }, 3, 1, 0.55, 1), ...[0, 1, 2].map(i => box(0.05, 0.03, 0.05, '#f0e8e0', { y: 0.34, x: Math.cos(i * 2.1) * 0.1, z: Math.sin(i * 2.1) * 0.1 }))];
  B.moonflower = () => [cyl(0.03, 0.035, 0.4, '#4a7a4a', { y: 0.2 }), ...[0, 1, 2, 3].map(i => box(0.14, 0.05, 0.08, '#c8e0ff', { y: 0.42, ry: i * 0.785, x: Math.cos(i * 0.785) * 0.07, z: -Math.sin(i * 0.785) * 0.07, glow: true })), sph(0.1, '#8090ff', { y: 0.44, glow: true }, 2)];
  const potion = col => () => [cyl(0.2, 0.22, 0.22, col, { y: 0.11, glow: true }, 8), cyl(0.08, 0.1, 0.12, '#a8c0c8', { y: 0.27 }, 6), box(0.09, 0.05, 0.09, '#8a6a40', { y: 0.35 })];
  B.potion = potion('#d83a3a'); B.potionB = potion('#3a6ad8'); B.potionG = potion('#4ab050');
  B.flask = () => [cyl(0.24, 0.26, 0.3, '#8a5a30', { y: 0.15 }, 8), cyl(0.07, 0.08, 0.08, '#4a3020', { y: 0.34 }), tor(0.3, 0.02, DARK, { y: 0.2, rx: 1.57 })];
  B.bandage = () => [cyl(0.2, 0.2, 0.14, '#e8e4d8', { y: 0.1, rz: 1.57 }, 8), box(0.18, 0.02, 0.22, '#e8e4d8', { y: 0.11, x: 0.1, rz: 0.4 })];
  B.wood = () => [cyl(0.14, 0.14, 0.6, WOOD, { y: 0.07, rz: 1.57 }, 6), cyl(0.14, 0.14, 0.6, '#7a5a30', { y: 0.07, z: 0.15, rz: 1.57 }, 6), cyl(0.14, 0.14, 0.6, WOOD, { y: 0.19, z: 0.07, rz: 1.57 }, 6)];
  B.ingot = () => [box(0.36, 0.12, 0.18, '#c0c4cc', { y: 0.06 }), box(0.3, 0.02, 0.14, '#e0e4ea', { y: 0.13 })];
  B.oreItem = () => [sph(0.34, '#6a6058', { y: 0.16 }, 2, 1.2, 0.8, 1), box(0.08, 0.08, 0.08, '#c8a040', { y: 0.22, x: 0.1, ry: 0.5 }), box(0.06, 0.06, 0.06, '#c8a040', { y: 0.16, x: -0.12, z: 0.08 })];
  const gem = col => () => [cone(0.2, 0.18, col, { y: 0.29, glow: true }), cone(0.2, 0.18, col, { y: 0.11, rx: 3.14, glow: true })];
  B.gemRed = gem('#e03050'); B.gemBlue = gem('#4090ff'); B.gemPurple = gem('#a050e0');
  const rune = col => () => [box(0.32, 0.08, 0.32, '#5a5a60', { y: 0.04, ry: 0.4 }), box(0.16, 0.02, 0.04, col, { y: 0.09, ry: 0.4, glow: true }), box(0.04, 0.02, 0.16, col, { y: 0.09, ry: 0.4, glow: true }), box(0.12, 0.02, 0.03, col, { y: 0.09, ry: 1.2, x: 0.05, glow: true })];
  B.runeFire = rune('#ff7030'); B.runeFrost = rune('#70c0ff'); B.runeLife = rune('#70e080'); B.runeAsh = rune('#e0b060');
  B.key = () => [tor(0.16, 0.035, GOLD, { y: 0.3, rx: 1.57 }), box(0.04, 0.34, 0.04, GOLD, { y: 0.1 }), box(0.1, 0.04, 0.04, GOLD, { y: -0.02, x: 0.05 }), box(0.07, 0.04, 0.04, GOLD, { y: 0.05, x: 0.04 })];
  B.lockpick = () => [box(0.03, 0.34, 0.03, STEEL, { y: 0.17, rz: 0.2 }), box(0.08, 0.03, 0.03, STEEL, { y: 0.34, x: 0.03 }), box(0.03, 0.2, 0.03, STEEL, { y: 0.1, x: -0.08, rz: -0.3 })];
  B.book = () => [box(0.3, 0.08, 0.24, '#6a2a2a', { y: 0.04 }), box(0.27, 0.06, 0.21, '#e8dcc0', { y: 0.04, x: 0.02 }), box(0.03, 0.09, 0.25, '#4a1a1a', { y: 0.04, x: -0.15 })];
  const paper = (col, seal) => () => { const a = [box(0.3, 0.012, 0.22, col, { y: 0.02, ry: 0.3 })]; if (seal) a.push(cyl(0.07, 0.07, 0.02, '#c02020', { y: 0.035, x: 0.05 }, 8)); return a; };
  B.note = paper('#e8e0c8'); B.letter = paper('#e8e0c8', true); B.treasureMap = () => [cyl(0.1, 0.1, 0.3, '#d8c8a0', { y: 0.05, rz: 1.57 }, 8), tor(0.1, 0.015, '#8a2020', { y: 0.05, rz: 1.57 })];
  B.pelt = () => [box(0.44, 0.03, 0.34, '#6a4a2a', { y: 0.015 }), box(0.3, 0.02, 0.22, '#8a6a4a', { y: 0.035 })];
  B.cauldron = () => [cyl(0.34, 0.26, 0.24, '#3a3a40', { y: 0.12 }, 8), tor(0.32, 0.03, '#2a2a30', { y: 0.24, rx: 1.57 }), cyl(0.3, 0.3, 0.02, '#4a9a4a', { y: 0.22, glow: true }, 8)];
  B.gold = () => [cyl(0.2, 0.2, 0.05, GOLD, { y: 0.025 }, 8), cyl(0.2, 0.2, 0.05, '#f0c850', { y: 0.075, x: 0.05, z: 0.02 }, 8), cyl(0.2, 0.2, 0.05, GOLD, { y: 0.125, x: -0.03 }, 8), cyl(0.2, 0.2, 0.05, '#f0c850', { y: 0.03, x: 0.2, z: 0.16 }, 8)];
  B.generic = () => [box(0.3, 0.3, 0.3, '#8a6a40', { y: 0.15 }), box(0.32, 0.04, 0.32, DARK, { y: 0.15 })];
  // ---- декор ----
  B.grassTuft = () => { const a = []; for (let i = 0; i < 6; i++) { const an = i * 1.05 + 0.3, r = 0.08; a.push(box(0.06, 0.42 + (i % 3) * 0.08, 0.012, i % 2 ? '#4a9030' : '#5aa838', { y: 0.2, x: Math.cos(an) * r, z: Math.sin(an) * r, ry: an, rz: 0.35 * (i % 2 ? 1 : -1), rx: 0.2 })); } return a; };
  const flower = (col) => () => [cyl(0.02, 0.025, 0.36, '#4a8a3a', { y: 0.18 }), ...[0, 1, 2, 3].map(i => box(0.11, 0.03, 0.07, col, { y: 0.37, ry: i * 0.785, x: Math.cos(i * 0.785) * 0.06, z: -Math.sin(i * 0.785) * 0.06 })), sph(0.07, '#f0d040', { y: 0.38 }, 2), box(0.1, 0.02, 0.05, '#4a8a3a', { y: 0.16, x: 0.06, rz: 0.5 })];
  B.flower = flower('#e04060'); B.flowerB = flower('#f0f0f0');
  B.fern = () => { const a = []; for (let i = 0; i < 7; i++) { const an = i / 7 * 6.28, r = 0.1; a.push(box(0.05, 0.5, 0.05, '#3a7a34', { y: 0.25, x: Math.cos(an) * r, z: Math.sin(an) * r, rz: Math.cos(an) * 0.6, rx: Math.sin(an) * 0.6 }));
    for (let k = 0; k < 3; k++) a.push(box(0.34, 0.03, 0.1, k % 2 ? '#4a8a3a' : '#3a7030', { y: 0.28 + k * 0.13, ry: an, x: Math.cos(an) * (r + 0.12 + k * 0.05), z: Math.sin(an) * (r + 0.12 + k * 0.05), rz: Math.cos(an) * 0.5 })); } return a; };
  B.reed = () => { const a = []; for (let i = 0; i < 9; i++) { const an = hash(i, 3) * 6.28, r = hash(i, 5) * 0.22, h = 0.7 + hash(i, 7) * 0.55;
    a.push(box(0.045, h, 0.045, i % 3 ? '#6a8a3a' : '#7a9a45', { y: h / 2, x: Math.cos(an) * r, z: Math.sin(an) * r, rz: (hash(i, 9) - 0.5) * 0.5 }));
    if (i % 3 === 0) a.push(box(0.07, 0.2, 0.07, '#6a5030', { y: h + 0.08, x: Math.cos(an) * r, z: Math.sin(an) * r })); } return a; };
  B.log = () => [cyl(0.36, 0.4, 2.0, '#5a3f28', { y: 0.2, rz: 1.57, ry: 0.2 }, 7), cyl(0.3, 0.3, 0.06, '#7a5a3a', { y: 0.2, x: 1.0, rz: 1.57 }, 7), box(0.5, 0.06, 0.5, '#3a6a2a', { y: 0.4, x: -0.3 }), box(0.3, 0.05, 0.3, '#4a7a34', { y: 0.4, x: 0.45, ry: 0.5 })];
  B.bush = () => [sph(0.9, '#2e6a28', { y: 0.38 }, 3, 1.2, 0.8, 1), sph(0.7, '#3a7a30', { y: 0.55, x: 0.3, z: 0.1 }, 3), sph(0.6, '#2a5a24', { y: 0.45, x: -0.35, z: -0.1 }, 3), sph(0.5, '#4a8a38', { y: 0.7, x: -0.05, z: 0.2 }, 2)];
  B.web = () => { const a = []; const R = 0.8; for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4; a.push(box(0.03, R, 0.03, '#e8e8f0', { y: 0, rz: an, x: Math.cos(an + 1.57) * R / 2, z: 0, glow: true })); } for (const r of [0.25, 0.48, 0.7]) for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4 + Math.PI / 8, len = 2 * r * Math.sin(Math.PI / 8) * 1.05; a.push(box(len, 0.025, 0.025, '#f0f0f8', { x: Math.cos(an) * r, y: Math.sin(an) * r, rz: an + 1.57, glow: true })); } return a; };

  function build(icon) {
    mats(); const b = B[icon] || B.generic; const wind = WINDY.has(icon);
    if (wind) { const prev = matte; matte = leaf; var parts = b(); matte = prev; } else var parts = b();
    for (const p of parts) p.computeWorldMatrix(true);
    const m = BABYLON.Mesh.MergeMeshes(parts, true, true, undefined, false, true); m.name = 'item_' + icon; m.isPickable = false; m.isVisible = false; m.setEnabled(true);
    m.metadata = { item: true }; return m;
  }
  const template = icon => cache[icon] || (cache[icon] = build(icon));
  // экземпляр предмета: инстанс шаблона (один draw call на тип)
  function instance(icon) { const t = template(icon); const i = t.createInstance('i_' + icon); i.isPickable = false; return i; }
  const has = icon => !!B[icon];
  return { init(s) { scene = s; }, template, instance, has, build, get leafMat() { mats(); return leaf; } };
})();
