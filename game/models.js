// ---------- Процедурные PSX-модели: персонажи, звери, реквизит, деревья ----------
'use strict';
const Models = (() => {
  let scene = null;
  const matCache = {}, texCache = {};
  const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + (s || 0) * 1442695041) ^ 0x5bd1e995; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const hex2 = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  function canvasTex(name, c) { const t = new BABYLON.DynamicTexture(name, c, scene, false, BABYLON.Texture.NEAREST_SAMPLINGMODE); t.getContext().drawImage(c, 0, 0); t.update(true); t.wrapU = t.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE; return t; }
  // Цветной материал с крупным пиксельным шумом (чтобы плоскости не были «пластиковыми»)
  function colMat(col, opts) {
    opts = opts || {}; const key = col + '|' + (opts.pattern || '') + (opts.emissive || '') + (opts.alpha || '') + (opts.wind || '');
    if (matCache[key]) return matCache[key];
    const [r, g, b] = hex2(col), c = document.createElement('canvas'); c.width = c.height = 8; const ctx = c.getContext('2d'), img = ctx.createImageData(8, 8), d = img.data;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      let k = 0.9 + hash(x, y, 3) * 0.2;
      if (opts.pattern === 'chain') k = (x + y) % 2 ? 0.75 : 1.1;
      if (opts.pattern === 'plate') k = y % 4 === 0 ? 0.7 : 1.05 + (x === 3 ? 0.1 : 0);
      if (opts.pattern === 'planks') k = x % 4 === 0 ? 0.6 : 0.95 + hash(x, y, 5) * 0.15;
      if (opts.pattern === 'stone') k = (y % 4 === 0 || (x + (y >> 2) * 4) % 8 === 0) ? 0.6 : 0.9 + hash(x, y, 7) * 0.25;
      if (opts.pattern === 'bone') k = 0.85 + hash(x, y, 9) * 0.3 - (y === 3 ? 0.25 : 0);
      if (opts.pattern === 'fur') k = 0.8 + hash(x, y, 11) * 0.4;
      const i = (y * 8 + x) * 4; d[i] = Math.min(255, r * k); d[i + 1] = Math.min(255, g * k); d[i + 2] = Math.min(255, b * k); d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const m = new BABYLON.StandardMaterial('m_' + key, scene); m.diffuseTexture = canvasTex('t_' + key, c); m.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
    if (opts.wind) { m.psx && (m.psx.wind = opts.wind); m.markAsDirty(BABYLON.Material.MiscDirtyFlag); }
    if (opts.emissive) { const [er, eg, eb] = hex2(opts.emissive); m.emissiveColor = new BABYLON.Color3(er / 255, eg / 255, eb / 255); }
    if (opts.alpha) { m.alpha = opts.alpha; }
    m.maxSimultaneousLights = 12; m.freeze();
    return matCache[key] = m;
  }
  // Лицо 16×16: кожа, глаза, рот; варианты — skull / goblin / ghost
  function faceMat(skin, kind, eye) {
    const key = 'face' + skin + kind + eye; if (matCache[key]) return matCache[key];
    const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d');
    x.fillStyle = skin; x.fillRect(0, 0, 16, 16);
    const [r, g, b] = hex2(skin); x.fillStyle = `rgb(${r * 0.85 | 0},${g * 0.8 | 0},${b * 0.8 | 0})`; for (let i = 0; i < 12; i++) x.fillRect(hash(i, 1) * 16 | 0, hash(i, 2) * 16 | 0, 1, 1);
    if (kind === 'skull') { x.fillStyle = '#100c0a'; x.fillRect(3, 5, 4, 4); x.fillRect(9, 5, 4, 4); x.fillRect(7, 9, 2, 2); for (let i = 3; i < 13; i += 2) x.fillRect(i, 12, 1, 3); }
    else if (kind === 'ghost') { x.fillStyle = '#0a0a18'; x.fillRect(3, 5, 4, 5); x.fillRect(9, 5, 4, 5); x.fillRect(6, 11, 4, 3); }
    else { x.fillStyle = eye || '#1e1e28'; x.fillRect(4, 6, 2, 2); x.fillRect(10, 6, 2, 2); if (kind === 'goblin') { x.fillStyle = '#e04040'; x.fillRect(4, 6, 2, 1); x.fillRect(10, 6, 2, 1); x.fillStyle = '#3a2a2a'; x.fillRect(5, 11, 6, 1); } else { x.fillStyle = `rgb(${r * 0.6 | 0},${g * 0.45 | 0},${b * 0.45 | 0})`; x.fillRect(6, 11, 4, 1); x.fillRect(7, 9, 2, 1); } }
    const m = new BABYLON.StandardMaterial(key, scene); m.diffuseTexture = canvasTex(key, c); m.specularColor = BABYLON.Color3.Black(); m.maxSimultaneousLights = 12; if (kind === 'ghost') m.alpha = 0.75; m.freeze();
    return matCache[key] = m;
  }
  function box(parent, w, h, d, mat, x, y, z, faceMat) {
    const b = BABYLON.MeshBuilder.CreateBox('p', { width: w, height: h, depth: d, wrap: true }, scene);
    b.material = mat; b.position.set(x, y, z); b.parent = parent; b.isPickable = false;
    if (faceMat) { // лицо на передней грани (+z): отдельный тонкий бокс
      const f = BABYLON.MeshBuilder.CreatePlane('face', { width: w * 0.98, height: h * 0.98 }, scene); f.material = faceMat; f.position.set(0, 0, d / 2 + 0.003); f.rotation.y = Math.PI; f.parent = b; f.isPickable = false;
    }
    return b;
  }
  function cyl(parent, dTop, dBot, h, tess, mat, x, y, z) { const c = BABYLON.MeshBuilder.CreateCylinder('c', { diameterTop: dTop, diameterBottom: dBot, height: h, tessellation: tess }, scene); c.material = mat; c.position.set(x, y, z); c.parent = parent; c.isPickable = false; return c; }
  function pivotBox(parent, w, h, d, mat, x, y, z, pivotY, faceMat) { // бокс с осью вращения у верхнего края (конечности)
    const p = new BABYLON.TransformNode('j', scene); p.position.set(x, y, z); p.parent = parent;
    const b = box(p, w, h, d, mat, 0, pivotY, 0, faceMat); return { j: p, m: b };
  }

  // ================= РИГ =================
  class Rig {
    constructor(root, h) { this.root = root; this.h = h; this.parts = {}; this.t = Math.random() * 10; this.walk = 0; this.attack = 0; this.wind = 0; this.dead = 0; this.dying = false; this.float = false; this.baseY = 0; this._tint = null; this.meshes = []; }
    collect() { this.compact(this.root); this.meshes = this.root.getChildMeshes(); for (const m of this.meshes) { m.isPickable = false; } return this; }
    // Слияние статичных частей под каждым узлом-суставом: меньше мешей и draw calls
    compact(node) {
      const kids = node.getChildren(undefined, true);
      // Сустав бывает привязан не к узлу, а к мешу: у волка шея висит на теле.
      // Такой меш сливать нельзя — MergeMeshes уничтожает источники вместе с детьми,
      // и поддерево сустава пропадает целиком (волк оставался без головы).
      // Поэтому меш с узлом внутри считаем суставом: не сливаем и обходим отдельно.
      const joint = k => k.getClassName() === 'TransformNode' ||
        k.getChildren(c => c.getClassName() === 'TransformNode', false).length > 0;
      const tns = kids.filter(joint);
      const gather = (n, out) => { for (const c of n.getChildren(undefined, true)) { if (joint(c)) continue; if (c.name === 'face') { out.faces.push(c); continue; } out.list.push(c); gather(c, out); } };
      const out = { list: [], faces: [] }; gather(node, out);
      for (const t of tns) this.compact(t);
      if (out.list.length > 1) {
        for (const c of out.list) c.computeWorldMatrix(true); for (const f of out.faces) { f.computeWorldMatrix(true); f.setParent(null); }
        const merged = BABYLON.Mesh.MergeMeshes(out.list, true, true, undefined, false, true);
        if (merged) { merged.name = 'part'; merged.setParent(node); merged.isPickable = false; for (const f of out.faces) f.setParent(merged); this.mergedMats = this.mergedMats || []; this.mergedMats.push(merged.material); if (this.parts.torso && this.parts.torso.isDisposed()) { this.parts.torso = merged; this.parts.torsoY = merged.position.y; } if (this.parts.body && this.parts.body.isDisposed()) { this.parts.body = merged; this.parts.bodyY = merged.position.y; } if (this.parts.tail && this.parts.tail.isDisposed()) this.parts.tail = null; if (this.parts.orb && this.parts.orb.isDisposed()) this.parts.orb = null; }
      }
    }
    get position() { return this.root.position; }
    get rotation() { return this.root.rotation; }
    get scaling() { return this.root.scaling; }
    // совместимость со старым кодом (mesh.scale.set / material.color / opacity)
    get scale() { const r = this.root; return { set: (x, y, z) => r.scaling.set(x, y, z), get x() { return r.scaling.x; }, get y() { return r.scaling.y; } }; }
    get material() {
      const self = this; return {
        color: { setRGB: (r, g, b) => self.tint(r, g, b), setScalar: v => self.tint(v, v, v), multiply: c => self.tint(c.r, c.g, c.b), copy: () => 0 },
        get opacity() { return self._op === undefined ? 1 : self._op; }, set opacity(v) { self.setOpacity(v); }, set transparent(v) { }, get transparent() { return true }, set map(v) { }, dispose() { }
      };
    }
    tint(r, g, b) { // затемнение/подкраска через overlay (материалы общие)
      const strong = Math.max(Math.abs(1 - r), Math.abs(1 - g), Math.abs(1 - b));
      if (strong < 0.05) { if (this._tint) { for (const m of this.meshes) m.renderOverlay = false; this._tint = null; } return; }
      const dark = Math.max(r, g, b) < 0.9;
      for (const m of this.meshes) { m.renderOverlay = true; m.overlayColor = dark ? new BABYLON.Color3(0, 0, 0) : new BABYLON.Color3(r > g ? 1 : 0, g > r ? 0.4 : 0.1, b > r ? 1 : 0.05); m.overlayAlpha = dark ? Math.min(0.6, 1 - (r + g + b) / 3) : Math.min(0.55, strong * 0.6); }
      this._tint = [r, g, b];
    }
    setOpacity(v) { this._op = v; for (const m of this.meshes) m.visibility = v * (m.metadata && m.metadata.baseVis ? m.metadata.baseVis : 1); }
    dispose() { for (const mm of (this.mergedMats || [])) if (mm instanceof BABYLON.MultiMaterial) mm.dispose(); this.root.dispose(false, false); for (const m of this.meshes) m.dispose(); }
    // анимация: dt, состояние {moving, speed}
    update(dt, st) {
      this.t += dt; const P = this.parts;
      if (st && st.moving) this.walk += dt * (st.speed || 4) * 1.6; else this.walk += (Math.round(this.walk / Math.PI) * Math.PI - this.walk) * Math.min(1, dt * 8);
      if (this.attack > 0) this.attack = Math.max(0, this.attack - dt * 3.2);
      const sw = Math.sin(this.walk), am = st && st.moving ? 0.55 : 0, breathe = Math.sin(this.t * 2) * 0.02;
      if (P.legL) { P.legL.rotation.x = sw * am; P.legR.rotation.x = -sw * am; }
      const wnd = this.wind || 0; // замах: рука заносится назад, корпус разворачивается — удар читается заранее
      if (P.armL) { P.armL.rotation.x = -sw * am * 0.7 + wnd * 0.3; P.armR.rotation.x = sw * am * 0.7 - this.attack * 1.9 * (1 - this.attack) + wnd * 1.5; }
      if (P.armR && wnd > 0) P.armR.rotation.z = -wnd * 0.5;
      else if (P.armR) P.armR.rotation.z = 0;
      if (P.torso) { P.torso.position.y = P.torsoY + breathe; P.torso.rotation.y = wnd * -0.25; }
      if (P.legs4) { for (let i = 0; i < 4; i++) P.legs4[i].rotation.x = sw * am * (i % 2 ? 1 : -1) * (i < 2 ? 1 : -1) * 1.1; if (P.headQ) P.headQ.rotation.x = -this.attack * 0.8 * (1 - this.attack) * 2 - wnd * 0.5; }
      if (P.legs8) { for (let i = 0; i < 8; i++) P.legs8[i].rotation.z = (i < 4 ? 1 : -1) * (0.35 + Math.sin(this.walk * 1.5 + i) * am * 0.25); }
      if (P.body) P.body.position.y = P.bodyY + (this.float ? Math.sin(this.t * 1.5) * 0.15 + 0.4 : Math.abs(sw) * am * 0.06);
      if (P.head) { const lk = this.look || 0; P.head.rotation.y += (lk - P.head.rotation.y) * Math.min(1, dt * 5); P.head.rotation.x = Math.sin(this.t * 0.7) * 0.05 + (this.lookX || 0); }
      if (P.tail) P.tail.rotation.y = Math.sin(this.t * 3) * 0.3;
      if (P.orb) P.orb.rotation.y += dt * 2;
      if (this.dying) { this.dead = Math.min(1, this.dead + dt / 0.5); this.root.rotation.x = this.dead * 1.5; this.root.position.y = this.baseY + this.dead * 0.15; }
    }
    hit() { this.attack = 1; this.wind = 0; }
    lookAt(yaw, pitch) { this.look = yaw; this.lookX = pitch || 0; } // поворот головы к цели
    windup(v) { this.wind = v; } // 0..1 — насколько занесено оружие
  }

  // ================= ЧЕЛОВЕК =================
  const DEF = { skin: '#e0b48c', hair: '#5a3a20', shirt: '#6b4a2a', pants: '#3d2f3f', boots: '#2a1c14', armorCol: '#8a5a30', robe: '#4a2a6a', apron: '#b0a090' };
  function humanoid(o) {
    o = Object.assign({}, DEF, o || {}); const S = o.scale || 1;
    const root = new BABYLON.TransformNode('human', scene); const rig = new Rig(root, 2.5 * S);
    const skin = o.bone ? colMat('#d9d2bf', { pattern: 'bone' }) : colMat(o.skin), face = faceMat(o.bone ? '#d9d2bf' : o.skin, o.bone ? 'skull' : o.ghost ? 'ghost' : o.goblin ? 'goblin' : 'human', o.eye);
    const arm = o.armor || 'none';
    const torsoMat = arm === 'chain' ? colMat('#8a8a90', { pattern: 'chain' }) : arm === 'plate' ? colMat('#a8acb4', { pattern: 'plate' }) : arm === 'leather' ? colMat(o.armorCol) : arm === 'robe' ? colMat(o.robe) : o.bone ? skin : colMat(o.shirt);
    const pantsMat = arm === 'robe' ? colMat(o.robe) : o.bone ? skin : colMat(o.pants), bootMat = o.bone ? skin : colMat(o.boots);
    const hairMat = colMat(o.hair);
    const sy = S; // масштаб по высоте
    // ноги
    const lw = o.bone ? 0.13 : o.goblin ? 0.2 : 0.24, legH = o.goblin ? 0.5 : 0.85;
    const legL = pivotBox(root, lw, legH, lw, pantsMat, -0.15, legH, 0, -legH / 2), legR = pivotBox(root, lw, legH, lw, pantsMat, 0.15, legH, 0, -legH / 2);
    if (!o.bone) { box(legL.j, lw + 0.04, 0.16, lw + 0.08, bootMat, 0, -legH + 0.08, 0.02); box(legR.j, lw + 0.04, 0.16, lw + 0.08, bootMat, 0, -legH + 0.08, 0.02); }
    // торс
    const tw = o.goblin ? 0.5 : o.bone ? 0.5 : 0.62, th = o.goblin ? 0.55 : 0.8, tz = o.bone ? 0.22 : 0.34;
    const torso = box(root, tw, th, tz, torsoMat, 0, legH + th / 2, 0); rig.parts.torso = torso; rig.parts.torsoY = torso.position.y;
    if (arm === 'robe') { box(root, tw + 0.1, legH, tz + 0.1, colMat(o.robe), 0, legH / 2 + 0.02, 0); } // подол
    if (arm === 'apron') box(root, tw * 0.6, th * 0.9, 0.04, colMat(o.apron), 0, legH + th / 2 - 0.05, tz / 2 + 0.01);
    if (arm === 'leather') { box(root, tw * 0.2, th * 0.95, 0.03, colMat('#2a1a10'), 0, legH + th / 2, tz / 2 + 0.01); box(root, tw + 0.02, 0.08, tz + 0.02, colMat('#2a1a10'), 0, legH + 0.1, 0); }
    if (arm === 'plate') box(root, tw * 0.4, th * 0.5, 0.03, colMat('#d0d4dc'), 0, legH + th * 0.6, tz / 2 + 0.01);
    if (o.bone) { for (let i = 0; i < 3; i++) box(root, tw + 0.04, 0.05, tz + 0.04, colMat('#2a2420'), 0, legH + 0.15 + i * 0.2, 0); }
    // руки
    const aw = o.bone ? 0.11 : 0.18, ah = th * 0.9;
    const armL = pivotBox(root, aw, ah, aw, torsoMat, -tw / 2 - aw / 2 - 0.02, legH + th - 0.05, 0, -ah / 2), armR = pivotBox(root, aw, ah, aw, torsoMat, tw / 2 + aw / 2 + 0.02, legH + th - 0.05, 0, -ah / 2);
    box(armL.j, aw, 0.16, aw, skin, 0, -ah + 0.06, 0); box(armR.j, aw, 0.16, aw, skin, 0, -ah + 0.06, 0);
    // голова
    const hw = o.goblin ? 0.5 : 0.42, hh = o.goblin ? 0.42 : 0.44;
    const headY = legH + th + hh / 2 + 0.04;
    const head = box(root, hw, hh, hw * 0.95, skin, 0, headY, 0, face); rig.parts.head = head;
    const hs = o.hairStyle || 'short';
    if (hs === 'short') box(head, hw + 0.03, hh * 0.35, hw + 0.03, hairMat, 0, hh * 0.35, -0.02);
    if (hs === 'long') { box(head, hw + 0.04, hh * 0.4, hw + 0.04, hairMat, 0, hh * 0.32, -0.02); box(head, hw + 0.04, hh * 0.9, 0.12, hairMat, 0, -0.1, -hw / 2 + 0.02); box(head, 0.1, hh * 0.8, hw * 0.7, hairMat, -hw / 2 - 0.02, -0.05, -0.1); box(head, 0.1, hh * 0.8, hw * 0.7, hairMat, hw / 2 + 0.02, -0.05, -0.1); }
    if (hs === 'hood') { const rm = colMat(o.robe || '#3a3a2a'); box(head, hw + 0.12, hh * 0.55, hw + 0.12, rm, 0, hh * 0.3, -0.03); box(head, 0.1, hh + 0.1, hw + 0.1, rm, -hw / 2 - 0.06, 0, -0.04); box(head, 0.1, hh + 0.1, hw + 0.1, rm, hw / 2 + 0.06, 0, -0.04); box(head, hw + 0.2, hh + 0.1, 0.1, rm, 0, 0, -hw / 2 - 0.04); }
    if (hs === 'helmet') { const mm = colMat('#8a8a90', { pattern: 'plate' }); box(head, hw + 0.08, hh * 0.6, hw + 0.08, mm, 0, hh * 0.28, 0); box(head, 0.08, hh * 0.5, hw * 0.9, mm, -hw / 2 - 0.04, -0.05, -0.02); box(head, 0.08, hh * 0.5, hw * 0.9, mm, hw / 2 + 0.04, -0.05, -0.02); box(head, 0.08, hh * 0.55, 0.06, mm, 0, -0.02, hw / 2 + 0.02); }
    if (hs === 'cap') box(head, hw + 0.06, hh * 0.3, hw + 0.1, colMat(o.shirt), 0, hh * 0.38, -0.03);
    if (o.beard) { const bm = colMat(o.beard === 'grey' ? '#c8c0b0' : o.hair); box(head, hw * 0.8, o.beardLong ? 0.45 : 0.22, 0.1, bm, 0, -hh / 2 - (o.beardLong ? 0.15 : 0.04), hw / 2 - 0.03); }
    if (o.goblin) { for (const s of [-1, 1]) box(head, 0.2, 0.1, 0.06, skin, s * (hw / 2 + 0.1), 0.08, 0); }
    // оружие в правой руке
    const wp = o.weapon || 'none', W = colMat('#c8ccd4', { pattern: 'plate' }), Wd = colMat('#7a5a30'), Y = colMat('#d9a53c');
    let wnode = null;
    if (wp === 'sword') { wnode = new BABYLON.TransformNode('w', scene); wnode.parent = armR.j; wnode.position.set(0, -ah + 0.05, 0.05); box(wnode, 0.06, 1.0, 0.02, W, 0, 0.55, 0); box(wnode, 0.22, 0.05, 0.05, Y, 0, 0.05, 0); box(wnode, 0.05, 0.16, 0.05, Wd, 0, -0.08, 0); }
    if (wp === 'dagger') { wnode = new BABYLON.TransformNode('w', scene); wnode.parent = armR.j; wnode.position.set(0, -ah + 0.05, 0.05); box(wnode, 0.05, 0.5, 0.02, W, 0, 0.3, 0); box(wnode, 0.14, 0.04, 0.04, Y, 0, 0.04, 0); }
    if (wp === 'axe') { wnode = new BABYLON.TransformNode('w', scene); wnode.parent = armR.j; wnode.position.set(0, -ah + 0.05, 0.05); box(wnode, 0.05, 1.1, 0.05, Wd, 0, 0.4, 0); box(wnode, 0.28, 0.32, 0.04, colMat('#9aa0a8', { pattern: 'plate' }), 0.1, 0.8, 0); }
    if (wp === 'pick') { wnode = new BABYLON.TransformNode('w', scene); wnode.parent = armR.j; wnode.position.set(0, -ah + 0.05, 0.05); box(wnode, 0.05, 1.0, 0.05, Wd, 0, 0.4, 0); box(wnode, 0.5, 0.06, 0.05, colMat('#9aa0a8'), 0, 0.85, 0); }
    if (wp === 'staff') { wnode = new BABYLON.TransformNode('w', scene); wnode.parent = armR.j; wnode.position.set(0, -ah + 0.05, 0.06); box(wnode, 0.06, 2.1, 0.06, Wd, 0, 0.55, 0); const orb = box(wnode, 0.16, 0.16, 0.16, colMat(o.orb || '#ffd060', { emissive: o.orb || '#c09030' }), 0, 1.65, 0); orb.rotation.y = 0.78; rig.parts.orb = orb; }
    if (wp === 'bow') { wnode = new BABYLON.TransformNode('w', scene); wnode.parent = armR.j; wnode.position.set(0.05, -ah + 0.05, 0.05); const b1 = box(wnode, 0.04, 1.3, 0.04, Wd, 0, 0.2, 0); b1.rotation.x = 0.0; box(wnode, 0.01, 1.2, 0.01, colMat('#e0e0d0'), 0, 0.2, 0.12); }
    if (wp === 'lantern') { wnode = new BABYLON.TransformNode('w', scene); wnode.parent = armR.j; wnode.position.set(0, -ah + 0.05, 0.05); box(wnode, 0.16, 0.22, 0.16, colMat('#ffd080', { emissive: '#c08030' }), 0, -0.15, 0); }
    if (o.shield) { box(armL.j, 0.06, 0.6, 0.5, colMat('#8a6a3a', { pattern: 'planks' }), -0.06, -ah / 2, 0); }
    Object.assign(rig.parts, { legL: legL.j, legR: legR.j, armL: armL.j, armR: armR.j, head, weapon: wnode });
    if (o.ghost) { rig.float = true; }
    root.scaling.setAll(S); rig.h = (headY + hh / 2 + 0.1) * S;
    rig.collect(); if (o.ghost) { for (const m of rig.meshes) { m.metadata = { baseVis: 0.7 }; m.visibility = 0.7; } }
    return rig;
  }

  // ================= ЗВЕРИ =================
  function quadruped(o) { // wolf / bear
    const root = new BABYLON.TransformNode('quad', scene); const rig = new Rig(root, o.h);
    const fur = colMat(o.fur, { pattern: 'fur' }), dark = colMat(o.dark, { pattern: 'fur' }), belly = colMat(o.belly || o.fur, { pattern: 'fur' });
    const L = o.len, H = o.body, W = o.wide, legH = o.legH;
    const body = box(root, W, H, L, fur, 0, legH + H / 2, 0); rig.parts.body = body; rig.parts.bodyY = body.position.y;
    box(body, W * 0.9, H * 0.35, L * 0.85, belly, 0, -H / 2 + H * 0.15, 0.02);
    box(body, W * 0.6, H * 0.25, L * 0.7, dark, 0, H / 2 - 0.02, -0.05); // хребет
    const neck = new BABYLON.TransformNode('n', scene); neck.parent = body; neck.position.set(0, H * 0.25, L / 2);
    const headMat = faceMat(o.fur, 'human', '#f2c04a');
    const hw = o.headW, head = box(neck, hw, hw * 0.9, hw * 1.1, fur, 0, 0.05, hw * 0.45, headMat); rig.parts.headQ = neck;
    box(head, hw * 0.5, hw * 0.4, hw * 0.55, dark, 0, -hw * 0.15, hw * 0.7); // морда
    box(head, hw * 0.2, hw * 0.15, hw * 0.15, colMat('#1a1410'), 0, -hw * 0.05, hw * 0.98); // нос
    for (const s of [-1, 1]) box(head, hw * 0.22, hw * 0.3, hw * 0.12, dark, s * hw * 0.3, hw * 0.55, -hw * 0.1);
    if (o.teeth) for (const s of [-1, 1]) box(head, 0.04, 0.08, 0.04, colMat('#f2e8b0'), s * hw * 0.15, -hw * 0.35, hw * 0.85);
    const legs = []; const lw = o.legW;
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const p = pivotBox(root, lw, legH, lw, sx * sz > 0 ? dark : fur, sx * (W / 2 - lw / 2), legH, sz * (L / 2 - lw * 0.7), -legH / 2); box(p.j, lw + 0.04, 0.1, lw + 0.08, dark, 0, -legH + 0.05, 0.03); if (o.claws) for (let i = -1; i <= 1; i++) box(p.j, 0.03, 0.04, 0.06, colMat('#f2e8b0'), i * lw * 0.3, -legH + 0.02, lw / 2 + 0.04); legs.push(p.j); }
    rig.parts.legs4 = legs;
    if (o.tail) { const t = box(root, 0.1, 0.1, o.tail, fur, 0, legH + H * 0.7, -L / 2 - o.tail / 2 + 0.05); t.rotation.x = -0.4; rig.parts.tail = t; }
    return rig.collect();
  }
  function spider(o) {
    const root = new BABYLON.TransformNode('spider', scene); const rig = new Rig(root, o.h);
    const S = o.scale || 1, body = colMat('#5c3868', { pattern: 'fur' }), legM = colMat('#2e1e34'), red = colMat('#c04040', { emissive: '#601818' });
    const abd = box(root, 0.9 * S, 0.6 * S, 1.1 * S, body, 0, 0.55 * S, -0.35 * S); rig.parts.body = abd; rig.parts.bodyY = abd.position.y;
    box(abd, 0.3 * S, 0.15 * S, 0.5 * S, red, 0, 0.3 * S, 0); // «песочные часы»
    const th = box(root, 0.6 * S, 0.45 * S, 0.6 * S, body, 0, 0.5 * S, 0.45 * S);
    for (let i = 0; i < 6; i++) box(th, 0.06 * S, 0.06 * S, 0.04, red, (i % 3 - 1) * 0.16 * S, (i < 3 ? 0.1 : -0.02) * S, 0.3 * S); // глаза
    for (const s of [-1, 1]) box(th, 0.08 * S, 0.2 * S, 0.1 * S, legM, s * 0.12 * S, -0.2 * S, 0.3 * S); // хелицеры
    const legs = [];
    for (let i = 0; i < 8; i++) { const s = i < 4 ? -1 : 1, k = i % 4; const p = new BABYLON.TransformNode('l', scene); p.parent = root; p.position.set(s * 0.3 * S, 0.55 * S, (0.45 - k * 0.35) * S); p.rotation.z = s * 0.35; p.rotation.y = s * (k - 1.5) * -0.25; const seg = box(p, 0.9 * S, 0.06 * S, 0.06 * S, legM, s * 0.45 * S, 0, 0); const seg2 = box(p, 0.06 * S, 0.7 * S, 0.06 * S, legM, s * 0.9 * S, -0.3 * S, 0); seg2.rotation.z = s * -0.25; legs.push(p); }
    rig.parts.legs8 = legs; return rig.collect();
  }

  // ================= ПРЕСЕТЫ =================
  const PRESET = {
    elder: () => humanoid({ hairStyle: 'bald', beard: 'grey', beardLong: true, armor: 'robe', robe: '#6b4a2a', weapon: 'staff', hair: '#c8c0b0' }),
    smith: () => humanoid({ hairStyle: 'short', hair: '#3a2a1a', beard: true, shirt: '#8a3a2a', armor: 'apron', apron: '#b0a090', pants: '#3d2a18' }),
    healer: () => humanoid({ hairStyle: 'long', hair: '#5a3a20', shirt: '#4a7a3a', armor: 'robe', robe: '#4a7a3a' }),
    innkeeper: () => humanoid({ hairStyle: 'long', hair: '#c04a2a', shirt: '#7a3a4a', armor: 'apron', apron: '#e0d8c0', pants: '#5a2a3a' }),
    miner: () => humanoid({ hairStyle: 'cap', shirt: '#5a5a60', armor: 'leather', armorCol: '#6a5a40', pants: '#4a4a40', weapon: 'pick', beard: true, hair: '#6a6a60' }),
    hunter: () => humanoid({ hairStyle: 'hood', robe: '#3a5a2a', armor: 'leather', armorCol: '#6a4a2a', pants: '#3a2a18', weapon: 'bow' }),
    villager1: () => humanoid({ hairStyle: 'short', hair: '#8a6a3a', shirt: '#5a6a8a', pants: '#3d2a18' }),
    villager2: () => humanoid({ hairStyle: 'long', hair: '#2a1a10', shirt: '#8a5a6a', armor: 'robe', robe: '#8a5a6a' }),
    guard: () => humanoid({ hairStyle: 'helmet', armor: 'chain', pants: '#3a2a20', weapon: 'sword', shield: true }),
    drunk: () => humanoid({ hairStyle: 'short', hair: '#4a3a2a', shirt: '#6a5a3a', pants: '#3a2a18', beard: true }),
    bandit: () => humanoid({ hairStyle: 'hood', robe: '#3a3a2a', armor: 'leather', armorCol: '#5a4a30', pants: '#2a2a20', weapon: 'dagger', shirt: '#4a3a28' }),
    banditAxe: () => humanoid({ hairStyle: 'cap', shirt: '#3a3a2a', armor: 'leather', armorCol: '#5a4a30', pants: '#2a2a20', weapon: 'axe', beard: true, hair: '#2a1a10' }),
    chief: () => humanoid({ hairStyle: 'helmet', armor: 'chain', pants: '#3a2a20', weapon: 'sword', beard: true, hair: '#7a3a20', scale: 1.08 }),
    goblin: () => humanoid({ goblin: true, skin: '#5f8a3a', hairStyle: 'bald', shirt: '#6b4a2a', pants: '#3d2a18', weapon: 'dagger', scale: 0.7, hair: '#5f8a3a' }),
    skeleton: () => humanoid({ bone: true, hairStyle: 'bald', weapon: 'sword', hair: '#d9d2bf' }),
    lich: () => humanoid({ hairStyle: 'hood', robe: '#4a2a6a', armor: 'robe', weapon: 'staff', orb: '#7df0a0', skin: '#d9d2bf', eye: '#7df0a0', scale: 1.15, hair: '#d9d2bf' }),
    ghost: () => humanoid({ ghost: true, hairStyle: 'long', hair: '#e8e8f8', skin: '#e0e0f0', armor: 'robe', robe: '#d8d8f0' }),
    wolf: () => quadruped({ fur: '#6f6a66', dark: '#4a4644', belly: '#8f8a84', len: 1.3, body: 0.5, wide: 0.45, legH: 0.55, legW: 0.13, headW: 0.38, tail: 0.6, teeth: true, h: 1.2 }),
    bear: () => quadruped({ fur: '#5a3a22', dark: '#3f2816', belly: '#6e4a2c', len: 2.0, body: 1.0, wide: 0.95, legH: 0.7, legW: 0.28, headW: 0.6, claws: true, h: 2.2 }),
    spider: () => spider({ h: 1.0 }), spiderQueen: () => spider({ scale: 1.8, h: 1.8 })
  };
  function character(kind) { const f = PRESET[kind]; return f ? f() : humanoid({}); }

  // ================= РЕКВИЗИТ =================
  const PROP = {};
  const stone = () => colMat('#8a8a90', { pattern: 'stone' }), wood = () => colMat('#8a6a3a', { pattern: 'planks' }), dark = () => colMat('#4a3018'), iron = () => colMat('#7a7a82');
  PROP.chest = (root, opened) => { box(root, 1.1, 0.6, 0.7, wood(), 0, 0.3, 0); const lid = box(root, 1.12, 0.3, 0.72, wood(), 0, 0.75, 0); if (opened) { lid.position.set(0, 0.78, -0.3); lid.rotation.x = -1.6; } box(root, 0.16, 0.2, 0.06, colMat('#d9a53c'), 0, 0.45, 0.36); for (const s of [-1, 1]) box(root, 0.06, 0.9, 0.74, iron(), s * 0.42, 0.45, 0); };
  PROP.chestOpen = root => PROP.chest(root, true);
  PROP.lockedChest = root => { PROP.chest(root); box(root, 0.22, 0.26, 0.08, iron(), 0, 0.45, 0.4); };
  PROP.barrel = root => { cyl(root, 0.7, 0.62, 0.95, 10, colMat('#7a5a30', { pattern: 'planks' }), 0, 0.48, 0); for (const y of [0.2, 0.75]) cyl(root, 0.74, 0.74, 0.06, 10, iron(), 0, y, 0); };
  PROP.crate = root => { box(root, 0.85, 0.85, 0.85, wood(), 0, 0.43, 0); box(root, 0.88, 0.08, 0.88, dark(), 0, 0.43, 0); box(root, 0.08, 0.88, 0.88, dark(), 0, 0.43, 0); };
  PROP.table = root => { box(root, 1.8, 0.1, 1.0, wood(), 0, 0.8, 0); for (const [x, z] of [[-0.8, -0.4], [0.8, -0.4], [-0.8, 0.4], [0.8, 0.4]]) box(root, 0.1, 0.8, 0.1, dark(), x, 0.4, z); box(root, 0.3, 0.3, 0.3, colMat('#c8a060'), 0.3, 1.0, 0.1); };
  PROP.bed = root => { box(root, 1.1, 0.4, 2.1, wood(), 0, 0.2, 0); box(root, 1.0, 0.16, 1.9, colMat('#b0a080'), 0, 0.48, 0); box(root, 1.0, 0.1, 1.2, colMat('#6a3a3a'), 0, 0.6, 0.2); box(root, 0.7, 0.15, 0.4, colMat('#e0d8c0'), 0, 0.6, -0.7); box(root, 1.1, 0.9, 0.08, wood(), 0, 0.45, -1.02); };
  PROP.anvil = root => { box(root, 0.6, 0.3, 0.5, stone(), 0, 0.15, 0); box(root, 0.35, 0.35, 0.4, iron(), 0, 0.45, 0); box(root, 1.0, 0.18, 0.4, iron(), 0, 0.7, 0); box(root, 0.3, 0.14, 0.2, iron(), 0.6, 0.72, 0); };
  PROP.furnace = root => { box(root, 1.4, 1.6, 1.2, stone(), 0, 0.8, 0); box(root, 0.6, 0.5, 0.2, colMat('#ff7a20', { emissive: '#ff5a10' }), 0, 0.5, 0.55); box(root, 0.5, 0.9, 0.5, stone(), 0, 2.0, -0.2); root.metadata = { light: { y: 0.6, z: 0.8, color: '#ff8a30', k: 1.5 }, fire: true }; };
  PROP.cauldron = root => { cyl(root, 1.0, 0.8, 0.7, 10, iron(), 0, 0.6, 0); cyl(root, 0.9, 0.9, 0.05, 10, colMat('#4a9a4a', { emissive: '#1a5a2a' }), 0, 0.93, 0); for (let i = 0; i < 3; i++) box(root, 0.08, 0.3, 0.08, iron(), Math.cos(i * 2.09) * 0.35, 0.15, Math.sin(i * 2.09) * 0.35); root.metadata = { light: { y: 1.1, color: '#60ff90', k: 0.6 } }; };
  PROP.altar = root => { box(root, 1.5, 0.9, 0.9, stone(), 0, 0.45, 0); box(root, 1.7, 0.15, 1.1, stone(), 0, 0.97, 0); box(root, 0.35, 0.35, 0.35, colMat('#6a3aa0', { emissive: '#40207a' }), 0, 1.25, 0).rotation.y = 0.78; root.metadata = { light: { y: 1.5, color: '#9060ff', k: 0.6 } }; };
  PROP.well = root => { cyl(root, 1.5, 1.6, 0.9, 10, stone(), 0, 0.45, 0); const w = BABYLON.MeshBuilder.CreateDisc('w', { radius: 0.6, tessellation: 10 }, scene); w.rotation.x = Math.PI / 2; w.position.y = 0.55; w.material = colMat('#2a4a8a'); w.parent = root; for (const s of [-1, 1]) box(root, 0.14, 1.8, 0.14, wood(), s * 0.7, 1.4, 0); box(root, 1.6, 0.12, 0.12, wood(), 0, 2.2, 0); box(root, 2.0, 0.12, 1.6, colMat('#6a3a30', { pattern: 'planks' }), 0, 2.4, 0); };
  PROP.campfire = root => { for (let i = 0; i < 6; i++) cyl(root, 0.32, 0.36, 0.28, 5, stone(), Math.cos(i / 6 * 6.28) * 0.65, 0.12, Math.sin(i / 6 * 6.28) * 0.65); for (let i = 0; i < 3; i++) { const l = cyl(root, 0.13, 0.13, 0.9, 5, colMat('#4a3018'), 0, 0.16, 0); l.rotation.z = Math.PI / 2; l.rotation.y = i * 1.05; } root.metadata = { light: { y: 0.8, color: '#ff8a30', k: 1.8 }, fire: 'campfire' }; };
  // Настенный факел: пластина крепления вплотную к стене (локальный -z), наклонённое древко в кольце, пламя над ним
  PROP.torch = root => {
    const iron = colMat('#2e2a28', { pattern: 'plate' }), wood = colMat('#4a3018');
    box(root, 0.2, 0.26, 0.05, iron, 0, 0, -0.13);                  // пластина на стене
    box(root, 0.16, 0.06, 0.16, iron, 0, 0.04, -0.03);               // кольцо-держатель
    const st = box(root, 0.07, 0.5, 0.07, wood, 0, 0.12, 0.06); st.rotation.x = 0.45;   // древко под наклоном от стены
    box(root, 0.11, 0.09, 0.11, colMat('#3a2416'), 0, 0.33, 0.19);   // обмотка
    box(root, 0.15, 0.16, 0.15, colMat('#ffb040', { emissive: '#ff8a20' }), 0, 0.45, 0.2); // пламя
    root.metadata = { light: { y: 0.5, z: 0.22, color: '#ffa040', k: 0.9 }, fire: 'torch', fireOff: { y: 0.42, z: 0.2 } };
  };
  PROP.lantern = root => { box(root, 0.12, 2.6, 0.12, dark(), 0, 1.3, 0); box(root, 0.3, 0.36, 0.3, colMat('#ffd080', { emissive: '#ffb040' }), 0, 2.5, 0); box(root, 0.4, 0.06, 0.4, dark(), 0, 2.72, 0); root.metadata = { light: { y: 2.4, color: '#ffc060', k: 1.0 } }; };
  PROP.signpost = root => { box(root, 0.14, 2.2, 0.14, dark(), 0, 1.1, 0); box(root, 1.1, 0.28, 0.08, wood(), 0.3, 1.9, 0).rotation.y = 0.3; box(root, 0.9, 0.28, 0.08, wood(), -0.25, 1.55, 0).rotation.y = -0.6; };
  PROP.grave = root => { box(root, 0.8, 1.1, 0.16, stone(), 0, 0.55, 0); box(root, 0.9, 0.12, 0.6, colMat('#4a5a3a'), 0, 0.06, 0.3); };
  PROP.stump = root => { cyl(root, 0.7, 0.85, 0.5, 7, colMat('#6a4a2a'), 0, 0.25, 0); cyl(root, 0.62, 0.62, 0.02, 7, colMat('#c8a060'), 0, 0.51, 0); };
  PROP.treeStump = PROP.stump;
  PROP.rock = root => { const r = BABYLON.MeshBuilder.CreateIcoSphere('r', { radius: 0.55, subdivisions: 1 }, scene); r.material = stone(); r.scaling.set(1.2, 0.6, 1); r.position.y = 0.2; r.parent = r.parent = root; };
  PROP.rockBig = root => { const r = BABYLON.MeshBuilder.CreateIcoSphere('r', { radius: 0.9, subdivisions: 1 }, scene); r.material = stone(); r.scaling.set(1.2, 0.7, 1.1); r.position.y = 0.35; r.parent = root; };
  PROP.ore = root => { const r = BABYLON.MeshBuilder.CreateIcoSphere('r', { radius: 0.7, subdivisions: 1 }, scene); r.material = colMat('#6a6260', { pattern: 'stone' }); r.scaling.set(1.1, 0.8, 0.6); r.position.y = 0.6; r.parent = root; for (let i = 0; i < 5; i++) box(root, 0.14, 0.14, 0.1, colMat('#c88a3a', { emissive: '#3a2410' }), (hash(i, 1) - 0.5) * 1.1, 0.35 + hash(i, 2) * 0.7, 0.3 + hash(i, 3) * 0.1).rotation.z = hash(i, 4); };
  PROP.oreEmpty = root => { const r = BABYLON.MeshBuilder.CreateIcoSphere('r', { radius: 0.6, subdivisions: 1 }, scene); r.material = colMat('#5a5250', { pattern: 'stone' }); r.scaling.set(1.1, 0.6, 0.6); r.position.y = 0.4; r.parent = root; };
  PROP.gemVein = root => { PROP.ore(root); for (let i = 0; i < 3; i++) box(root, 0.16, 0.2, 0.12, colMat(i ? '#5aa0ff' : '#e04060', { emissive: i ? '#204080' : '#601020' }), (hash(i, 7) - 0.5) * 0.9, 0.5 + hash(i, 8) * 0.5, 0.34).rotation.z = 0.7; root.metadata = { light: { y: 0.7, color: '#6090ff', k: 0.35 } }; };
  PROP.support = root => { for (const s of [-1, 1]) box(root, 0.25, 3.4, 0.25, colMat('#5a3a20', { pattern: 'planks' }), s * 1.2, 1.7, 0); box(root, 2.7, 0.3, 0.3, colMat('#5a3a20', { pattern: 'planks' }), 0, 3.3, 0); };
  PROP.tent = root => { const shape = [new BABYLON.Vector3(-1.3, 0, 0), new BABYLON.Vector3(0, 1.5, 0), new BABYLON.Vector3(1.3, 0, 0), new BABYLON.Vector3(-1.3, 0, 0)]; const path = [new BABYLON.Vector3(0, 0, -1.1), new BABYLON.Vector3(0, 0, 1.1)]; const t = BABYLON.MeshBuilder.ExtrudeShape('tent', { shape, path, cap: BABYLON.Mesh.CAP_ALL, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene); t.material = colMat('#7a6a4a', { pattern: 'fur' }); t.parent = root; t.isPickable = false; box(root, 0.08, 1.5, 0.08, dark(), 0, 0.75, 1.15); box(root, 0.08, 1.5, 0.08, dark(), 0, 0.75, -1.15); };
  PROP.bones = root => { for (let i = 0; i < 5; i++) box(root, 0.5, 0.06, 0.08, colMat('#d9d2bf', { pattern: 'bone' }), (hash(i, 1) - 0.5) * 0.8, 0.04, (hash(i, 2) - 0.5) * 0.8).rotation.y = hash(i, 3) * 3; box(root, 0.28, 0.26, 0.28, colMat('#d9d2bf', { pattern: 'bone' }), 0.2, 0.13, -0.1); };
  PROP.corpse = root => { const m = colMat('#4a3a28'); box(root, 0.6, 0.25, 1.6, m, 0, 0.13, 0); box(root, 0.35, 0.3, 0.35, colMat('#c8a080'), 0, 0.15, 0.95); box(root, 0.06, 0.6, 0.06, colMat('#5a3a20'), 0.1, 0.5, -0.2).rotation.z = 0.4; };
  PROP.dirtPile = root => { const r = BABYLON.MeshBuilder.CreateIcoSphere('r', { radius: 0.5, subdivisions: 1 }, scene); r.material = colMat('#6a4a2a'); r.scaling.set(1.2, 0.35, 1.2); r.position.y = 0.05; r.parent = root; };
  PROP.book = root => { box(root, 0.5, 0.06, 0.4, colMat('#6a2a2a'), 0, 0.03, 0); box(root, 0.46, 0.03, 0.36, colMat('#e8e0c8'), 0, 0.07, 0); };
  PROP.note = root => { box(root, 0.36, 0.44, 0.02, colMat('#e8e0c8'), 0, 0, 0); };
  PROP.fence = root => { for (let i = -1; i <= 1; i++) box(root, 0.14, 1.1, 0.14, wood(), i * 1.4, 0.55, 0); for (const y of [0.45, 0.85]) box(root, 3.0, 0.1, 0.08, wood(), 0, y, 0); };
  PROP.moonflower = root => { box(root, 0.04, 0.5, 0.04, colMat('#4a7a3a'), 0, 0.25, 0); box(root, 0.25, 0.25, 0.25, colMat('#c8e0ff', { emissive: '#8090ff' }), 0, 0.55, 0).rotation.y = 0.78; root.metadata = { light: { y: 0.6, color: '#8090ff', k: 0.3 } }; };
  PROP.web = root => { const m = Items3D.build('web'); m.isVisible = true; m.name = 'web'; m.position.y = 1.0; m.rotation.y = hash(root.position.x, root.position.z) * 3; m.rotation.x = (hash(root.position.z, root.position.x, 2) - 0.5) * 0.6; m.parent = root; };

  function prop(kind, opened) {
    const root = new BABYLON.TransformNode('prop_' + kind, scene);
    const f = PROP[kind]; if (!f) return null;
    f(root, opened);
    const kids = root.getChildMeshes().filter(m => !m.material.needAlphaBlending());
    if (kids.length > 1 && kind !== 'web') { for (const k of kids) k.computeWorldMatrix(true); const merged = BABYLON.Mesh.MergeMeshes(kids, true, true, undefined, false, true); if (merged) { merged.name = 'prop_' + kind; merged.parent = root; merged.isPickable = false; } }
    for (const m of root.getChildMeshes()) { m.isPickable = false; }
    return root;
  }

  // ================= ДЕРЕВЬЯ (базовые меши для thin instances) =================
  function tree(kind) {
    const root = new BABYLON.TransformNode('tree', scene); const parts = [];
    const bark = colMat('#5a3a22', { pattern: 'planks' });
    if (kind === 'pine' || kind === 'pineDark') {
      const leaf = colMat(kind === 'pine' ? '#3a7a40' : '#2a5a34', { pattern: 'fur', wind: 0.012 });
      parts.push(cyl(root, 0.22, 0.38, 2.4, 6, bark, 0, 1.2, 0));
      for (let i = 0; i < 3; i++) { const c = cyl(root, 0.05, 2.6 - i * 0.65, 1.7, 6, leaf, 0, 2.0 + i * 1.1, 0); c.rotation.y = i * 0.5; parts.push(c); }
    } else if (kind === 'oak') {
      const leaf = colMat('#4a8a3a', { pattern: 'fur', wind: 0.016 });
      parts.push(cyl(root, 0.35, 0.55, 2.4, 7, bark, 0, 1.2, 0));
      for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28, r = i === 4 ? 0 : 0.95; const s = BABYLON.MeshBuilder.CreateIcoSphere('l', { radius: 1.1 + hash(i, 1) * 0.3, subdivisions: 1 }, scene); s.material = leaf; s.position.set(Math.cos(a) * r, 2.7 + (i === 4 ? 0.7 : hash(i, 2) * 0.4), Math.sin(a) * r); s.parent = root; parts.push(s); }
    } else { // deadTree
      const dm = colMat('#4a3a30');
      parts.push(cyl(root, 0.18, 0.4, 2.8, 5, dm, 0, 1.4, 0));
      for (let i = 0; i < 3; i++) { const b = box(root, 0.1, 1.2, 0.1, dm, 0, 2.0 + i * 0.3, 0); b.rotation.z = (i % 2 ? 1 : -1) * 0.8; b.rotation.y = i * 1.2; b.position.x = (i % 2 ? 1 : -1) * 0.4; parts.push(b); }
    }
    const merged = BABYLON.Mesh.MergeMeshes(parts, true, true, undefined, false, true); merged.name = 'tree_' + kind; root.dispose();
    merged.isPickable = false; return merged;
  }
  // кросс-биллборд из пиксель-арта (трава, цветы, кусты) — для thin instances
  function crossSprite(canvas, w, h) {
    const t = new BABYLON.DynamicTexture('cs', canvas, scene, false, BABYLON.Texture.NEAREST_SAMPLINGMODE); t.getContext().drawImage(canvas, 0, 0); t.update(true); t.hasAlpha = true;
    const m = new BABYLON.StandardMaterial('csm', scene); m.diffuseTexture = t; m.backFaceCulling = false; m.specularColor = BABYLON.Color3.Black(); m.emissiveColor = new BABYLON.Color3(0.25, 0.25, 0.22); m.maxSimultaneousLights = 12; m.freeze();
    const a = BABYLON.MeshBuilder.CreatePlane('a', { width: w, height: h }, scene); a.position.y = h / 2; const b = a.clone('b'); b.rotation.y = Math.PI / 2;
    const merged = BABYLON.Mesh.MergeMeshes([a, b], true, true); merged.material = m; merged.isPickable = false; return merged;
  }

  return { init(s) { scene = s; }, character, prop, tree, crossSprite, colMat, canvasTex, box, cyl, Rig };
})();
