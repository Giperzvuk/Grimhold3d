// ---------- Рендер-слой на Babylon.js: сцена, уровни, спрайты, погода, свет ----------
'use strict';
const R = (() => {
  let engine, scene, camera, canvas, pp, sun, hemi, torch, shadow = null, sky = null, stars = null;
  const texCache = new Map(), matCache = new Map(), sprMatCache = new Map();
  let lightPool = [];
  const LIGHTS_MAX = 12;
  const PSX = { scale: 2.2, posterize: 24, time: 0, wind: 1, grade: [1, 1, 1], sat: 1 };
  let glow = null, shadowLight = null, shadowPt = null, sunDisc = null, clouds = null, waterMesh = null;

  function init(cv, opts) {
    canvas = cv; Models; opts = opts || {};
    engine = new BABYLON.Engine(canvas, false, { preserveDrawingBuffer: false, stencil: false, powerPreference: 'high-performance', doNotHandleContextLost: true, audioEngine: false });
    engine.setHardwareScalingLevel(opts.hires ? 1.4 : PSX.scale);
    scene = new BABYLON.Scene(engine); scene.useRightHandedSystem = true; scene.clearColor = new BABYLON.Color4(0, 0, 0, 1); scene.autoClear = true; scene.skipPointerMovePicking = true; scene.blockMaterialDirtyMechanism = true;
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2; scene.fogDensity = 0.01; scene.fogColor = new BABYLON.Color3(0.5, 0.6, 0.8); scene.setRenderingAutoClearDepthStencil(1, true, true, false);
    camera = new BABYLON.UniversalCamera('cam', new BABYLON.Vector3(0, 1.7, 0), scene); camera.fov = 1.2; camera.minZ = 0.08; camera.maxZ = 220; camera.inputs.clear(); camera.rotationQuaternion = null;
    hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0.2, 1, 0.1), scene); hemi.intensity = 0.8;
    sun = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-0.5, -0.8, -0.4), scene); sun.intensity = 1.5; sun.position = new BABYLON.Vector3(60, 80, 60);
    torch = new BABYLON.PointLight('ptorch', new BABYLON.Vector3(0, 1.7, 0), scene); torch.diffuse = new BABYLON.Color3(1, 0.65, 0.3); torch.intensity = 0; torch.range = 14;
    for (let i = 0; i < 8; i++) { const pl = new BABYLON.PointLight('pool' + i, new BABYLON.Vector3(0, -100, 0), scene); pl.intensity = 0; pl.range = 12; lightPool.push({ pl, used: null }); }
    // отдельный источник для теней в помещениях (тени от факела/костра)
    shadowLight = new BABYLON.PointLight('shadowPt', new BABYLON.Vector3(0, -100, 0), scene); shadowLight.intensity = 0; shadowLight.range = 13; shadowLight.shadowMinZ = 0.2; shadowLight.shadowMaxZ = 14;
    Models.init(scene); Items3D.init(scene);
    // PSX-постпроцесс: постеризация + дизеринг 2×2
    BABYLON.Effect.ShadersStore['psxFragmentShader'] = `precision highp float; varying vec2 vUV; uniform sampler2D textureSampler; uniform vec2 res; uniform float steps; uniform float vig; uniform vec3 grade; uniform float sat; uniform vec4 water;
      void main(){ vec4 c = texture2D(textureSampler, vUV); vec2 p = floor(vUV * res); float b = mod(p.x + p.y * 2.0, 4.0) / 4.0 - 0.375;
      c.rgb *= grade; float g = dot(c.rgb, vec3(0.299, 0.587, 0.114)); c.rgb = mix(vec3(g), c.rgb, sat);
      if (water.a > 0.0) { float w = sin(vUV.y * 60.0 + water.a * 3.0) * 0.004; c = texture2D(textureSampler, vec2(vUV.x + w, vUV.y)); c.rgb *= grade; c.rgb = mix(c.rgb, water.rgb, 0.55); }
      c.rgb = floor(c.rgb * steps + b * 0.9 + 0.5) / steps;
      float d = distance(vUV, vec2(0.5)); c.rgb *= 1.0 - smoothstep(0.45, 0.95, d) * vig; gl_FragColor = vec4(c.rgb, 1.0); }`;
    pp = new BABYLON.PostProcess('psx', 'psx', ['res', 'steps', 'vig', 'grade', 'sat', 'water'], null, 1.0, camera, BABYLON.Texture.NEAREST_SAMPLINGMODE);
    pp.onApply = e => { e.setFloat2('res', engine.getRenderWidth(), engine.getRenderHeight()); e.setFloat('steps', PSX.posterize); e.setFloat('vig', 0.35); e.setFloat3('grade', PSX.grade[0], PSX.grade[1], PSX.grade[2]); e.setFloat('sat', PSX.sat); e.setFloat4('water', 0.12, 0.3, 0.38, PSX.under || 0); };
    // дрожание вершин (PSX): плагин для всех StandardMaterial
    class PsxPlugin extends BABYLON.MaterialPluginBase {
      constructor(m) { super(m, 'Psx', 200, { PSX_SNAP: true, PSX_WIND: false }); this.wind = 0; this.wave = 0; this._isEnabled = true; }
      getClassName() { return 'PsxPlugin'; }
      prepareDefines(d) { d.PSX_SNAP = true; d.PSX_WIND = this.wind > 0 || this.wave > 0; }
      getUniforms() { return { ubo: [{ name: 'psxWind', size: 1, type: 'float' }, { name: 'psxWave', size: 1, type: 'float' }, { name: 'psxTime', size: 1, type: 'float' }], vertex: '#ifdef PSX_WIND\nuniform float psxWind;\nuniform float psxWave;\nuniform float psxTime;\n#endif' }; }
      bindForSubMesh(ubo) { ubo.updateFloat('psxWind', this.wind * PSX.wind); ubo.updateFloat('psxWave', this.wave); ubo.updateFloat('psxTime', PSX.time); }
      getCustomCode(t) {
        if (t !== 'vertex') return null;
        return {
          // ветер: амплитуда растёт с высотой вершины, фаза — от мировых координат (каждый куст качается по-своему)
          CUSTOM_VERTEX_UPDATE_WORLDPOS: `#ifdef PSX_WIND
            float swayA = psxWind * max(0.0, position.y);
            worldPos.x += sin(psxTime * 1.7 + worldPos.z * 0.5 + worldPos.x * 0.3) * swayA;
            worldPos.z += cos(psxTime * 1.4 + worldPos.x * 0.45) * swayA * 0.6;
            worldPos.y += psxWave * (sin(psxTime * 1.9 + worldPos.x * 0.9) * 0.5 + sin(psxTime * 1.25 + worldPos.z * 0.7) * 0.5);
            #endif`,
          CUSTOM_VERTEX_MAIN_END: `vec2 grid = vec2(160.0, 90.0); gl_Position.xy = floor(gl_Position.xy / gl_Position.w * grid + 0.5) / grid * gl_Position.w;`
        };
      }
    }
    BABYLON.RegisterMaterialPlugin('Psx', m => { if (m instanceof BABYLON.StandardMaterial && !m.noPsx) { m.psx = new PsxPlugin(m); return m.psx; } return null; });
    // свечение источников света и самоцветов
    glow = new BABYLON.GlowLayer('glow', scene, { mainTextureRatio: 0.35, blurKernelSize: 24 }); glow.intensity = 0.5;
    return { engine, scene, camera };
  }
  function setHires(on) { engine.setHardwareScalingLevel(on ? 1.4 : PSX.scale); }
  function resize() { engine.resize(); }

  // ---- текстуры и материалы из канвасов textures.js ----
  function texOf(cnv, alpha) {
    if (!cnv) return null; let t = texCache.get(cnv); if (t) return t;
    t = new BABYLON.DynamicTexture('tx', cnv, scene, !!cnv.isTile, BABYLON.Texture.NEAREST_SAMPLINGMODE); t.getContext().drawImage(cnv, 0, 0); t.update(true);
    t.wrapU = t.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE; if (alpha) t.hasAlpha = true; texCache.set(cnv, t); return t;
  }
  function tileMat(name) {
    let m = matCache.get(name); if (m) return m;
    m = new BABYLON.StandardMaterial('tile_' + name, scene); m.diffuseTexture = texOf(TEX.T[name]); m.specularColor = new BABYLON.Color3(0.01, 0.01, 0.01); m.maxSimultaneousLights = LIGHTS_MAX; m.backFaceCulling = true;
    if (name === 'water') { m.alpha = 0.85; m.emissiveColor = new BABYLON.Color3(0.05, 0.1, 0.2); }
    if (name === 'roof' || name === 'thatch') m.backFaceCulling = false;
    matCache.set(name, m); return m;
  }
  function meshFrom(geo, mat, name, keepWinding) {
    const m = new BABYLON.Mesh(name || 'geo', scene); const vd = new BABYLON.VertexData(); vd.positions = geo.positions; vd.normals = geo.normals; vd.uvs = geo.uvs;
    const idx = []; for (let i = 0; i < geo.positions.length / 3; i += 3) { if (keepWinding) idx.push(i, i + 1, i + 2); else idx.push(i, i + 2, i + 1); } vd.indices = idx; vd.applyToMesh(m, false); m.material = mat; m.isPickable = false; return m;
  }

  // ---- спрайт-биллборд с адаптером старого API ----
  class Sprite {
    constructor(cnv, size, opts) {
      opts = opts || {}; const w = size[0], h = size[1];
      this.mesh = BABYLON.MeshBuilder.CreatePlane('spr', { width: w, height: h }, scene); this.mesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y; this.mesh.isPickable = false;
      const shared = opts.emissive && !opts.own; let m = shared ? sprMatCache.get(cnv) : null;
      if (!m) { m = new BABYLON.StandardMaterial('sprm', scene); m.diffuseTexture = texOf(cnv, true); m.diffuseTexture.hasAlpha = true; m.backFaceCulling = false; m.specularColor = BABYLON.Color3.Black(); m.maxSimultaneousLights = LIGHTS_MAX;
        if (opts.emissive) { m.emissiveColor = new BABYLON.Color3(1, 1, 1); m.disableLighting = true; m.linkEmissiveWithDiffuse = true; }
        if (shared) sprMatCache.set(cnv, m); }
      this.shared = !!shared;
      this.mesh.material = m; this.mesh.position.y = opts.y !== undefined ? opts.y : h / 2; this.userData = {}; this.size = size; this._op = 1; this.isSprite = true; this.cnv = cnv;
      const self = this;
      this.material = { color: { setRGB: (r, g, b) => { if (self.shared) return; m.diffuseColor.set(r, g, b); if (m.disableLighting) m.emissiveColor.set(r, g, b); }, setScalar: v => m.diffuseColor.set(v, v, v), multiply: c => m.diffuseColor.multiplyInPlace(new BABYLON.Color3(c.r, c.g, c.b)), copy: () => 0 },
        get opacity() { return self._op; }, set opacity(v) { self._op = v; self.mesh.visibility = v; }, set transparent(v) { }, get transparent() { return true; },
        get map() { return self.cnv; }, set map(v) { if (v && v !== self.cnv) { self.cnv = v; m.diffuseTexture = texOf(v, true); m.diffuseTexture.hasAlpha = true; } }, dispose() { } };
      this.scale = { set: (x, y, z) => this.mesh.scaling.set(x, y, z), get x() { return self.mesh.scaling.x; }, get y() { return self.mesh.scaling.y; } };
    }
    get position() { return this.mesh.position; }
    get rotation() { return this.mesh.rotation; }
    set visible(v) { this.mesh.setEnabled(v); } get visible() { return this.mesh.isEnabled(); }
    setEmissive(on) { const m = this.mesh.material; m.disableLighting = on; m.emissiveColor = on ? new BABYLON.Color3(1, 1, 1) : BABYLON.Color3.Black(); }
    dispose() { if (!this.shared) this.mesh.material.dispose(); this.mesh.dispose(); }
  }
  function spriteMesh(cnv, size, opts) { return new Sprite(cnv, size, opts); }

  // ---- 3D-реквизит с тем же адаптером ----
  class Prop {
    constructor(kind, opts) {
      this.kind = kind; this.node = Models.prop(kind, opts && opts.opened); this.userData = {}; this.isProp = true; this._op = 1;
      if (!this.node) return;
      const self = this;
      this.material = { color: { setRGB: () => 0, setScalar: () => 0, multiply: () => 0, copy: () => 0 }, get opacity() { return self._op; }, set opacity(v) { self._op = v; for (const m of self.node.getChildMeshes()) m.visibility = v; }, set transparent(v) { }, get transparent() { return true; },
        get map() { return TEX.SPR[self.kind]; }, set map(v) { const k = Object.keys(TEX.SPR).find(k => TEX.SPR[k] === v); if (k && k !== self.kind) self.rebuild(k); }, dispose() { } };
      this.scale = { set: (x, y, z) => this.node.scaling.set(x, y, z) };
    }
    rebuild(kind) { const p = this.node.position.clone(), r = this.node.rotation.y, parent = this.node.parent; this.dispose(); this.kind = kind; this.node = Models.prop(kind); this.node.position.copyFrom(p); this.node.rotation.y = r; this.node.parent = parent; if (shadow) addShadowCasters(this.node.getChildMeshes()); }
    get position() { return this.node.position; } get rotation() { return this.node.rotation; }
    set visible(v) { this.node.setEnabled(v); } get visible() { return this.node.isEnabled(); }
    dispose() { for (const m of this.node.getChildMeshes()) if (m.material instanceof BABYLON.MultiMaterial) m.material.dispose(); this.node.dispose(); }
  }
  // Персонаж (риг) — тоже адаптер
  function propOrSprite(sprite, size, opts) {
    if (Models.prop && Object.prototype.hasOwnProperty.call(TEX.SPR, sprite) && PROP3D.has(sprite)) { const p = new Prop(sprite, opts); if (p.node) return p; }
    return spriteMesh(TEX.SPR[sprite], size, opts);
  }
  const PROP3D = new Set(['chest', 'chestOpen', 'lockedChest', 'barrel', 'crate', 'table', 'bed', 'anvil', 'furnace', 'cauldron', 'altar', 'well', 'campfire', 'torch', 'lantern', 'signpost', 'grave', 'stump', 'treeStump', 'rock', 'rockBig', 'ore', 'oreEmpty', 'gemVein', 'support', 'tent', 'bones', 'corpse', 'dirtPile', 'book', 'note', 'fence', 'moonflower', 'web']);

  // ---- группа уровня ----
  class Group {
    constructor() { this.node = new BABYLON.TransformNode('level', scene); this.items = new Set(); }
    add(m) { const n = m.node || m.mesh || (m.root) || m; if (n && n.parent !== undefined) n.parent = this.node; this.items.add(m); }
    remove(m) { this.items.delete(m); if (m.dispose) m.dispose(); else if (m.dispose === undefined && m.node) m.node.dispose(); }
    dispose() { for (const m of this.items) { try { if (m.dispose) m.dispose(); } catch (e) { } } this.items.clear(); this.node.dispose(false, false); }
  }

  // ---- построение уровня из карты ----
  const BUILD_CH = new Set(['H', 'C', 'W', 'D', 'G']);
  const CAVE = { mine: { xz: 0.34, y0: 0.1, y1: 0.55, seed: 3 }, crypt: { xz: 0.06, y0: 0.03, y1: 0.16, seed: 5 } };
  function buildLevel(def, map) {
    const H = map.length, W = map[0].length, k = KIND[def.kind];
    const group = new Group();
    const builders = {}, gbFor = key => builders[key] || (builders[key] = new GeoBuilder());
    const locks = {}, doors = {}; let mountains = null;
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
      const ch = map[z][x];
      if (def.outdoor) {
        // рельеф: стены зданий стоят на плато (фундамент уходит на 1 ниже), скалы по краю — это сам рельеф, внутренние скалы — блоки
        const y0 = Terrain.base(x, z) - 1, hb = 1;
        if (ch === '#') { if (!Terrain.isBorder(x, z)) { const b0 = Terrain.cellMin(x, z) - 0.5; wallBlock(gbFor('rock'), x, z, k.wallH - b0, map, b0); floorCell(gbFor('rock'), x, z, k.wallH); } }
        else if (ch === 'H') wallBlock(gbFor('plaster'), x, z, 3 + hb, map, y0);
        else if (ch === 'W') wallBlock(gbFor('logs'), x, z, 3 + hb, map, y0);
        else if (ch === 'C') wallBlock(gbFor('chapel'), x, z, 5 + hb, map, y0);
        else if (ch === 'G') wallBlock(gbFor('gate'), x, z, 4 + hb, map, y0);
        else if (ch === 'D') { const nC = [cellAt(map, x - 1, z), cellAt(map, x + 1, z), cellAt(map, x, z - 1), cellAt(map, x, z + 1)]; const h = nC.includes('C') ? 5 : nC.includes('#') ? 4 : 3; wallBlock(gbFor('door'), x, z, h + hb, map, y0); }
        if (ch === '#' && !Terrain.isBorder(x, z)) { }
        else if (ch === '#') terrainCell(gbFor('rock'), x, z);
        else if (ch === 'w') terrainCell(gbFor('water'), x, z);
        else if (ch === ',') terrainCell(gbFor(k.path), x, z);
        else if (ch === ':') terrainCell(gbFor('gravel'), x, z);
        else if (BUILD_CH.has(ch)) floorCell(gbFor(k.floor), x, z, Terrain.base(x, z));
        else terrainCell(gbFor(k.floor), x, z);
      } else {
        const cave = CAVE[def.kind]; // пещерная геометрия: подразбиение + смещение вершин
        if (ch === '#') { if (cave) wallBlockSub(gbFor(k.wall), x, z, k.wallH, map, 0, 2, 2); else wallBlock(gbFor(k.wall), x, z, k.wallH, map); }
        else {
          if (cave) { floorCellSub(gbFor(ch === 'c' ? 'carpet' : k.floor), x, z, 0, 2); ceilCellSub(gbFor('ceil|' + k.ceil), x, z, k.h, 2); }
          else { floorCell(gbFor(ch === 'c' ? 'carpet' : k.floor), x, z, 0); ceilCell(gbFor('ceil|' + k.ceil), x, z, k.h); }
          const dgeo = gb => cave ? displaceGeo(gb.build(), cave.xz, cave.y0, cave.y1, k.h, cave.seed) : gb.build();
          if (ch === 'L' || ch === 'K') { const gb = new GeoBuilder(); if (cave) wallBlockSub(gb, x, z, k.h, map, 0, 2, 2); else wallBlock(gb, x, z, k.h, map); const m = meshFrom(dgeo(gb), tileMat('doorLocked'), 'lock'); m.parent = group.node; locks[x + ',' + z] = m; }
          if (ch === 'O') { const gb = new GeoBuilder(); if (cave) wallBlockSub(gb, x, z, k.h, map, 0, 2, 2); else wallBlock(gb, x, z, k.h, map); const m = meshFrom(dgeo(gb), tileMat('door'), 'door'); m.parent = group.node; doors[x + ',' + z] = m; }
        }
      }
    }
    const statics = []; waterMesh = null;
    const cave = CAVE[def.kind];
    for (const key in builders) if (!builders[key].empty) { const ceil = key.startsWith('ceil|'); const geo = cave ? displaceGeo(builders[key].build(), cave.xz, cave.y0, cave.y1, k.h, cave.seed) : builders[key].build(); const m = meshFrom(geo, tileMat(ceil ? key.slice(5) : key), 'lvl_' + key); if (key === 'water') { waterMesh = m; if (m.material.psx) { m.material.psx.wave = 0.09; m.material.markAsDirty(BABYLON.Material.MiscDirtyFlag); } m.material.alpha = 0.78; } m.parent = group.node; m.receiveShadows = true; m.freezeWorldMatrix(); statics.push(m); }
    if (def.outdoor) {
      for (const r of def.roofs || []) { const m = meshFrom(roofGeo(r.x0, r.z0, r.x1, r.z1, r.base + Terrain.base(r.x0, r.z0), r.rise, 0.5), tileMat(r.tex), 'roof'); m.parent = group.node; m.freezeWorldMatrix(); statics.push(m); }
      // дальний ландшафт: холмы вокруг карты
      const far = BABYLON.MeshBuilder.CreateGround('far', { width: W * CS * 5, height: H * CS * 5, subdivisions: 96, updatable: true }, scene);
      const pos = far.getVerticesData(BABYLON.VertexBuffer.PositionKind); const cxw = W * CS / 2, czw = H * CS / 2;
      // внутри карты — под рельефом; снаружи — продолжение гребня (край карты поднят до ~10) с холмами дальше
      for (let i = 0; i < pos.length; i += 3) { const x = pos[i] + cxw, z = pos[i + 2] + czw; const inside = x > 0 && z > 0 && x < W * CS && z < H * CS; if (inside) { pos[i + 1] = Terrain.h(x, z) - 1.5; continue; } const dx = Math.max(0, Math.abs(x - cxw) - cxw), dz = Math.max(0, Math.abs(z - czw) - czw), d = Math.hypot(dx, dz); const kk = Math.min(1, d / 45); pos[i + 1] = 9.6 + (hash2(Math.floor(x / 9), Math.floor(z / 9), 4) * 16 - 3) * kk; }
      far.updateVerticesData(BABYLON.VertexBuffer.PositionKind, pos); const nrm = []; BABYLON.VertexData.ComputeNormals(pos, far.getIndices(), nrm); far.updateVerticesData(BABYLON.VertexBuffer.NormalKind, nrm);
      far.position.set(cxw, 0, czw); far.material = tileMat(def.kind === 'forest' ? 'grassDark' : 'grass'); far.material.diffuseTexture.uScale = far.material.diffuseTexture.vScale = 1; far.parent = group.node; far.isPickable = false; far.freezeWorldMatrix();
      const fk = 'far_' + def.kind; let fm = matCache.get(fk); if (!fm) { fm = far.material.clone('farm'); fm.diffuseTexture = texOf(TEX.T[def.kind === 'forest' ? 'grassDark' : 'grass']).clone(); fm.diffuseTexture.uScale = fm.diffuseTexture.vScale = W * 2.5; matCache.set(fk, fm); } far.material = fm;
      // горы: два кольца
      const mg = new GeoBuilder(), mg2 = new GeoBuilder();
      const ring = (gb, Rr, N, seed, hMin, hVar, y0) => { for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, a2 = (i + 1) / N * Math.PI * 2, am = a + (a2 - a) * (0.3 + hash2(i, seed, 2) * 0.4), hgt = hMin + hash2(i, seed, 9) * hVar; const ax = Math.cos(a) * Rr, az = Math.sin(a) * Rr, bx = Math.cos(a2) * Rr, bz = Math.sin(a2) * Rr, px = Math.cos(am) * Rr, pz = Math.sin(am) * Rr; gb.quad([ax, y0, az], [bx, y0, bz], [px, hgt, pz], [px, hgt, pz], [0, 0, 1], 1, 1); const s = hash2(i, seed, 5); if (s < 0.5) { const a3 = a + (a2 - a) * (0.75 + s * 0.2), h2 = hgt * (0.55 + s * 0.4); gb.quad([px, y0, pz], [bx, y0, bz], [Math.cos(a3) * Rr, h2, Math.sin(a3) * Rr], [Math.cos(a3) * Rr, h2, Math.sin(a3) * Rr], [0, 0, 1], 1, 1); } } };
      ring(mg, 150, 30, 3, 26, 44, -4); ring(mg2, 105, 26, 7, 16, 28, -4);
      mountains = new BABYLON.TransformNode('mts', scene); mountains.parent = group.node;
      const mm = (geo, col, nm) => { const mat = new BABYLON.StandardMaterial(nm, scene); mat.disableLighting = true; mat.emissiveColor = col; mat.backFaceCulling = false; mat.noPsx = true; const m = meshFrom(geo, mat, nm); m.parent = mountains; m.applyFog = false; group.items.add({ dispose: () => mat.dispose() }); return m; };
      mountains.userData = { far: mm(mg.build(), new BABYLON.Color3(0.17, 0.19, 0.25), 'mfar'), near: mm(mg2.build(), new BABYLON.Color3(0.12, 0.13, 0.19), 'mnear') };
      // небо
      sky = BABYLON.MeshBuilder.CreateSphere('sky', { diameter: 400, segments: 8, sideOrientation: BABYLON.Mesh.BACKSIDE }, scene); const sm = new BABYLON.StandardMaterial('skym', scene); sm.disableLighting = true; sm.noPsx = true; sky.material = sm; sm.disableDepthWrite = true; sm.backFaceCulling = false; sky.applyFog = false; sky.infiniteDistance = true; sky.isPickable = false; sky.alphaIndex = -1000; group.items.add({ dispose: () => { sky.dispose(false, true); sky = null; } });
      const sp = sky.getVerticesData(BABYLON.VertexBuffer.PositionKind), scol = []; for (let i = 0; i < sp.length; i += 3) { const t = Math.max(0, Math.min(1, sp[i + 1] / 200)); scol.push(t, t, t, 1); } sky.setVerticesData(BABYLON.VertexBuffer.ColorKind, scol, true); sky.metadata = { cols: scol }; sm.emissiveColor = BABYLON.Color3.White(); sm.diffuseColor = BABYLON.Color3.Black();
      // диск солнца/луны и слоистые облака
      const discMat = new BABYLON.StandardMaterial('discm', scene); discMat.disableLighting = true; discMat.noPsx = true; discMat.emissiveColor = new BABYLON.Color3(1, 0.95, 0.8); discMat.diffuseTexture = getDiscTex(); discMat.diffuseTexture.hasAlpha = true; discMat.useAlphaFromDiffuseTexture = true; discMat.opacityTexture = getDiscTex(); discMat.backFaceCulling = false; discMat.disableDepthWrite = true;
      sunDisc = BABYLON.MeshBuilder.CreatePlane('disc', { size: 26 }, scene); sunDisc.material = discMat; sunDisc.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL; sunDisc.applyFog = false; sunDisc.isPickable = false; sunDisc.infiniteDistance = false; sunDisc.parent = group.node; sunDisc.renderingGroupId = 0;
      group.items.add({ dispose: () => { discMat.dispose(); } });
      const cloudMat = new BABYLON.StandardMaterial('cloudm', scene); cloudMat.disableLighting = true; cloudMat.noPsx = true; cloudMat.emissiveColor = new BABYLON.Color3(1, 1, 1); cloudMat.diffuseTexture = getCloudTex(); cloudMat.diffuseTexture.hasAlpha = true; cloudMat.useAlphaFromDiffuseTexture = true; cloudMat.backFaceCulling = false; cloudMat.disableDepthWrite = true; cloudMat.alpha = 0.55;
      clouds = BABYLON.MeshBuilder.CreateGround('clouds', { width: 520, height: 520, subdivisions: 1 }, scene); clouds.material = cloudMat; clouds.position.y = 78; clouds.applyFog = false; clouds.isPickable = false; clouds.parent = group.node; clouds.rotation.x = Math.PI;
      group.items.add({ dispose: () => { cloudMat.dispose(); } });
      /* небо, горы и облака светятся сами — иначе свечение заливает горизонт белым */
      for (const m of [sky, clouds, mountains.userData.far, mountains.userData.near, far]) if (m) glow.addExcludedMesh(m);
      // звёзды
      const pts = []; for (let i = 0; i < 350; i++) { const a = hash2(i, 20, 0) * 6.28, e = hash2(i, 21, 0) * 1.3 + 0.12; pts.push(new BABYLON.Vector3(Math.cos(a) * Math.cos(e) * 190, Math.sin(e) * 190, Math.sin(a) * Math.cos(e) * 190)); }
      const pcs = new BABYLON.PointsCloudSystem('stars', 2, scene); pcs.addPoints(350, (p, i) => { p.position = pts[i]; p.color = new BABYLON.Color4(1, 1, 1, 1); });
      pcs.buildMeshAsync().then(m => { if (group.node.isDisposed()) { m.dispose(false, true); return; } stars = m; glow.addExcludedMesh(m); m.material.pointSize = 1; m.material.disableLighting = true; m.material.emissiveColor = BABYLON.Color3.White(); m.material.alpha = 0; m.material.disableDepthWrite = true; m.applyFog = false; m.infiniteDistance = true; m.isPickable = false; group.items.add({ dispose: () => { m.dispose(false, true); stars = null; } }); });
    } else { sky = null; stars = null; sunDisc = null; clouds = null; }
    return { group, locks, doors, mountains, statics };
  }

  // ---- деревья и декор через thin instances ----
  function treeField(kind, list) { // list: [{x,z,s}]
    if (!list.length) return null;
    const base = Models.tree(kind); const mats = new Float32Array(list.length * 16);
    list.forEach((t, i) => { BABYLON.Matrix.Compose(new BABYLON.Vector3(t.s, t.s * (t.sy || 1), t.s), BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, t.r || 0), new BABYLON.Vector3(t.x, t.y || 0, t.z)).copyToArray(mats, i * 16); });
    base.thinInstanceSetBuffer('matrix', mats, 16, true); base.thinInstanceEnablePicking = false; base.metadata = { list, kind }; return base;
  }
  // ---- 3D-предмет (инстанс шаблона) с адаптером старого API спрайта ----
  class ItemMesh {
    constructor(icon, opts) {
      opts = opts || {}; this.icon = icon; this.mesh = Items3D.instance(Items3D.has(icon) ? icon : 'generic'); this.mesh.position.y = opts.y || 0; this.userData = {}; this.isItem = true; this._op = 1; const self = this;
      this.material = { color: { setRGB: () => 0, setScalar: () => 0, multiply: () => 0, copy: () => 0 }, get opacity() { return self._op; }, set opacity(v) { self._op = v; self.mesh.setEnabled(v > 0.02); }, set transparent(v) { }, get transparent() { return false; }, get map() { return null; }, set map(v) { }, dispose() { } };
      this.scale = { set: (x, y, z) => this.mesh.scaling.set(x, y, z) };
    }
    get position() { return this.mesh.position; } get rotation() { return this.mesh.rotation; }
    set visible(v) { this.mesh.setEnabled(v); } get visible() { return this.mesh.isEnabled(); }
    setEmissive() { }
    dispose() { this.mesh.dispose(); }
  }
  const itemMesh = (icon, opts) => new ItemMesh(icon, opts);
  function decorField(kind, list) {
    if (!list.length) return null; const base = Items3D.build(kind); base.isVisible = true; base.metadata = Object.assign(base.metadata || {}, { sharedMat: true }); const mats = new Float32Array(list.length * 16);
    list.forEach((t, i) => { BABYLON.Matrix.Compose(new BABYLON.Vector3(t.s || 1, t.s || 1, t.s || 1), BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, t.r || 0), new BABYLON.Vector3(t.x, t.y || 0, t.z)).copyToArray(mats, i * 16); });
    base.thinInstanceSetBuffer('matrix', mats, 16, true); return base;
  }

  // ---- частицы: огонь, дым, погода ----
  let fireTex = null, softTex = null;
  function getFireTex() { if (fireTex) return fireTex; const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d'); const g = x.createRadialGradient(8, 8, 1, 8, 8, 8); g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.5, 'rgba(255,150,50,0.7)'); g.addColorStop(1, 'rgba(255,80,20,0)'); x.fillStyle = g; x.fillRect(0, 0, 16, 16); fireTex = new BABYLON.DynamicTexture('fire', c, scene, false, BABYLON.Texture.NEAREST_SAMPLINGMODE); fireTex.getContext().drawImage(c, 0, 0); fireTex.update(); fireTex.hasAlpha = true; return fireTex; }
  let discTex = null, cloudTex = null;
  function getDiscTex() { if (discTex) return discTex; const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const g = x.createRadialGradient(16, 16, 2, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.42, 'rgba(255,250,230,0.95)'); g.addColorStop(0.55, 'rgba(255,230,170,0.35)'); g.addColorStop(1, 'rgba(255,220,150,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); discTex = new BABYLON.DynamicTexture('disc', c, scene, false, BABYLON.Texture.NEAREST_SAMPLINGMODE); discTex.getContext().drawImage(c, 0, 0); discTex.update(true); discTex.hasAlpha = true; return discTex; }
  function getCloudTex() { if (cloudTex) return cloudTex; const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'); const img = x.createImageData(S, S), d = img.data;
    const n = (px, py, f) => { const xi = Math.floor(px * f), yi = Math.floor(py * f), fx = px * f - xi, fy = py * f - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const h = (a, b) => hash2(((a % 32) + 32) % 32, ((b % 32) + 32) % 32, 4); const t = h(xi, yi) + (h(xi + 1, yi) - h(xi, yi)) * sx, u = h(xi, yi + 1) + (h(xi + 1, yi + 1) - h(xi, yi + 1)) * sx; return t + (u - t) * sy; };
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) { const v = n(px / S, py / S, 4) * 0.6 + n(px / S, py / S, 9) * 0.3 + n(px / S, py / S, 18) * 0.1; const a = Math.max(0, v - 0.52) * 3.4; const i = (py * S + px) * 4; d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.min(255, a * 255) | 0; }
    x.putImageData(img, 0, 0); cloudTex = new BABYLON.DynamicTexture('cloud', c, scene, true, BABYLON.Texture.NEAREST_SAMPLINGMODE); cloudTex.getContext().drawImage(c, 0, 0); cloudTex.update(true); cloudTex.hasAlpha = true; cloudTex.wrapU = cloudTex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE; cloudTex.uScale = cloudTex.vScale = 3; return cloudTex; }
  // ---- декали: пятна на полу и стенах (кровь, копоть, мох) ----
  const decalMats = {};
  function decalMat(kind) {
    if (decalMats[kind]) return decalMats[kind];
    const S = 32, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
    const col = kind === 'blood' ? [140, 20, 18] : kind === 'soot' ? [18, 16, 14] : [60, 96, 40];
    const img = x.createImageData(S, S), d = img.data;
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const dx = (px - S / 2) / (S / 2), dy = (py - S / 2) / (S / 2), r = Math.hypot(dx, dy);
      const n = hash2(px >> 1, py >> 1, kind === 'blood' ? 3 : kind === 'soot' ? 5 : 7);
      const a = Math.max(0, 1 - r * (0.9 + n * 0.7)) * (0.55 + n * 0.65), i = (py * S + px) * 4;
      d[i] = col[0] * (0.8 + n * 0.4); d[i + 1] = col[1] * (0.8 + n * 0.4); d[i + 2] = col[2] * (0.8 + n * 0.4); d[i + 3] = Math.min(255, a * 255) | 0;
    }
    x.putImageData(img, 0, 0);
    const t = new BABYLON.DynamicTexture('dec_' + kind, c, scene, false, BABYLON.Texture.NEAREST_SAMPLINGMODE); t.getContext().drawImage(c, 0, 0); t.update(true); t.hasAlpha = true;
    const m = new BABYLON.StandardMaterial('decm_' + kind, scene); m.diffuseTexture = t; m.diffuseTexture.hasAlpha = true; m.useAlphaFromDiffuseTexture = true; m.specularColor = BABYLON.Color3.Black(); m.maxSimultaneousLights = 12; m.backFaceCulling = false; m.zOffset = -2; m.alpha = kind === 'soot' ? 0.6 : 0.85;
    return decalMats[kind] = m;
  }
  function decal(kind, x, y, z, size, rotY, wall) {
    const m = BABYLON.MeshBuilder.CreatePlane('decal', { size: size || 1 }, scene);
    m.material = decalMat(kind); m.isPickable = false; m.position.set(x, y, z);
    if (wall) { m.rotation.y = rotY || 0; } else { m.rotation.x = -Math.PI / 2; m.rotation.z = rotY || 0; }
    return m;
  }
  function getSoftTex() { if (softTex) return softTex; const c = document.createElement('canvas'); c.width = c.height = 8; const x = c.getContext('2d'); x.fillStyle = 'rgba(255,255,255,1)'; x.fillRect(2, 2, 4, 4); x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(1, 1, 6, 6); softTex = new BABYLON.DynamicTexture('soft', c, scene, false, BABYLON.Texture.NEAREST_SAMPLINGMODE); softTex.getContext().drawImage(c, 0, 0); softTex.update(); softTex.hasAlpha = true; return softTex; }
  function fire(x, y, z, kind) {
    const big = kind === 'campfire' || kind === 'furnace'; const ps = new BABYLON.ParticleSystem('fire', big ? 40 : 16, scene); ps.particleTexture = getFireTex();
    ps.emitter = new BABYLON.Vector3(x, y, z); const r = big ? 0.22 : 0.05; ps.minEmitBox = new BABYLON.Vector3(-r, 0, -r); ps.maxEmitBox = new BABYLON.Vector3(r, 0.05, r);
    ps.color1 = new BABYLON.Color4(1, 0.8, 0.3, 1); ps.color2 = new BABYLON.Color4(1, 0.4, 0.1, 1); ps.colorDead = new BABYLON.Color4(0.3, 0.1, 0, 0);
    ps.minSize = big ? 0.45 : 0.22; ps.maxSize = big ? 0.8 : 0.35; ps.minLifeTime = 0.35; ps.maxLifeTime = big ? 0.8 : 0.5; ps.emitRate = big ? 40 : 18;
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE; ps.gravity = new BABYLON.Vector3(0, 2.5, 0); ps.direction1 = new BABYLON.Vector3(-0.2, 1.2, -0.2); ps.direction2 = new BABYLON.Vector3(0.2, 2.2, 0.2); ps.minEmitPower = 0.4; ps.maxEmitPower = 1; ps.updateSpeed = 0.02; ps.start(); return ps;
  }
  function weatherSystem(kind, count) {
    const ps = new BABYLON.ParticleSystem('w_' + kind, count, scene); ps.particleTexture = getSoftTex(); ps.emitter = new BABYLON.Vector3(0, 12, 0);
    ps.minEmitBox = new BABYLON.Vector3(-16, 0, -16); ps.maxEmitBox = new BABYLON.Vector3(16, 4, 16); ps.updateSpeed = 0.02;
    if (kind === 'rain') { ps.color1 = ps.color2 = new BABYLON.Color4(0.6, 0.7, 0.9, 0.6); ps.colorDead = new BABYLON.Color4(0.6, 0.7, 0.9, 0); ps.minSize = 0.03; ps.maxSize = 0.05; ps.minScaleY = 8; ps.maxScaleY = 12; ps.minLifeTime = 0.9; ps.maxLifeTime = 1.2; ps.emitRate = count / 1.0; ps.gravity = new BABYLON.Vector3(0, -30, 0); ps.direction1 = ps.direction2 = new BABYLON.Vector3(0.5, -8, 0.2); ps.minEmitPower = ps.maxEmitPower = 1; }
    else if (kind === 'snow') { ps.color1 = ps.color2 = new BABYLON.Color4(1, 1, 1, 0.9); ps.colorDead = new BABYLON.Color4(1, 1, 1, 0); ps.minSize = 0.08; ps.maxSize = 0.14; ps.minLifeTime = 5; ps.maxLifeTime = 7; ps.emitRate = count / 5; ps.gravity = new BABYLON.Vector3(0, -1.6, 0); ps.direction1 = new BABYLON.Vector3(-0.4, -0.5, -0.4); ps.direction2 = new BABYLON.Vector3(0.4, -0.5, 0.4); ps.minEmitPower = 0.5; ps.maxEmitPower = 1; }
    else if (kind === 'ash') { ps.color1 = ps.color2 = new BABYLON.Color4(0.7, 0.68, 0.62, 0.5); ps.colorDead = new BABYLON.Color4(0.6, 0.6, 0.6, 0); ps.minSize = 0.05; ps.maxSize = 0.09; ps.minLifeTime = 6; ps.maxLifeTime = 9; ps.emitRate = count / 7; ps.gravity = new BABYLON.Vector3(0, -0.4, 0); ps.direction1 = new BABYLON.Vector3(-0.3, -0.1, -0.3); ps.direction2 = new BABYLON.Vector3(0.3, 0.1, 0.3); ps.minEmitPower = 0.3; ps.maxEmitPower = 0.6; ps.minEmitBox.y = -10; ps.maxEmitBox.y = 0; }
    else if (kind === 'fireflies') { ps.color1 = new BABYLON.Color4(0.85, 0.95, 0.4, 1); ps.color2 = new BABYLON.Color4(1, 1, 0.6, 1); ps.colorDead = new BABYLON.Color4(0.5, 0.6, 0.2, 0); ps.minSize = 0.06; ps.maxSize = 0.1; ps.minLifeTime = 2; ps.maxLifeTime = 4; ps.emitRate = count / 3; ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE; ps.gravity = new BABYLON.Vector3(0, 0, 0); ps.direction1 = new BABYLON.Vector3(-0.5, -0.2, -0.5); ps.direction2 = new BABYLON.Vector3(0.5, 0.3, 0.5); ps.minEmitPower = 0.2; ps.maxEmitPower = 0.5; ps.minEmitBox.y = -11; ps.maxEmitBox.y = -9; }
    ps.start(); ps.metadata = { rate: ps.emitRate }; return ps;
  }
  function moveWeather(ps, x, z) { if (ps) ps.emitter.set(x, 12, z); }
  function setWeatherRate(ps, k) { if (ps) ps.emitRate = ps.metadata.rate * k; }

  // ---- свет ----
  function takeLight(hex) { const s = lightPool.find(s => !s.used); if (!s) return null; s.used = true; s.pl.diffuse = BABYLON.Color3.FromHexString(hex.replace('0x', '#')); s.pl.intensity = 1.5; return s; }
  function freeLight(s) { if (!s) return; s.used = null; s.pl.intensity = 0; s.pl.position.y = -100; }
  let SHADOW_Q = 'low';
  function setShadowQuality(q) { SHADOW_Q = q; }
  function setupLevelLight(def, kind) {
    if (shadow) { shadow.dispose(); shadow = null; }
    if (shadowPt) { shadowPt.dispose(); shadowPt = null; } shadowLight.intensity = 0;
    if (def.outdoor) {
      hemi.setEnabled(true); sun.setEnabled(true);
      const q = SHADOW_Q;
      if (q !== 'off') { shadow = new BABYLON.CascadedShadowGenerator(q === 'high' ? 2048 : 1024, sun); shadow.numCascades = q === 'high' ? 4 : 2; shadow.lambda = 0.75; shadow.shadowMaxZ = q === 'high' ? 70 : 42; }
      if (shadow) { if (q === 'high') { shadow.filter = BABYLON.ShadowGenerator.FILTER_PCF; shadow.filteringQuality = BABYLON.ShadowGenerator.QUALITY_LOW; } else shadow.filter = BABYLON.ShadowGenerator.FILTER_NONE;
        shadow.darkness = 0.4; shadow.bias = 0.004; shadow.stabilizeCascades = true; shadow.autoCalcDepthBounds = false; shadow.depthClamp = true; }
      scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    } else {
      sun.setEnabled(false); hemi.setEnabled(true);
      const col = kind === 'interior' ? [0.55, 0.45, 0.35] : kind === 'mine' ? [0.32, 0.26, 0.2] : [0.22, 0.26, 0.4];
      hemi.diffuse = new BABYLON.Color3(...col); hemi.groundColor = new BABYLON.Color3(col[0] * 0.4, col[1] * 0.4, col[2] * 0.4); hemi.intensity = kind === 'interior' ? 1.7 : 0.5;
      const fc = kind === 'interior' ? [0.16, 0.1, 0.08] : kind === 'crypt' ? [0.03, 0.035, 0.06] : [0.04, 0.03, 0.025]; scene.fogColor = new BABYLON.Color3(...fc); scene.clearColor = new BABYLON.Color4(...fc, 1); scene.fogMode = BABYLON.Scene.FOGMODE_EXP2; scene.fogDensity = kind === 'interior' ? 0.012 : 0.06;
      torch.intensity = kind === 'interior' ? 0.6 : 1.4;
      if (SHADOW_Q === 'high') { shadowPt = new BABYLON.ShadowGenerator(512, shadowLight); shadowPt.usePoissonSampling = true; shadowPt.darkness = 0.35; shadowPt.bias = 0.02; }
    }
  }
  function addShadowCasters(meshes) { const g = shadow || shadowPt; if (!g) return; for (const m of meshes) { if (m.name === 'face') continue; g.addShadowCaster(m, false); } }
  // источник теней в помещении привязывается к ближайшему живому огню
  function setShadowSource(x, y, z, col, on) { if (!shadowPt) return; shadowLight.position.set(x, y, z); shadowLight.intensity = on ? 0.001 : 0; if (col) shadowLight.diffuse = col; }
  // обновление дня/ночи снаружи
  function daylight(light, sunH, dusk, wt, kind, skyCol, fogCol) {
    if (!sun.isEnabled()) return;
    if (sunDisc) { // диск идёт по дуге: днём солнце, ночью луна
      const a = (sunH - 0.25) * Math.PI * 2, night = light < 0.35, h = Math.sin(a);
      const dir = night ? -1 : 1, ah = night ? -h : h;
      sunDisc.position.set(camera.position.x + Math.cos(a) * 150 * dir, Math.max(-30, ah * 120 + 8), camera.position.z - 60 * dir);
      sunDisc.scaling.setAll(night ? 0.55 : 1); sunDisc.setEnabled(ah > -0.25);
      sunDisc.material.emissiveColor.set(night ? 0.75 : 1, night ? 0.8 : lerp(0.6, 0.97, Math.max(0, h)), night ? 0.95 : lerp(0.35, 0.9, Math.max(0, h)));
    }
    if (clouds) { const t = clouds.material.diffuseTexture; t.uOffset = (t.uOffset + 0.00006 * (wt === 'clear' ? 1 : 3)) % 1; t.vOffset = (t.vOffset + 0.00002) % 1;
      clouds.position.x = camera.position.x; clouds.position.z = camera.position.z;
      clouds.material.emissiveColor.set(lerp(0.25, 1, light) * (dusk ? 1.1 : 1), lerp(0.25, 0.98, light) * (dusk ? 0.85 : 1), lerp(0.35, 0.98, light) * (dusk ? 0.8 : 1));
      clouds.material.alpha = wt === 'clear' ? 0.4 : 0.75; }
    const ang = (sunH - 0.25) * Math.PI * 2, night = light < 0.35;
    sun.direction.set(night ? 0.6 : -Math.cos(ang) * 0.7, -Math.max(0.2, Math.sin(ang)), night ? -0.4 : -0.5);
    sun.diffuse.set(night ? 0.45 : 1, night ? 0.5 : lerp(0.65, 0.95, Math.max(0, Math.sin(ang))), night ? 0.75 : lerp(0.45, 0.85, Math.max(0, Math.sin(ang))));
    sun.intensity = night ? 0.3 : lerp(0.5, 1.15, light) * (wt === 'clear' ? 1 : 0.5);
    hemi.diffuse.set(lerp(0.2, 0.75, light), lerp(0.25, 0.8, light), lerp(0.45, 0.92, light)); hemi.groundColor.set(lerp(0.03, 0.3, light), lerp(0.03, 0.25, light), lerp(0.05, 0.18, light)); hemi.intensity = lerp(0.4, 0.75, light);
    torch.intensity = (1 - light) * 1.8;
    scene.fogColor.set(fogCol.r, fogCol.g, fogCol.b); scene.fogDensity = (kind === 'forest' ? 0.016 : 0.011) * (wt === 'clear' ? 1 : 1.8);
    scene.clearColor.set(skyCol.r, skyCol.g, skyCol.b, 1);
    if (sky) { const cols = sky.metadata.cols, top = skyCol.clone().scale(0.8), hor = fogCol; for (let i = 0; i < cols.length; i += 4) { const t = cols[i]; cols[i] = t; } const vc = []; const sp = sky.getVerticesData(BABYLON.VertexBuffer.PositionKind); for (let i = 0; i < sp.length; i += 3) { const t = Math.pow(Math.max(0, Math.min(1, sp[i + 1] / 200)), 0.6); vc.push(lerp(hor.r, top.r, t) + dusk * 0.35 * (1 - t), lerp(hor.g, top.g, t) + dusk * 0.1 * (1 - t), lerp(hor.b, top.b, t) - dusk * 0.15 * (1 - t), 1); } sky.updateVerticesData(BABYLON.VertexBuffer.ColorKind, vc); }
    if (stars) stars.material.alpha = Math.max(0, 0.9 - light * 3);
    if (shadow) shadow.darkness = night ? 0.7 : 0.45;
  }
  const lerp = (a, b, t) => a + (b - a) * t;


  // ---- оружие в руках игрока (3D-вьюмодель, привязана к камере) ----
  const VM = { root: null, kind: null, shield: null };
  function viewmodel(kind, shield) {
    if (VM.kind === kind && VM.shieldKind === shield) return;
    if (VM.root) VM.root.dispose(false, false), VM.root = null;
    VM.kind = kind; VM.shieldKind = shield;
    const root = new BABYLON.TransformNode('vm', scene); root.parent = camera; root.scaling.setAll(0.8); VM.root = root;
    const W = Models.colMat('#c8ccd4', { pattern: 'plate' }), Wd = Models.colMat('#7a5a30', { pattern: 'planks' }), Y = Models.colMat('#d9a53c'), S = Models.colMat('#e0b48c');
    const hand = new BABYLON.TransformNode('hand', scene); hand.parent = root; hand.position.set(0.42, -0.42, -0.7); VM.hand = hand;
    Models.box(hand, 0.11, 0.16, 0.12, S, 0, -0.04, 0); // кулак
    if (kind === 'sword') { Models.box(hand, 0.05, 0.75, 0.02, W, 0, 0.45, 0.02); Models.box(hand, 0.2, 0.04, 0.05, Y, 0, 0.09, 0.02); Models.box(hand, 0.04, 0.12, 0.04, Wd, 0, -0.14, 0.02); }
    else if (kind === 'dagger') { Models.box(hand, 0.04, 0.4, 0.02, W, 0, 0.28, 0.02); Models.box(hand, 0.14, 0.03, 0.04, Y, 0, 0.09, 0.02); }
    else if (kind === 'axe') { Models.box(hand, 0.05, 0.9, 0.05, Wd, 0, 0.35, 0.02); Models.box(hand, 0.26, 0.28, 0.04, Models.colMat('#9aa0a8', { pattern: 'plate' }), 0.1, 0.66, 0.02); }
    else if (kind === 'mace') { Models.box(hand, 0.05, 0.7, 0.05, Wd, 0, 0.3, 0.02); Models.box(hand, 0.18, 0.2, 0.18, Models.colMat('#8a8a92', { pattern: 'plate' }), 0, 0.66, 0.02); }
    else if (kind === 'spear') { Models.box(hand, 0.04, 1.6, 0.04, Wd, 0, 0.6, 0.02); Models.box(hand, 0.05, 0.28, 0.02, W, 0, 1.5, 0.02); }
    else if (kind === 'pick') { Models.box(hand, 0.05, 0.8, 0.05, Wd, 0, 0.3, 0.02); Models.box(hand, 0.5, 0.06, 0.05, Models.colMat('#9aa0a8'), 0, 0.68, 0.02); }
    else if (kind === 'shovel') { Models.box(hand, 0.04, 0.9, 0.04, Wd, 0, 0.35, 0.02); Models.box(hand, 0.16, 0.22, 0.02, Models.colMat('#9aa0a8'), 0, 0.85, 0.02); }
    for (const m of hand.getChildMeshes()) { m.isPickable = false; m.applyFog = false; m.renderingGroupId = 1; }
    if (shield) { const sh = new BABYLON.TransformNode('sh', scene); sh.parent = root; sh.position.set(-0.5, -0.4, -0.75); VM.shield = sh; Models.box(sh, 0.06, 0.5, 0.42, shield === 'shieldIron' ? Models.colMat('#8a8a90', { pattern: 'plate' }) : Models.colMat('#8a6a3a', { pattern: 'planks' }), 0, 0, 0); if (shield === 'shieldIron') Models.box(sh, 0.02, 0.2, 0.14, Models.colMat('#a83232'), 0.04, 0, 0); for (const m of sh.getChildMeshes()) { m.isPickable = false; m.applyFog = false; m.renderingGroupId = 1; } } else VM.shield = null;
  }
  function viewmodelUpdate(swing, swingT, block, bob, moving, cast) {
    if (!VM.root) return; const h = VM.hand; if (!h) return;
    const p = swing > 0 ? 1 - swing / swingT : 0, k = Math.sin(p * Math.PI);
    const bx = Math.cos(bob * 0.5) * 0.02 * moving, by = Math.abs(Math.sin(bob)) * 0.02 * moving;
    h.position.set(0.55 + bx - k * 0.7 - block * 0.3, -0.55 + by + k * 0.2 + block * 0.15, -0.95 - k * 0.1);
    h.rotation.set(-0.9 - k * 0.6 - cast * 0.6, 0.3 + k * 0.3 + block * 0.9, -0.35 + k * 1.5 - block * 0.9);
    h.setEnabled(cast <= 0);
    if (VM.shield) { VM.shield.position.set(-0.72 + bx + block * 0.4, -0.72 + by + block * 0.3, -1.1); VM.shield.rotation.set(0.1, -1.1 + block * 0.7, 0.1); }
  }
  function project(x, y, z) { const v = BABYLON.Vector3.Project(new BABYLON.Vector3(x, y, z), BABYLON.Matrix.Identity(), scene.getTransformMatrix(), camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())); return { x: v.x / engine.getRenderWidth(), y: v.y / engine.getRenderHeight(), behind: v.z > 1 || v.z < 0 }; }
  function render() { PSX.time = performance.now() / 1000; scene.render(); }
  function setGrade(r, g, b, sat) { PSX.grade[0] = r; PSX.grade[1] = g; PSX.grade[2] = b; PSX.sat = sat === undefined ? 1 : sat; }
  function setUnderwater(v) { PSX.under = v; }
  function setWind(v) { PSX.wind = v; }
  function fps() { return engine.getFps(); }
  return { init, resize, setHires, decal, setGrade, setUnderwater, setWind, setShadowQuality, setShadowSource, viewmodel, viewmodelUpdate, texOf, tileMat, spriteMesh, itemMesh, propOrSprite, Prop, Sprite, Group, buildLevel, treeField, decorField, fire, weatherSystem, moveWeather, setWeatherRate, takeLight, freeLight, setupLevelLight, addShadowCasters, daylight, project, render, fps, get scene() { return scene; }, get camera() { return camera; }, get engine() { return engine; }, get torch() { return torch; }, get sun() { return sun; }, get hemi() { return hemi; }, lightPool: () => lightPool };
})();
