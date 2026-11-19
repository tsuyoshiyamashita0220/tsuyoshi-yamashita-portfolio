/* HYOGEN LAB408Gallery 入口 ── THE RESONANT THRESHOLD｜表現がひらく扉
 *
 * 状態（<html data-entry>）
 *   preparing … 3D を準備中。静止画の入口で入場でき、通常リンクも使える
 *   waiting   … 3D の扉が表示され、入場を待っている
 *   entering  … 入場の演出中（1回だけ進む）
 *   lobby     … ロビーを表示。入口の層は消え、フォーカスはロビーの見出しへ
 *   fallback  … 3D が使えない。静止画の切り替えと通常リンクで入場できる
 *
 * 時間：すべて 1 本のタイムライン（u = 0〜2.2）から計算する。扉の角度・床の光・視点が同じ u を参照する。
 *   0〜0.12 反応 / 0.12〜1.30 開扉 / 0.95〜1.85 前進 / 1.85〜2.20 ロビーへ定着
 *   スマートフォン（縦長の画面）では全体を約 1.8 秒に縮める。動きを減らす設定では 150ms の切り替えだけ。
 *
 * 光のしくみ（制作資料 docs/ENTRANCE.md にも記載）
 *   ・外：左上から壁をかすめる太陽光（影あり）。開口の縁が扉と奥の壁に深い影を落とす
 *   ・奥：展示室の天窓の光と、開口から外へ向けたスポットライト（影あり）。
 *     扉が閉じている間は扉がこの光をさえぎり、開くにつれて扉の影の形のまま床へ光が広がる
 *   ・継ぎ目と扉の下のすき間から漏れる光は、細く光る面で近似している
 *   ・軽量表示では影を計算せず、床の光は「開口の幅に合わせて広がる板」で近似する
 */
const root = document.documentElement;
const $ = s => document.querySelector(s);
const ASSET = new URL('./threshold/', import.meta.url).href;
const LOAD_TIMEOUT = 7000;

const sec = $('#threshold'), stage = $('#threshold-stage'), canvas = $('#threshold-canvas');
const lobby = $('#lobby'), lobbyH = $('#lobby-h'), poster = $('#lobby-poster');
const enterBtn = $('#enter'), skipBtn = $('#skip'), statusEl = $('#th-status'), replayBtn = $('#replay');
const head = document.querySelector('.site-head');

const reduceQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const isLite = () => { try { return localStorage.getItem('hl408:lite') === '1'; } catch (e) { return false; } };
const still = () => reduceQ.matches || isLite();
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const inOut = p => (p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);   // 穏やかな加速と減速（反動なし）
const heavy = p => { const q = inOut(p); return q * q * (3 - 2 * q); };               // 重い扉：立ち上がりをさらに遅く
const sine = p => 0.5 - 0.5 * Math.cos(Math.PI * p);

const T = window.__threshold = { state: root.dataset.entry || 'preparing', runs: 0, quality: '', frames: [], three: null };
function setState(s) { T.state = s; root.dataset.entry = s; }
function say(t) { if (statusEl) statusEl.textContent = t; }
function markEntered() { try { sessionStorage.setItem('hl408:entered', '1'); } catch (e) { /* 保存できなくても入場はできる */ } }
function syncHead() { root.style.setProperty('--headh', (head ? Math.round(head.getBoundingClientRect().height) : 0) + 'px'); }
syncHead();
window.addEventListener('resize', syncHead);

/* =====================================================================
 * 構図（3D のカメラと HTML の文字配置が、同じ計算を使う）
 *   カメラは常に水平・正面向き。扉の見かけの大きさと位置は、距離と横位置・高さで決める
 * =================================================================== */
const DOOR = { W: 2.4, H: 3.6 };
function framing(w, h, band) {
  const aspect = w / h, portrait = aspect < 0.9;
  const fov = portrait ? 50 : 34;
  const tan = Math.tan(fov * Math.PI / 360);
  let frac, ndcX, ndcY;
  if (portrait) {
    frac = h < 700 ? 0.33 : 0.36; ndcX = 0; ndcY = -0.13;
    // スマートフォン：上の文字と下の操作の間に、扉がまるごと収まる大きさと位置にする（文字やボタンに重ねない）
    if (band && band.bottom - band.top > 120) {
      const top = band.top + 22, bottom = band.bottom - Math.max(26, (band.bottom - band.top) * 0.09);
      frac = Math.min(0.46, (bottom - top) / h);
      ndcY = -(((top + bottom) / 2) / h * 2 - 1);
    }
  }
  else { frac = h < 560 ? 0.56 : 0.62; ndcX = aspect > 1.25 ? 0.2 : 0.1; ndcY = -0.02; }
  const d = DOOR.H / (2 * frac * tan);
  const cy = DOOR.H / 2 - ndcY * d * tan;
  const cx = -ndcX * d * tan * aspect;
  // 扉の開口が画面のどこに来るか（HTML の配置に使う）
  const px = X => (0.5 + ((X - cx) / (d * tan * aspect)) / 2) * w;
  const py = Y => (0.5 - ((Y - cy) / (d * tan)) / 2) * h;
  return { portrait, fov, d, cx, cy, aspect, rect: { l: px(-DOOR.W / 2), r: px(DOOR.W / 2), t: py(DOOR.H), b: py(0), horizon: py(cy) } };
}
function applyLayout() {
  const w = sec ? sec.clientWidth || window.innerWidth : window.innerWidth;
  const h = sec ? sec.clientHeight || window.innerHeight : window.innerHeight;
  let band = null;
  const copy = document.querySelector('.th-copy'), acts = document.querySelector('.th-actions');
  if (copy && acts && w / h < 0.9) {
    const top = sec.getBoundingClientRect().top;
    band = { top: copy.getBoundingClientRect().bottom - top, bottom: acts.getBoundingClientRect().top - top };
  }
  const f = framing(w, h, band);
  T.band = band;
  const s = root.style;
  s.setProperty('--door-l', f.rect.l.toFixed(1) + 'px'); s.setProperty('--door-r', f.rect.r.toFixed(1) + 'px');
  s.setProperty('--door-t', f.rect.t.toFixed(1) + 'px'); s.setProperty('--door-b', f.rect.b.toFixed(1) + 'px');
  s.setProperty('--door-w', (f.rect.r - f.rect.l).toFixed(1) + 'px');
  placeStills(f);
  return f;
}
/* 静止画（3D の準備中・代替表示）の扉を、いまの構図の扉の位置にぴったり合わせて置く */
function placeStills(f) {
  if (!f.portrait || !T.band) { T.stillRect = null; document.querySelectorAll('.th-still img').forEach(i => i.removeAttribute('style')); return; }
  const sw = 390, sh = 844, sf = framing(sw, sh);
  const k = (f.rect.b - f.rect.t) / (sf.rect.b - sf.rect.t);
  const st = { width: sw * k + 'px', height: sh * k + 'px', left: (f.rect.l - sf.rect.l * k) + 'px', top: (f.rect.t - sf.rect.t * k) + 'px', right: 'auto', bottom: 'auto', objectFit: 'fill', maxWidth: 'none' };
  document.querySelectorAll('.th-still img').forEach(i => Object.assign(i.style, st));
  T.stillRect = { ...f.rect };
}

/* ---------------- 再訪（同じタブで入場済み） ---------------- */
if (replayBtn) replayBtn.addEventListener('click', () => {
  try { sessionStorage.removeItem('hl408:entered'); } catch (e) {}
  location.reload();
});
if (T.state === 'lobby') {
  if (sec) { sec.hidden = true; sec.inert = true; }
} else if (sec) {
  boot();
}

function boot() {
  applyLayout();
  window.addEventListener('resize', () => { if (T.state !== 'lobby') applyLayout(); });
  enterBtn.addEventListener('click', e => { e.preventDefault(); enter(); });
  // 扉そのものに触れても開く（PC はマウスを乗せると指の形になる）
  const onDoor = e => { const r = doorRect(); return r && e.clientX >= r.l && e.clientX <= r.r && e.clientY >= r.t && e.clientY <= r.b; };
  stage.addEventListener('click', e => { if (onDoor(e)) enter(); });
  stage.addEventListener('pointermove', e => { stage.style.cursor = (onDoor(e) && T.state !== 'entering') ? 'pointer' : ''; });
  // 素材画像は、3D の部品と同時に読み始めておく
  ['wall_albedo', 'wall_normal', 'wall_rough', 'floor_albedo', 'floor_normal', 'floor_rough', 'door_albedo', 'door_normal', 'door_rough'].forEach(n => { const i = new Image(); i.src = ASSET + n + '.webp'; });
  skipBtn.addEventListener('click', () => finalize({ instant: true }));
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && T.state !== 'lobby') { e.preventDefault(); finalize({ instant: true }); } });
  setState('preparing');
  if (!hasWebGL()) { setState('fallback'); return; }
  const timer = new Promise((_, no) => setTimeout(() => no(new Error('timeout')), LOAD_TIMEOUT));
  const mods = Promise.all([
    import('three'),
    import('three/addons/postprocessing/EffectComposer.js'),
    import('three/addons/postprocessing/RenderPass.js'),
    import('three/addons/postprocessing/UnrealBloomPass.js'),
    import('three/addons/postprocessing/ShaderPass.js'),
    import('three/addons/postprocessing/OutputPass.js'),
    import('three/addons/environments/RoomEnvironment.js'),
    import('three/addons/lights/RectAreaLightUniformsLib.js'),
  ]);
  Promise.race([mods.then(m => build(m)), timer])
    .catch(err => { console.warn('入口の3Dを使わずに表示します', err && err.message); T.failed = true; if (T.state === 'preparing') setState('fallback'); });
}

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
  catch (e) { return false; }
}

/* =====================================================================
 * 入場（どの状態からでも一度だけ）
 * =================================================================== */
function enter() {
  if (T.state === 'entering' || T.state === 'lobby') return;
  T.runs++;
  const from = T.state;
  setState('entering');
  enterBtn.classList.add('pressed');
  say(({ en: 'The door is opening', zh: '门正在打开', ko: '문이 열립니다' })[(document.documentElement.lang || 'ja').slice(0, 2)] || '扉がひらきます');
  window.scrollTo(0, 0);
  // 安全網：端末がとても重くても、押してから 7 秒でかならずロビーへ（扉の前で止まらない）
  setTimeout(() => { if (T.state === 'entering' && !T.pending) finalize({ instant: true }); }, 7000);
  if (scene && from === 'waiting') return still() ? playDoorOnly() : playScene();
  if (from === 'preparing') {
    // 3D の準備がまだなら、最大 3 秒だけ待つ（その間も継ぎ目の光は反応している）。間に合わなければ静止画の扉で開く
    T.pending = true;
    const t0 = performance.now();
    const wait = () => {
      if (scene) { T.pending = false; return still() ? playDoorOnly() : playScene(); }
      if (performance.now() - t0 > 3000 || root.dataset.three === 'lost' || T.failed) { T.pending = false; return playCss(); }
      setTimeout(wait, 80);
    };
    return wait();
  }
  playCss();
}

/* ロビーを確定する。入口の層を消し、ロビーの見出しへフォーカスを移す */
let finalized = false;
function finalize({ instant = false, fade = 0 } = {}) {
  if (finalized) return;
  finalized = true;
  cancelAnimationFrame(raf);
  const done = () => {
    setState('lobby');
    markEntered();
    sec.hidden = true; sec.inert = true;
    stage.classList.remove('overlay');
    window.scrollTo(0, 0);
    try { lobbyH.focus({ preventScroll: true }); } catch (e) { lobbyH.focus(); }
    say('');
    stage.hidden = true;
    setTimeout(teardown, 0);   // GPU の後片づけは、ロビーを出したあとで
  };
  if (instant || !fade) return done();
  sec.style.transition = `opacity ${fade}ms ease`; sec.style.opacity = '0';
  setTimeout(done, fade);
}

/* ---------------- 静止画の入口（3D が使えないとき）：静止画の上に CSS の扉を重ねて、実際に開く ----------------
   静止画は framing() と同じ構図で 3D から撮ってある。画面の縦横比が違っても、扉の位置を計算して重ねる */
function stillDoorRect() {
  if (T.stillRect) return T.stillRect;
  const W = sec.clientWidth, H = sec.clientHeight;
  const tall = W / H < 0.9, sw = tall ? 390 : 1600, sh = tall ? 844 : 1000;
  const f = framing(sw, sh), s = Math.max(W / sw, H / sh), ox = (W - sw * s) / 2, oy = (H - sh * s) / 2;
  return { l: f.rect.l * s + ox, r: f.rect.r * s + ox, t: f.rect.t * s + oy, b: f.rect.b * s + oy };
}
function doorRect() {
  if (!sec || sec.hidden) return null;
  if (T.state === 'fallback' || (T.state === 'preparing' && root.dataset.three !== 'ready')) return stillDoorRect();
  const f = framing(sec.clientWidth, sec.clientHeight);
  return f.rect;
}
function playCss() {
  const r = stillDoorRect(), box = sec.querySelector('.cd-leaves');
  if (box) Object.assign(box.style, { left: r.l + 'px', top: r.t + 'px', width: (r.r - r.l) + 'px', height: (r.b - r.t) + 'px' });
  sec.classList.add('css-run');
  requestAnimationFrame(() => requestAnimationFrame(() => sec.classList.add('css-open')));
  setTimeout(() => finalize({ fade: 400 }), still() ? 1500 : 1700);
}
/* 動きを減らす設定：視点は動かさず、扉が開いて光が広がるところだけを見せてからロビーへ */
function playDoorOnly() {
  const S = scene; cancelAnimationFrame(raf); S.planEnd();
  const t0 = performance.now();
  const step = now => {
    if (!scene) return finalize({ instant: true });
    const u = clamp((now - t0) / 1000 * (1.3 / 1.4), 0, 1.3);
    S.pose(u, 0); S.render();
    if (u >= 1.3) return finalize({ fade: 300 });
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}

/* =====================================================================
 * 3D の扉
 * =================================================================== */
let scene = null, raf = 0;

async function build(mods) {
  const S = await makeScene(mods);
  if (T.state !== 'preparing' && !T.pending) { S.dispose(); return; }
  scene = S;
  T.three = S;
  canvas.addEventListener('webglcontextlost', ev => {
    ev.preventDefault();
    scene = null;
    root.dataset.three = 'lost';
    if (T.state === 'entering') finalize({ instant: true });
    else if (T.state !== 'lobby') setState('fallback');
  });
  canvas.style.pointerEvents = 'none';
  S.layout();
  S.pose(0);
  S.render();
  root.dataset.three = 'ready';
  if (T.pending) return;            // 押されて待っている：enter() の待機がこのあと演出を始める
  setState('waiting');
  waitLoop();
}

/* 待機中：継ぎ目の光がゆっくり呼吸する（動きを減らす設定では止める）。
   最初の約1.2秒は毎フレーム描いて、フレームの間隔（実測）から描画の重さを判断し、重ければ軽量表示へ */
function waitLoop() {
  let last = 0, prev = 0; const t0 = performance.now(); const gaps = [];
  const forced = window.__TH_QUALITY;
  if (forced) { T.quality = forced; if (forced === 'light') { scene.lighten(); scene.render(); } }
  if (window.__TH_NOLOOP) return;          // 検証用：画面を止めて撮るとき
  if (still() && !forced) { T.quality = 'still'; return; }   // 動きを減らす設定：描き続けない（1枚描いて止める）
  const step = now => {
    if (T.state !== 'waiting' || !scene) return;
    raf = requestAnimationFrame(step);
    if (document.hidden) { last = 0; prev = 0; return; }
    if (!T.quality) {
      if (prev) gaps.push(now - prev);
      prev = now;
      scene.breathe((now - t0) / 1000); scene.render();
      const slow = gaps.length >= 2 && gaps[gaps.length - 1] > 120 && gaps[gaps.length - 2] > 120;   // 2 コマ続けて極端に遅ければ、待たずに軽量へ
      if (slow || (gaps.length >= 10 && (now - t0 > 1200 || gaps.length >= 40))) {
        gaps.sort((a, b) => a - b);
        T.probeMs = Math.round(gaps[gaps.length >> 1] * 10) / 10;      // フレーム間隔の中央値（ms）
        T.quality = T.probeMs > 26 ? 'light' : 'standard';
        if (T.quality === 'light') { scene.lighten(); scene.render(); }
      }
      return;
    }
    if (still()) return;
    if (now - last < 50) return;     // 待機中は 20fps で十分（電池と発熱を抑える）
    last = now;
    scene.breathe((now - t0) / 1000);
    scene.render();
  };
  raf = requestAnimationFrame(step);
}

/* 入場の演出 */
function playScene() {
  const S = scene;
  cancelAnimationFrame(raf);
  S.planEnd();
  stage.classList.add('overlay');      // ロビーへ受け渡す間、同じ位置に重ねて残す
  const total = S.portrait ? 2.4 : 2.5;   // スマートフォンでも扉が開くのを目で追える長さ
  const t0 = performance.now();
  let handed = false, prev = t0;
  T.frames = [];
  const step = now => {
    if (!scene) return;
    const u = clamp((now - t0) / 1000 * (2.2 / total), 0, 2.2);
    T.frames.push(now - prev); prev = now;
    S.pose(u);
    S.render();
    if (u >= 1.7 && !S.sampled) S.sampleLobby();
    if (u >= 1.85 && !handed) {       // ロビーの HTML を下に用意し、3D を少しずつ透明に
      handed = true;
      document.body.appendChild(stage);   // 入口の層を消す前に、3D の画面だけを外へ出して重ねたまま残す
      setState('lobby'); markEntered();
      sec.hidden = true; sec.inert = true;
      window.scrollTo(0, 0);
      try { lobbyH.focus({ preventScroll: true }); } catch (e) {}
    }
    if (handed) stage.style.opacity = String(1 - sine(clamp((u - 1.85) / 0.35)));
    if (u >= 2.2) { finalized = true; stage.classList.remove('overlay'); stage.style.opacity = ''; say(''); teardown(); return; }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}

/* 入場後：描画ループと GPU の資源を手放す */
function teardown() {
  cancelAnimationFrame(raf);
  if (scene) { scene.dispose(); scene = null; }
  stage.hidden = true;
}

/* 検証用：タイムラインの任意の時点で止めて描く（半開きの画面の確認など） */
T.seek = (u, camP) => { if (!scene) return false; cancelAnimationFrame(raf); scene.planEnd(); scene.pose(u, camP); scene.render(); return true; };
T.enter = enter;

/* =====================================================================
 * シーン（単位：メートル）
 *   外の壁の表面 z=0、壁の厚み（開口の奥行き）0.5。扉は壁の内側の面のすぐ奥に収まる
 *   開口 幅2.4 × 高さ3.6（2:3）。扉は2枚、厚み0.09。それぞれ外側の縦辺（x=±1.2）を軸に、室内（-z）へ90度開く
 *   扉の奥は奥行き2.4の前室、その先に天窓のある展示室（幅9 × 奥行き10 × 高さ5.6）
 * =================================================================== */
async function makeScene(m) {
  const [THREE, { EffectComposer }, { RenderPass }, { UnrealBloomPass }, { ShaderPass }, { OutputPass }, { RoomEnvironment }, { RectAreaLightUniformsLib }] = m;
  const W = DOOR.W, H = DOOR.H, D = 0.5, TH = 0.09, GAP = 0.008, UNDER = 0.012, OPEN = THREE.MathUtils.degToRad(90);
  const VEST = { x: 1.27, z0: -D - TH, z1: -D - TH - 2.4, h: 3.8 };
  const ROOM = { x: 4.5, z0: VEST.z1, z1: VEST.z1 - 10, h: 5.6 };
  const disposables = [];
  const keep = x => (disposables.push(x), x);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  RectAreaLightUniformsLib.init();
  const scene3 = new THREE.Scene();
  scene3.background = new THREE.Color(0xd9d5cd);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 80);

  /* ---- 素材（tools/gen-textures.py で作った画像）。読めなくても、色だけで描ける ---- */
  const loader = new THREE.TextureLoader();
  const tex = (name, srgb, rx = 1, ry = 1) => new Promise(ok => {
    loader.load(ASSET + name, t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); if (srgb) t.colorSpace = THREE.SRGBColorSpace; keep(t); ok(t); }, undefined, () => ok(null));
  });
  const [wallA, wallN, wallR, floorA, floorN, floorR, doorA, doorN, doorR] = await Promise.all([
    tex('wall_albedo.webp', true), tex('wall_normal.webp'), tex('wall_rough.webp'),
    tex('floor_albedo.webp', true), tex('floor_normal.webp'), tex('floor_rough.webp'),
    tex('door_albedo.webp', true), tex('door_normal.webp'), tex('door_rough.webp'),
  ]);
  T.texturesLoaded = [wallA, floorA, doorA].filter(Boolean).length;

  /* ---- 映り込み用の周囲（一度だけ焼く） ---- */
  const pmrem = keep(new THREE.PMREMGenerator(renderer));
  const envRT = keep(pmrem.fromScene(new RoomEnvironment(renderer), 0.04));
  scene3.environment = envRT.texture;

  /* ---- 材質 ---- */
  // 壁：打ち放しコンクリート。画像 1 枚 = 3.6m × 1.8m（世界座標で貼る）
  const concrete = (opts = {}) => keep(new THREE.MeshStandardMaterial({ color: 0xffffff, map: wallA, normalMap: wallN, normalScale: new THREE.Vector2(0.42, 0.42), roughnessMap: wallR, roughness: 1, metalness: 0, envMapIntensity: 0.08, ...opts }));
  const wallMat = concrete();
  const floorMat = keep(new THREE.MeshStandardMaterial({ color: 0x9c978f, map: floorA, normalMap: floorN, normalScale: new THREE.Vector2(0.5, 0.5), roughnessMap: floorR, roughness: 1, metalness: 0, envMapIntensity: 0.55 }));
  const doorMat = keep(new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: doorA, normalMap: doorN, normalScale: new THREE.Vector2(0.25, 0.25), roughnessMap: doorR, roughness: 1, metalness: 0.35, clearcoat: 0, envMapIntensity: 0.4 }));
  doorMat.color.setScalar(1.9);   // 日の当たる部分と影の差が読める明るさに
  if (!doorA) doorMat.color.set(0x3a3d41);
  const roomMat = keep(new THREE.MeshStandardMaterial({ color: 0xe6e2da, roughness: 0.96, metalness: 0, envMapIntensity: 0.12 }));

  // 箱や板の UV を「世界の長さ（m）÷ 画像の長さ」にそろえる。面ごとに正しい向きで貼る
  function worldUV(geo, sx = 3.6, sy = 1.8) {
    geo.computeBoundingBox();
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
      let u, v;
      if (az >= ax && az >= ay) { u = x; v = y; } else if (ax >= ay) { u = z; v = y; } else { u = x; v = z; }
      uv.setXY(i, u / sx, v / sy);
    }
    uv.needsUpdate = true;
    return geo;
  }
  const mesh = (geo, mat, pos, opts = {}) => { const o = new THREE.Mesh(keep(geo), mat); o.position.set(...pos); if (opts.rot) o.rotation.set(...opts.rot); o.castShadow = opts.cast !== false; o.receiveShadow = true; scene3.add(o); return o; };
  const box = (sx, sy, sz, mat, cx, cy, cz, uvs) => { const g = new THREE.BoxGeometry(sx, sy, sz); g.translate(cx, cy, cz); worldUV(g, ...(uvs || [])); return mesh(g, mat, [0, 0, 0]); };

  /* ---- 外の壁（厚み 0.5 の一枚。開口は 2.4 × 3.6） ---- */
  const WALL_W = 30, WALL_H = 12;
  box(WALL_W / 2 - W / 2, WALL_H, D, wallMat, -(W / 2 + (WALL_W / 2 - W / 2) / 2), WALL_H / 2, -D / 2);
  box(WALL_W / 2 - W / 2, WALL_H, D, wallMat, (W / 2 + (WALL_W / 2 - W / 2) / 2), WALL_H / 2, -D / 2);
  box(W, WALL_H - H, D, wallMat, 0, H + (WALL_H - H) / 2, -D / 2);

  /* ---- 床（外・敷居・前室・展示室がひと続き） ---- */
  const floorGeo = new THREE.PlaneGeometry(40, 40); floorGeo.rotateX(-Math.PI / 2); floorGeo.translate(0, 0, 4);
  { const uv = floorGeo.attributes.uv, pos = floorGeo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 2.4, pos.getZ(i) / 2.4); }
  const floor = mesh(floorGeo, floorMat, [0, 0, 0], { cast: false });
  // 敷居：少しだけ明るい石の一枚板
  const sillMat = keep(new THREE.MeshStandardMaterial({ color: 0xcfcac0, roughness: 0.38, metalness: 0, envMapIntensity: 0.7 }));
  box(W, 0.012, D + TH + 0.02, sillMat, 0, 0.006, -(D + TH) / 2);

  /* ---- 前室（扉の奥。開いた扉はこの両側の壁に沿って止まる） ---- */
  // 前室の壁は、奥からの光をかすめて受けるので、ぎらつく反射の出ない材質にする
  const vestMat = keep(new THREE.MeshLambertMaterial({ color: 0xffffff, map: wallA, normalMap: wallN, normalScale: new THREE.Vector2(0.9, 0.9) }));
  box(0.4, VEST.h, VEST.z0 - VEST.z1, vestMat, -VEST.x - 0.2, VEST.h / 2, (VEST.z0 + VEST.z1) / 2);
  box(0.4, VEST.h, VEST.z0 - VEST.z1, vestMat, VEST.x + 0.2, VEST.h / 2, (VEST.z0 + VEST.z1) / 2);
  box(VEST.x * 2 + 0.8, 0.4, VEST.z0 - VEST.z1, vestMat, 0, VEST.h + 0.2, (VEST.z0 + VEST.z1) / 2);
  // 前室の天井と外の壁の間（開口の上の、扉の奥側の面）
  box(VEST.x * 2 + 0.8, VEST.h - H + 0.4, 0.05, vestMat, 0, H + (VEST.h - H + 0.4) / 2, -D - 0.025);

  /* ---- 展示室（天窓の光） ---- */
  const rz = (ROOM.z0 + ROOM.z1) / 2, rl = ROOM.z0 - ROOM.z1;
  const wallR_ = (geo, pos, rot) => mesh(geo, roomMat, pos, { rot, cast: false });
  wallR_(new THREE.PlaneGeometry(rl, ROOM.h), [-ROOM.x, ROOM.h / 2, rz], [0, Math.PI / 2, 0]);
  wallR_(new THREE.PlaneGeometry(rl, ROOM.h), [ROOM.x, ROOM.h / 2, rz], [0, -Math.PI / 2, 0]);
  wallR_(new THREE.PlaneGeometry(ROOM.x * 2, ROOM.h), [0, ROOM.h / 2, ROOM.z1], [0, 0, 0]);
  // 展示室の手前の壁（前室への口の左右と上）
  wallR_(new THREE.PlaneGeometry(ROOM.x - VEST.x, ROOM.h), [-(VEST.x + ROOM.x) / 2, ROOM.h / 2, ROOM.z0], [0, Math.PI, 0]);
  wallR_(new THREE.PlaneGeometry(ROOM.x - VEST.x, ROOM.h), [(VEST.x + ROOM.x) / 2, ROOM.h / 2, ROOM.z0], [0, Math.PI, 0]);
  // 天井：中央に細長い天窓（光の面）。天窓の縁は深く切り込む
  const ceilMat = keep(new THREE.MeshStandardMaterial({ color: 0xe6e2da, roughness: 1 }));
  const SKY = { w: 1.6, l: 8.4 };
  const ceil = (w, l, x) => mesh(new THREE.PlaneGeometry(w, l), ceilMat, [x, ROOM.h, rz], { rot: [Math.PI / 2, 0, 0], cast: false });
  ceil(ROOM.x - SKY.w / 2, rl, -(SKY.w / 2 + (ROOM.x - SKY.w / 2) / 2));
  ceil(ROOM.x - SKY.w / 2, rl, (SKY.w / 2 + (ROOM.x - SKY.w / 2) / 2));
  const skyMat = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff8ea).multiplyScalar(2.2) }));
  mesh(new THREE.PlaneGeometry(SKY.w, SKY.l), skyMat, [0, ROOM.h + 0.6, rz], { rot: [Math.PI / 2, 0, 0], cast: false });
  const wellMat = keep(new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 1, emissive: 0xfff6e4, emissiveIntensity: 0.35 }));
  mesh(new THREE.PlaneGeometry(SKY.l, 0.6), wellMat, [-SKY.w / 2, ROOM.h + 0.3, rz], { rot: [0, Math.PI / 2, 0], cast: false });
  mesh(new THREE.PlaneGeometry(SKY.l, 0.6), wellMat, [SKY.w / 2, ROOM.h + 0.3, rz], { rot: [0, -Math.PI / 2, 0], cast: false });
  const skyLight = new THREE.RectAreaLight(0xfff4e2, 4.2, SKY.w, SKY.l);
  skyLight.position.set(0, ROOM.h - 0.01, rz); skyLight.rotation.x = -Math.PI / 2; scene3.add(skyLight);

  /* ---- 作品：奥の壁に VOICE BLOOM（ロビーの HTML と同じ画像）。左右の壁に収蔵作品の画面 ---- */
  const PH = 2.2, PW = PH * 1054 / 1492, PY = 1.95;
  const frameMat = keep(new THREE.MeshStandardMaterial({ color: 0x1d1f21, roughness: 0.5, metalness: 0.3 }));
  function hang(w, h, x, y, z, rotY, src) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; scene3.add(g);
    const back = new THREE.Mesh(keep(new THREE.BoxGeometry(w + 0.04, h + 0.04, 0.035)), frameMat); back.position.z = 0.0175; back.castShadow = true; back.receiveShadow = true; g.add(back);
    const mat = keep(new THREE.MeshStandardMaterial({ color: 0x0b2349, roughness: 0.55, metalness: 0, envMapIntensity: 0.2 }));
    const face = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, h)), mat); face.position.z = 0.036; g.add(face);
    if (src) loader.load(src, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; keep(t); mat.map = t; mat.color.set(0xffffff); mat.needsUpdate = true; if (T.state === 'waiting' && scene) scene.render(); });
    return g;
  }
  hang(PW, PH, 0, PY, ROOM.z1, 0, poster ? (poster.currentSrc || poster.src) : null);
  const side = (window.__LOBBY_SIDE__ || []).slice(0, 4);
  side.forEach((src, i) => {
    const left = i % 2 === 0, k = i >> 1;
    hang(1.5, 0.94, left ? -ROOM.x + 0.001 : ROOM.x - 0.001, 1.75, ROOM.z0 - 3.2 - k * 3.4, left ? Math.PI / 2 : -Math.PI / 2, src);
  });
  // 作品を照らすスポット（天井から、壁に丸い光だまり）
  const pin = new THREE.SpotLight(0xfff2dc, 22, 0, 0.3, 0.8, 1.6);
  pin.position.set(0, ROOM.h - 0.1, ROOM.z1 + 3.4); pin.target.position.set(0, PY, ROOM.z1); scene3.add(pin, pin.target);

  /* ---- 二枚の扉（面取りのある厚い金属の板） ---- */
  const leafW = W / 2 - GAP / 2, bevel = 0.008, leafH = H - UNDER - 0.004;
  const ls = new THREE.Shape(); ls.moveTo(bevel, bevel); ls.lineTo(leafW - bevel, bevel); ls.lineTo(leafW - bevel, leafH - bevel); ls.lineTo(bevel, leafH - bevel); ls.lineTo(bevel, bevel);
  const leafGeo = keep(new THREE.ExtrudeGeometry(ls, { depth: TH - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 1 }));
  { const uv = leafGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / leafW, uv.getY(i) / leafH); }
  const pullMat = keep(new THREE.MeshPhysicalMaterial({ color: 0x8d9094, metalness: 1, roughness: 0.28, envMapIntensity: 1.2 }));
  const pullGeo = keep(new THREE.BoxGeometry(0.022, 1.1, 0.026));
  const standGeo = keep(new THREE.BoxGeometry(0.014, 0.014, 0.05));
  function leaf(sideK) {           // sideK: -1 左（軸 x=-1.2）、+1 右（軸 x=+1.2）
    const pivot = new THREE.Group();
    pivot.position.set(sideK * W / 2, UNDER, -D - TH);     // 軸は扉の室内側の角。開いた扉が壁にめり込まない
    const m = new THREE.Mesh(leafGeo, doorMat);
    m.position.set(sideK < 0 ? 0 : -leafW, 0, bevel);     // 板の原点は外側の角。厚みは軸から手前（+z）へ
    m.castShadow = true; m.receiveShadow = true;
    pivot.add(m);
    const px = sideK < 0 ? leafW - 0.15 : -leafW + 0.15;
    const pull = new THREE.Mesh(pullGeo, pullMat); pull.position.set(px, 1.5, TH + 0.045); pull.castShadow = true; pivot.add(pull);
    for (const dy of [-0.45, 0.45]) { const s = new THREE.Mesh(standGeo, pullMat); s.position.set(px, 1.5 + dy, TH + 0.02); pivot.add(s); }
    scene3.add(pivot);
    return pivot;
  }
  const L = leaf(-1), R = leaf(1);
  // 閉じている間、合わせ目のすき間から奥の光が床に長く伸びないよう、影だけを落とす見えない板（開き始めたら外す）
  const seamBlock = new THREE.Mesh(keep(new THREE.BoxGeometry(GAP * 3, H, TH)), keep(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })));
  seamBlock.position.set(0, H / 2, -D - TH / 2); seamBlock.castShadow = true; scene3.add(seamBlock);

  /* ---- 光 ---- */
  const hemi = new THREE.HemisphereLight(0xf2efe8, 0x8a857b, 0.42); scene3.add(hemi);
  // 太陽：左上前から壁をかすめる（コンクリートの凹凸と、開口の深い影を出す）
  const sun = new THREE.DirectionalLight(0xffeed6, 5.2);
  sun.position.set(-9, 8, 5); sun.target.position.set(0.4, 1.6, -0.5);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -5, near: 2, far: 30 });
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.025; sun.shadow.radius = 4;
  scene3.add(sun, sun.target);
  // 展示室から開口を通って外へ向かう光（扉の影の形のまま、床へ広がる）
  const spill = new THREE.SpotLight(0xf6e7bf, 150, 0, 0.3, 0.5, 1.35);
  spill.position.set(0, 4.3, ROOM.z0 - 6.0); spill.target.position.set(0, 0, 4.5);
  spill.castShadow = true; spill.shadow.mapSize.set(1024, 1024); spill.shadow.bias = -0.0004; spill.shadow.normalBias = 0.02; spill.shadow.camera.near = 0.5; spill.shadow.camera.far = 16; spill.shadow.radius = 9;
  scene3.add(spill, spill.target);
  // 前室を満たす光（展示室の光の回り込みの近似。影なし）
  const vestFill = new THREE.PointLight(0xfff3dc, 0, 6, 1.5); vestFill.position.set(0, 2.2, VEST.z1 + 0.6); scene3.add(vestFill);

  /* ---- 継ぎ目と扉の下から漏れる光（細い光の面） ---- */
  const seamTex = keep(new THREE.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = 64; c.height = 4; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 4); return c; })()));
  const seamCore = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff2cf).multiplyScalar(5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const seamHalo = keep(new THREE.MeshBasicMaterial({ map: seamTex, color: new THREE.Color(0xf1e5bc).multiplyScalar(0.9), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const seam = new THREE.Mesh(keep(new THREE.PlaneGeometry(GAP * 0.9, H - 0.02)), seamCore); seam.position.set(0, H / 2, -D + 0.002); scene3.add(seam);
  const halo = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.16, H - 0.02)), seamHalo); halo.position.set(0, H / 2, -D + 0.004); scene3.add(halo);
  const underCore = new THREE.Mesh(keep(new THREE.PlaneGeometry(W - 0.02, UNDER * 0.8)), seamCore); underCore.position.set(0, UNDER * 0.5, -D + 0.002); scene3.add(underCore);
  // 床：継ぎ目の下からの細い光と、軽量表示で使う「開口に合わせて広がる光」（どちらも開く角度と同じ値で動く）
  const floorLightMat = keep(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: true,
    uniforms: { uOpen: { value: 0 }, uSeam: { value: 0.8 }, uWedge: { value: 0 }, uColor: { value: new THREE.Color(0xf1e5bc) } },
    vertexShader: 'varying vec2 vP; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vP = vec2(w.x, w.z); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uOpen; uniform float uSeam; uniform float uWedge; uniform vec3 uColor; varying vec2 vP;
      void main(){
        float zp = max(vP.y + ${D.toFixed(3)}, 0.0);
        // 閉じているとき：継ぎ目の真下から、細く短い光の筋と、扉の下のすき間に沿った薄い帯
        float seamLine = exp(-abs(vP.x) / (0.006 + zp * 0.05)) * exp(-zp * 2.2);
        float under = (1.0 - smoothstep(${(W / 2 - 0.05).toFixed(3)}, ${(W / 2).toFixed(3)}, abs(vP.x))) * exp(-zp * 26.0);
        float closedI = (seamLine * 1.6 + under * 0.5) * uSeam * (1.0 - uOpen);
        // 軽量表示：開口の幅から扇形に広がる光（影の計算の代わり）
        float halfW = uOpen * ${(W / 2).toFixed(3)} + zp * (0.05 + uOpen * 0.32);
        float edge = 0.03 + zp * 0.12;
        float wedge = (1.0 - smoothstep(halfW - edge, halfW + edge, abs(vP.x))) * exp(-zp * 0.42) * uOpen * uWedge * 1.6;
        gl_FragColor = vec4(uColor * (closedI + wedge), 1.0);
      }`,
  }));
  const floorLight = new THREE.Mesh(keep(new THREE.PlaneGeometry(10, 9)), floorLightMat);
  floorLight.rotation.x = -Math.PI / 2; floorLight.position.set(0, 0.0045, -D + 4.5); scene3.add(floorLight);
  // 壁の足元のやわらかな接地影
  const aoTex = keep(new THREE.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = 4; c.height = 128; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(30,26,20,.38)'); gr.addColorStop(1, 'rgba(30,26,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 128); return c; })()));
  const aoMat = keep(new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false }));
  for (const sx of [-1, 1]) { const a = new THREE.Mesh(keep(new THREE.PlaneGeometry(WALL_W / 2 - W / 2, 0.7)), aoMat); a.rotation.x = -Math.PI / 2; a.position.set(sx * (W / 2 + (WALL_W / 2 - W / 2) / 2), 0.003, 0.35); scene3.add(a); }

  /* ---- 仕上げ：控えめなにじみ（明るい所だけ）と、周辺のわずかな減光・粒子感 ---- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene3, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.22, 0.45, 1.05);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const finish = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.22 }, uGrain: { value: 0.028 }, uAspect: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uVig, uGrain, uAspect; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
        float v = 1.0 - uVig * smoothstep(0.35, 1.05, length(q));
        float g = (h(vUv * 1024.0 + uTime) - 0.5) * uGrain;
        gl_FragColor = vec4(c.rgb * v + g, c.a);
      }`,
  });
  composer.addPass(finish);
  let useComposer = true;

  /* ---- 構図 ---- */
  const cam = { start: new THREE.Vector3(), end: new THREE.Vector3(), fov: 34, curve: null, par: new THREE.Vector2() };
  const api = { portrait: false, sampled: false };
  let dprCap = 2;
  function layout() {
    const f = applyLayout();
    const w = stage.clientWidth || window.innerWidth, h = stage.clientHeight || window.innerHeight;
    api.portrait = f.portrait;
    dprCap = T.quality === 'light' ? 1 : (f.portrait ? 1.5 : 2);
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    composer.setPixelRatio(dpr); composer.setSize(w, h);
    bloom.resolution.set(w / 2, h / 2);
    finish.uniforms.uAspect.value = w / h;
    camera.aspect = w / h; camera.fov = f.fov; cam.fov = f.fov; camera.updateProjectionMatrix();
    cam.start.set(f.cx, f.cy, f.d);
    sun.shadow.mapSize.set(f.portrait ? 1024 : 2048, f.portrait ? 1024 : 2048);
  }
  /* 入場の終点：ロビーの HTML でポスターが表示される位置・大きさに、3D のポスターが重なる場所 */
  function planEnd() {
    const w = stage.clientWidth, h = stage.clientHeight;
    const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), aspect = w / h;
    let ok = false;
    if (poster && lobby) {
      const pr = poster.getBoundingClientRect(), lr = lobby.getBoundingClientRect();
      const top = pr.top - lr.top, left = pr.left - lr.left;
      if (pr.height > 20 && top + pr.height < h + 40) {
        const d = PH * h / (2 * tanH * pr.height);
        const ndcX = ((left + pr.width / 2) / w) * 2 - 1, ndcY = 1 - ((top + pr.height / 2) / h) * 2;
        const cx = -ndcX * d * tanH * aspect, cy = PY - ndcY * d * tanH;
        if (d > 1.5 && d < rl - 0.6 && Math.abs(cx) < ROOM.x - 0.8 && cy > 0.4 && cy < ROOM.h - 0.6) { cam.end.set(cx, cy, ROOM.z1 + 0.036 + d); ok = true; }
      }
    }
    if (!ok) cam.end.set(0, PY, ROOM.z1 + 5.5);
    // 経路：正面のまま開口の中心線に寄り、敷居を越え、前室を抜けて展示室の立ち位置へ
    const eye = Math.min(cam.start.y, 1.75);
    cam.curve = new THREE.CatmullRomCurve3([
      cam.start.clone(),
      new THREE.Vector3(cam.start.x * 0.35, lerp(cam.start.y, eye, 0.6), cam.start.z * 0.45),
      new THREE.Vector3(0, eye, 0.9),
      new THREE.Vector3(0, eye, VEST.z1 + 0.2),
      cam.end.clone(),
    ], false, 'centripetal');
    T.camEnd = cam.end.toArray().map(v => Math.round(v * 100) / 100);
  }
  /* 進行値 u（0〜2.2）から、すべての動きを決める */
  let seamBreath = 1, timeSec = 0;
  const tmp = new THREE.Vector3();
  function pose(u, camOverride) {
    const react = clamp(u / 0.12);
    const doorP = heavy(clamp((u - 0.12) / (1.30 - 0.12)));
    const ang = OPEN * doorP;
    L.rotation.y = ang;            // 左：+y 回転で自由端が -z（室内）へ
    R.rotation.y = -ang;           // 右：-y 回転で自由端が -z（室内）へ
    const open = 1 - Math.cos(ang);    // 開口の幅の割合（0〜1）
    const pulse = u > 0 ? 1 + 0.9 * Math.sin(Math.PI * react) * (u < 0.3 ? 1 : 0) : 1;
    const seamLevel = (0.7 + 0.3 * seamBreath) * pulse * clamp(1 - open * 8);
    seamCore.opacity = seamLevel; seamHalo.opacity = seamLevel * 0.85;
    floorLightMat.uniforms.uOpen.value = open;
    seamBlock.castShadow = open < 0.004;
    floorLightMat.uniforms.uSeam.value = (0.7 + 0.3 * seamBreath) * pulse;
    vestFill.intensity = 0;
    const camP = camOverride != null ? camOverride : inOut(clamp((u - 0.95) / (1.85 - 0.95)));
    if (camP <= 0 || !cam.curve) camera.position.copy(cam.start);
    else cam.curve.getPoint(camP, camera.position);
    camera.position.x += cam.par.x * (1 - camP); camera.position.y += cam.par.y * (1 - camP);
    camera.rotation.set(0, 0, 0);    // 視線は常に正面。水平線を回さない
    T.u = u; T.angle = Math.round(THREE.MathUtils.radToDeg(ang) * 10) / 10; T.open = Math.round(open * 1000) / 1000;
    T.cam = camera.position.toArray().map(v => Math.round(v * 100) / 100);
  }
  api.layout = layout;
  api.planEnd = planEnd;
  api.pose = pose;
  api.render = () => {
    finish.uniforms.uTime.value = still() ? 0 : (timeSec % 10);
    if (useComposer) composer.render(); else renderer.render(scene3, camera);
  };
  api.breathe = t => { timeSec = t; seamBreath = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 / 5.5); pose(0); };
  /* 軽量表示：影と仕上げをやめ、解像度を 1 倍に。床の光は近似の扇形で出す */
  api.lighten = () => {
    useComposer = false;
    renderer.shadowMap.enabled = false;
    sun.castShadow = false; spill.castShadow = false; spill.intensity = 0;
    floorLightMat.uniforms.uWedge.value = 1;
    scene3.traverse(o => { if (o.material) o.material.needsUpdate = true; });
    T.quality = 'light';
    layout();
  };
  /* ロビーの背景色を、3D の展示室の壁の色に合わせる（入場の終わりに 1 回だけ読む） */
  api.sampleLobby = () => {
    api.sampled = true;
    try {
      const gl = renderer.getContext(), c = canvas;
      const read = (fx, fy) => { const px = new Uint8Array(4); gl.readPixels(Math.round(c.width * fx), Math.round(c.height * (1 - fy)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
      // ポスターの横の壁（周辺の減光がかからない位置）を 2 点読む
      const pr = poster.getBoundingClientRect(), W = window.innerWidth, Hh = window.innerHeight;
      const right = pr.right / W, left = pr.left / W;
      const fx = (1 - right) > left ? right + (1 - right) * 0.35 : left * 0.65;
      const a = read(fx, clamp((pr.top + pr.height * 0.25) / Hh, 0.1, 0.9)), b = read(fx, clamp((pr.top + pr.height * 0.9) / Hh, 0.1, 0.9));
      if (a[3] && b[3]) {
        // 読んだ色を、展示室の基準色（#ECE8E1）と半々に混ぜる（光の当たり方で暗く読みすぎないように）
        const base = [236, 232, 225];
        const rgb = p => `rgb(${Math.round((p[0] + base[0]) / 2)},${Math.round((p[1] + base[1]) / 2)},${Math.round((p[2] + base[2]) / 2)})`;
        root.style.setProperty('--lobby-top', rgb(a)); root.style.setProperty('--lobby-bottom', rgb(b));
        T.lobbyColors = [rgb(a), rgb(b)];
      }
    } catch (e) { /* 読めなくても、決めておいた色のまま */ }
  };
  api.parallax = (x, y) => { cam.par.set(x * 0.18, -y * 0.08); };
  api.dispose = () => {
    disposables.forEach(d => { try { d.dispose(); } catch (e) {} });
    scene3.traverse(o => { if (o.isMesh && o.material && o.material.dispose) o.material.dispose(); });
    try { composer.dispose(); } catch (e) {}
    renderer.dispose();
    try { renderer.forceContextLoss(); } catch (e) {}
  };
  api.renderer = renderer; api.scene3 = scene3;

  window.addEventListener('resize', () => { if (!scene || T.state === 'lobby') return; layout(); if (T.state !== 'entering') { pose(0); api.render(); } });
  // マウスのある端末だけ、ごく小さな視差（タッチ端末では使わない）
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.addEventListener('pointermove', e => {
      if (!scene || T.state !== 'waiting' || still()) return;
      api.parallax(e.clientX / window.innerWidth - .5, e.clientY / window.innerHeight - .5);
    }, { passive: true });
  }
  return api;
}
