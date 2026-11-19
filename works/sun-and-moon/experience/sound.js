/* SUN & MOON — インタラクティブ・サウンド（144通りの音の世界）
   音源ファイルは使わず、Web Audio でその場で合成する（著作権の心配なし・追加ファイルなし）。

   ■ 144通りの作り方（重ならず・漏れなく）
     SUN（12枚）＝ 前景：旋律の「動き」… 音型・リズム・音色・テンポの上げ下げ
     MOON（12枚）＝ 背景：「場」……………… 旋法・和音進行・和音の積み方・低音・響きの広さ・こだま・テンポ
     組み合わせ ＝ 調（キー）とテンポが決まり、その2枚だけの短い旋律（モチーフ）が生まれる
       … SUNのモチーフ型 × MOONの旋法 × 調 × 組み合わせ番号から作るので、144通りすべて違う

   ■ 進行に合わせた展開（横の遷移）と、楽器の足し引き（縦の遷移）
     intro   表紙。リズムのない和音（どこで切り替えても違和感がない）
     select0 カード未選択。低い鼓動
     select1 1枚選んだ。そのカードの「層」だけが鳴る（SUNなら旋律、MOONなら和音の世界）
     ready   2枚そろった。組み合わせの世界に切り替わり、モチーフが一度鳴る。刻みが入る（Pre-end）
     eclipse 日食。組み合わせの調で8拍かけて高まり、ダイヤモンドリングで「曲が終わる」
     silence 終わった直後の無音（間）
     glow    作品を読む時間。組み合わせの世界を静かに。モチーフが4小節ごとに戻ってくる

   ■ 切り替えのタイミング：表紙・余韻は即時／選択中は次の拍／選び直しは次の小節／ECLIPSEは押した音で隠して即時
   ■ 終わり方：最後まで→終止の和音で終わる／前半でスキップ→静かに余韻へ／後半でスキップ→その場で終止
   ■ 飽き対策：同じ型でも毎回少しずつ間引き・強弱が変わる
   ブラウザの決まりで、最初のタップ（「カードをひらく」など）から鳴り始める。 */
(function () {
  'use strict';
  var KEY = 'sunmoon.sound';
  var enabled = true;
  try { enabled = localStorage.getItem(KEY) !== 'off'; } catch (e) {}

  /* ===================== 1. 音の設計表 ===================== */
  var MODES = {
    ionian:     [0, 2, 4, 5, 7, 9, 11],   // 明るく安定
    lydian:     [0, 2, 4, 6, 7, 9, 11],   // 浮遊感
    mixolydian: [0, 2, 4, 5, 7, 9, 10],   // 解決しきらない明るさ
    dorian:     [0, 2, 3, 5, 7, 9, 10]    // 明るくも暗くもない
  };
  /* SUN：前景（旋律の動き）。r=1小節を16分割したリズム（2=強、1=弱）、c=音の選び方、mot=モチーフの音の動き（音階の段） */
  var SUNS = {
    '01': { n: 'のぼっていく分散和音',     wave: 'triangle', oct: 0,   r: [2,0,1,0,1,0,1,0,2,0,1,0,1,0,1,0], c: [0,1,2,3,4,5,6,7], bpm: 4,  len: .5,  mot: [1, 1, 1, 2, -1, 1] },
    '02': { n: 'たたみかける16分音符',     wave: 'sawtooth', oct: 0,   r: [2,1,1,1,2,1,1,1,2,1,1,1,2,1,1,1], c: [0,0,2,2,1,1,3,3], bpm: 8,  len: .2,  mot: [0, 1, 0, 1, 2, 1] },
    '03': { n: 'はずむシンコペーション',   wave: 'bell',     oct: 0,   r: [2,0,0,1,0,0,1,0,2,0,0,1,0,0,1,0], c: [0,4,2,4,1,4,3,4], bpm: 6,  len: .6,  mot: [2, -1, 2, -1, 3, -2] },
    '04': { n: 'そっと降りてくる旋律',     wave: 'sine',     oct: 0,   r: [2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], c: [7,6,5,4,3,2,1,0], bpm: 0,  len: 1.3, mot: [-1, -1, -2, -1, 1, -1] },
    '05': { n: '低く歩く支えの線',         wave: 'triangle', oct: -12, r: [2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0], c: [0,1,2,1,0,2,4,2], bpm: -2, len: .8,  mot: [1, 1, -1, 1, 1, -2] },
    '06': { n: '力強く鳴る5度の響き',     wave: 'square',   oct: -12, r: [2,0,0,0,0,0,0,0,2,0,0,0,0,0,1,0], c: [0,0,2,0,0,2,0,4], bpm: 0,  len: 1.0, mot: [4, -2, 0, 3, -3, 2], fifth: true },
    '07': { n: '鋭く刻む裏拍',             wave: 'sawtooth', oct: 0,   r: [0,0,1,0,0,0,1,1,0,0,1,0,0,1,1,0], c: [0,1,0,2,0,1,0,3], bpm: 10, len: .16, mot: [1, -1, 1, 3, -2, -1] },
    '08': { n: 'くり返し整う反復音型',     wave: 'sine',     oct: 0,   r: [1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,0], c: [0,2,4],           bpm: 2,  len: .3,  mot: [2, 2, -4, 2, 2, -4] },
    '09': { n: '高くきらめく駆け上がり',   wave: 'bell',     oct: 12,  r: [2,1,1,1,1,0,0,0,1,1,1,1,1,0,0,0], c: [0,1,2,3,4,5,6,7], bpm: 4,  len: .4,  mot: [1, 1, 1, 1, -3, 2] },
    '10': { n: '呼びかけとこだま',         wave: 'triangle', oct: 0,   r: [2,0,1,0,2,0,0,0,0,0,0,0,0,0,0,0], c: [0,2,1,3,2,4,3,1], bpm: 0,  len: .6,  mot: [2, 1, -3, 2, 1, -3], call: true },
    '11': { n: '一歩ずつ進む音階',         wave: 'triangle', oct: 0,   r: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0], c: [0,1,2,3,4,3,2,1], bpm: 0,  len: .45, mot: [1, 1, 1, -1, -1, 2], scale: true },
    '12': { n: '小節ごとに姿を変える音型', wave: 'alt',      oct: 0,   r: [1,0,1,0,0,1,0,1,1,0,1,0,0,1,0,1], c: [0,2,4,1,3,5,2,4], bpm: 2,  len: .5,  mot: [3, -1, 2, -2, 4, -3], rotate: true }
  };
  /* MOON：背景（場）。prog=和音進行（音階の何番目の和音か）、bars=1和音の小節数、space=響きの広さ、echo=こだま */
  var MOONS = {
    '01': { n: '間をたっぷりとる静かな響き',   mode: 'ionian',     prog: [0, 3],       bars: 2, wave: 'sine',     cut: 700,  space: .85, echo: 0,   bass: 'root',  pulse: 'half',   bpm: -8 },
    '02': { n: 'ただよう浮遊の和音',           mode: 'lydian',     prog: [0, 1],       bars: 2, wave: 'triangle', cut: 620,  space: .75, echo: 0,   bass: 'pedal', pulse: 'soft',   bpm: -6 },
    '03': { n: '解決を待つ吊り下がりの和音',   mode: 'mixolydian', prog: [3, 4, 0, 0], bars: 1, wave: 'sawtooth', cut: 900,  space: .55, echo: 0,   bass: 'root',  pulse: 'normal', bpm: -2, sus: true },
    '04': { n: 'こだまが返ってくる空間',       mode: 'ionian',     prog: [0, 4, 5, 3], bars: 1, wave: 'sine',     cut: 950,  space: .6,  echo: .4,  bass: 'root',  pulse: 'normal', bpm: 0,  open: true },
    '05': { n: '深く支える低音',               mode: 'ionian',     prog: [5, 3, 0, 4], bars: 1, wave: 'sawtooth', cut: 760,  space: .5,  echo: 0,   bass: 'walk',  pulse: 'normal', bpm: -2 },
    '06': { n: '包み込む小さな部屋の響き',     mode: 'ionian',     prog: [0, 3, 0, 4], bars: 1, wave: 'triangle', cut: 650,  space: .22, echo: 0,   bass: 'root',  pulse: 'soft',   bpm: -4, close: true },
    '07': { n: 'やわらかく満ちる長7度の和音', mode: 'ionian',     prog: [0, 3],       bars: 2, wave: 'sawtooth', cut: 820,  space: .65, echo: 0,   bass: 'root',  pulse: 'soft',   bpm: -6, slow: true },
    '08': { n: 'いつも家に帰ってくる和声',     mode: 'ionian',     prog: [0, 3, 0, 4], bars: 1, wave: 'triangle', cut: 800,  space: .45, echo: 0,   bass: 'pedal', pulse: 'normal', bpm: -2 },
    '09': { n: '少しずつ持ち上がる進行',       mode: 'ionian',     prog: [1, 2, 3, 4], bars: 1, wave: 'sawtooth', cut: 1100, space: .5,  echo: 0,   bass: 'root',  pulse: 'normal', bpm: 2 },
    '10': { n: 'どちらにも行ける旋法の和音',   mode: 'dorian',     prog: [0, 3],       bars: 1, wave: 'sawtooth', cut: 950,  space: .5,  echo: 0,   bass: 'walk',  pulse: 'normal', bpm: 0 },
    '11': { n: '問いと答えの和声',             mode: 'ionian',     prog: [3, 4, 0, 4], bars: 1, wave: 'triangle', cut: 900,  space: .5,  echo: .28, bass: 'root',  pulse: 'normal', bpm: 0 },
    '12': { n: 'ひとつの和音にとどまる響き',   mode: 'ionian',     prog: [0],          bars: 4, wave: 'sine',     cut: 700,  space: .72, echo: 0,   bass: 'pedal', pulse: 'half',   bpm: -4 }
  };
  var DEFAULT_MOON = { n: '', mode: 'ionian', prog: [0, 5, 3, 4], bars: 2, wave: 'sawtooth', cut: 800, space: .55, echo: 0, bass: 'root', pulse: 'normal', bpm: 0 };
  var DEFAULT_SUN = { n: '', wave: 'sine', oct: 0, r: [2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], c: [0, 2, 4, 2], bpm: 0, len: .9, mot: [2, 2, -1, -2, 1, 2] };
  var KEYNAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* 組み合わせの「音の世界」を組み立てる（音を鳴らさない純粋な計算。テストからも使う） */
  function buildWorld(sunId, moonId) {
    var sun = SUNS[sunId] || null, moon = MOONS[moonId] || null;
    var si = sun ? parseInt(sunId, 10) - 1 : 0, mi = moon ? parseInt(moonId, 10) - 1 : 0;
    var k = sun && moon ? (si * 7 + mi * 5) % 12 : moon ? (mi * 5) % 12 : sun ? (si * 7) % 12 : 0;
    var T = 38 + (((k + 6) % 12) - 6);                     // 主音（D=38 を中心に ±6 半音）
    var M = moon || DEFAULT_MOON, Su = sun || DEFAULT_SUN, sc = MODES[M.mode];
    var deg = function (d) { var o = Math.floor(d / 7); return sc[((d % 7) + 7) % 7] + 12 * o; };
    var bpm = Math.max(56, Math.min(86, 70 + (sun ? Su.bpm : 0) + (moon ? M.bpm : 0)));
    var chords = M.prog.map(function (d) {
      var pad = M.close ? [deg(d), deg(d) + 12, deg(d + 2) + 12, deg(d + 4) + 12, deg(d + 6) + 12]
              : M.open ? [deg(d), deg(d + 4), deg(d) + 12, deg(d + 4) + 12, deg(d + 8) + 12]
              : [deg(d), deg(d + 4), deg(d + 2) + 12, deg(d + 6) + 12, deg(d + 8) + 12];
      var sus = M.sus ? [deg(d), deg(d + 4), deg(d + 3) + 12, deg(d + 6) + 12, deg(d + 8) + 12] : null;
      var tones = (M.open ? [0, 4, 7, 8, 11] : [0, 2, 4, 6, 8]).map(function (x) { return deg(d + x) + T + 24; });
      return { d: d, root: T + deg(d), pad: pad.map(function (x) { return x + T; }), sus: sus && sus.map(function (x) { return x + T; }), tones: tones };
    });
    /* モチーフ：SUNの動きの型を、MOONの旋法・調で、組み合わせごとの揺らぎをつけて */
    var rng = mulberry32((si + 1) * 977 + (mi + 1) * 131 + (sun ? 7 : 0) + (moon ? 3 : 0));
    var len = 5 + ((si + mi * 2) % 3), step = 0, motif = [];
    var durs = [[1, .5, .5, 1, 1, 2, 1], [.5, .5, 1, .5, .5, 1, 2], [1, 1, .5, .5, 2, 1, 1], [.75, .25, 1, .75, .25, 2, 1]][(si + mi) % 4];
    for (var i = 0; i < len; i++) {
      var dv = i === 0 ? 0 : Su.mot[(i - 1) % Su.mot.length] + (rng() < .35 ? (rng() < .5 ? -1 : 1) : 0);
      step += dv; motif.push({ m: T + 24 + deg(step + (mi % 3)), b: durs[i % durs.length] });
    }
    /* 低すぎ・高すぎる旋律はオクターブで聴きやすい高さに収める */
    var lo = Math.min.apply(null, motif.map(function (n) { return n.m; })), hi = Math.max.apply(null, motif.map(function (n) { return n.m; }));
    var sh = lo < 57 ? 12 : hi > 93 ? -12 : 0;
    if (sh) motif.forEach(function (n) { n.m += sh; });
    return { sunId: sunId || null, moonId: moonId || null, sun: Su, moon: M, hasSun: !!sun, hasMoon: !!moon, T: T, key: KEYNAMES[((T % 12) + 12) % 12], bpm: bpm, deg: deg, chords: chords, motif: motif };
  }

  /* ===================== 2. 音を鳴らす部分 ===================== */
  var ctx = null, master, comp, bus, dry, wet, wetGain, padFilter, echoIn, echoDelay, echoFb, echoOut, voices = [], L = {};
  var midi = function (n) { return 440 * Math.pow(2, (n - 69) / 12); };
  var LV = {
    intro:   { pad: .20, pulse: 0,   arp: 0,   perc: 0,   bass: 0   },
    select0: { pad: .21, pulse: .55, arp: 0,   perc: 0,   bass: 0   },
    select1: { pad: .21, pulse: .6,  arp: .5,  perc: 0,   bass: .32 },
    ready:   { pad: .22, pulse: .75, arp: .62, perc: .42, bass: .45 },
    eclipse: { pad: .26, pulse: 0,   arp: 0,   perc: 0,   bass: .55 },
    silence: { pad: 0,   pulse: 0,   arp: 0,   perc: 0,   bass: 0   },
    glow:    { pad: .17, pulse: 0,   arp: .32, perc: 0,   bass: .18 }
  };
  var DENS = { select1: .8, ready: 1, glow: .38 };

  var S = { mode: 'intro', sec: 'intro', secStart: 0, chord: 0, pending: null, picks: { sun: null, moon: null }, world: buildWorld(null, null),
            beat: 0, beatLen: 60 / 72, nextT: 0, timer: null, ecl: null, scheduled: [], log: [] };

  function impulse(sec, decay) {
    var len = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) { var d = buf.getChannelData(c); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return buf;
  }
  function keep(n) { S.scheduled.push(n); if (S.scheduled.length > 600) S.scheduled = S.scheduled.slice(-300); return n; }

  function init() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = enabled ? 1 : 0;
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = .01; comp.release.value = .4;
    bus = ctx.createGain(); dry = ctx.createGain(); dry.gain.value = .75;
    wet = ctx.createConvolver(); wet.buffer = impulse(4.2, 2.6); wetGain = ctx.createGain(); wetGain.gain.value = .55;
    bus.connect(dry); bus.connect(wet); wet.connect(wetGain); dry.connect(comp); wetGain.connect(comp); comp.connect(master); master.connect(ctx.destination);
    ['pad', 'pulse', 'arp', 'perc', 'bass'].forEach(function (k) { var g = ctx.createGain(); g.gain.value = 0; L[k] = g; });
    padFilter = ctx.createBiquadFilter(); padFilter.type = 'lowpass'; padFilter.frequency.value = 650; padFilter.Q.value = .6;
    var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .05; lg.gain.value = 220; lfo.connect(lg); lg.connect(padFilter.frequency); lfo.start();
    L.pad.connect(padFilter); padFilter.connect(bus);
    /* こだま（MOON 04・11 などで使う） */
    echoIn = ctx.createGain(); echoDelay = ctx.createDelay(2); echoFb = ctx.createGain(); echoOut = ctx.createGain();
    echoDelay.delayTime.value = .6; echoFb.gain.value = .35; echoOut.gain.value = 0;
    echoIn.connect(echoDelay); echoDelay.connect(echoFb); echoFb.connect(echoDelay); echoDelay.connect(echoOut); echoOut.connect(bus);
    L.arp.connect(bus); L.arp.connect(echoIn); L.pulse.connect(bus); L.perc.connect(bus); L.bass.connect(bus);
    S.world.chords[0].pad.forEach(function (n, i) {
      var g = ctx.createGain(); g.gain.value = i === 0 ? .16 : .1;
      var tr = ctx.createOscillator(), tg = ctx.createGain(); tr.frequency.value = .07 + i * .023; tg.gain.value = .035; tr.connect(tg); tg.connect(g.gain); tr.start();
      voices.push([-7, 7].map(function (c) { var o = ctx.createOscillator(); o.type = i === 0 ? 'triangle' : 'sawtooth'; o.frequency.value = midi(n); o.detune.value = c; o.connect(g); o.start(); return o; }));
      g.connect(L.pad);
    });
    document.addEventListener('visibilitychange', function () { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (enabled) ctx.resume(); });
    return true;
  }

  /* ---------- 楽器 ---------- */
  function bell(freq, when, vol, decay, bright, dest) {
    var t = Math.max(when || 0, ctx.currentTime), out = ctx.createGain(); vol *= 1.9;
    out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(vol, t + .008); out.gain.exponentialRampToValueAtTime(.0001, t + decay);
    out.connect(dest || bus);
    (bright ? [[1, 1], [2.76, .35], [5.4, .16], [8.9, .06]] : [[1, 1], [2, .25], [3.01, .08]]).forEach(function (p) {
      var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = freq * p[0]; g.gain.value = p[1];
      o.connect(g); g.connect(out); o.start(t); o.stop(t + decay + .1); keep(o);
    });
  }
  function pluck(freq, t, vol, len, type, dest) {
    if (type === 'bell') { bell(freq, t, vol * .55, len * 3.5, true, dest); return; }
    var o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq; f.type = 'lowpass';
    f.frequency.setValueAtTime(Math.min(freq * (type === 'sine' ? 8 : 5), 9000), t); f.frequency.exponentialRampToValueAtTime(freq * 1.4, t + len);
    if (type === 'square' || type === 'sawtooth') vol *= .55;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + len);
    o.connect(f); f.connect(g); g.connect(dest); o.start(t); o.stop(t + len + .05); keep(o);
  }
  function thump(t, vol, f0, f1, len, dest) {
    var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + len * .6);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + len);
    o.connect(g); g.connect(dest || bus); o.start(t); o.stop(t + len + .05); keep(o);
  }
  var noiseBuf = null;
  function noise(t, len, vol, type, freq, dest, sweepTo) {
    if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = type; f.frequency.setValueAtTime(freq, t); if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + len); f.Q.value = type === 'bandpass' ? 1.4 : .7;
    if (sweepTo) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + len * .9); g.gain.exponentialRampToValueAtTime(.0001, t + len); }
    else { g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + len); }
    s.connect(f); f.connect(g); g.connect(dest || bus); s.start(t); s.stop(t + len + .05); keep(s);
  }

  /* ---------- 世界の切り替え ---------- */
  function worldFor(sec) {
    var p = S.picks;
    if (sec === 'intro' || sec === 'select0') return buildWorld(null, null);
    return buildWorld(p.sun, p.moon);
  }
  function applyWorldSound(W, t) {
    voices.forEach(function (os, i) { if (i > 0) os.forEach(function (o) { o.type = W.moon.wave; }); });
    wetGain.gain.setTargetAtTime(.25 + W.moon.space * .55, t, .8);
    echoDelay.delayTime.setTargetAtTime(S.beatLen * .75, t, .1);
    echoOut.gain.setTargetAtTime(W.moon.echo, t, .5);
  }
  function applyChord(t, glide) {
    var W = S.world, c = W.chords[S.chord % W.chords.length];
    var pad = (c.sus && S.chord % 2 === 0 && S.sec !== 'glow') ? c.sus : c.pad;
    voices.forEach(function (os, i) { os.forEach(function (o) { o.frequency.setTargetAtTime(midi(pad[i]), t, glide); }); });
    var lv = LV[S.sec].bass;
    if (lv > 0 && W.moon.bass !== 'walk') {
      var root = W.moon.bass === 'pedal' ? W.T : c.root, o = ctx.createOscillator(), g = ctx.createGain(), len = S.beatLen * 4 * W.moon.bars;
      o.type = 'triangle'; o.frequency.value = midi(root + 12);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.32, t + .08); g.gain.setTargetAtTime(.0001, t + len - .3, .2);
      o.connect(g); g.connect(L.bass); o.start(t); o.stop(t + len + .5); keep(o);
    }
  }
  function playMotif(t, vol, dest) {
    var W = S.world, x = t;
    W.motif.forEach(function (n) { bell(midi(n.m), x, vol, Math.max(1.4, n.b * S.beatLen * 2.4), true, dest); x += n.b * S.beatLen; });
  }
  function setSection(name, t) {
    S.sec = name; S.secStart = S.beat; S.chord = 0;
    S.world = worldFor(name);
    var W = S.world;
    S.beatLen = 60 / (name === 'glow' ? Math.round(W.bpm * .85) : (name === 'ready' || name === 'select1') ? W.bpm : 72);
    S.log.push({ sec: name, t: +t.toFixed(3), beat: S.beat, sun: W.sunId, moon: W.moonId, key: W.key, bpm: Math.round(60 / S.beatLen) });
    var slow = W.moon.slow ? 2 : 1;
    var tc = name === 'silence' ? .06 : name === 'glow' ? 1.6 * slow : S.beatLen * .45 * slow;
    var lv = LV[name];
    Object.keys(lv).forEach(function (k) {
      var v = lv[k];
      if (name === 'select1' && k === 'arp' && !W.hasSun) v = .3;           // 月だけ：旋律は控えめ
      if (name === 'select1' && k === 'pad' && W.hasMoon) v = .25;          // 月だけ：和音の世界を前に
      if (k === 'pulse' && W.moon.pulse === 'soft') v *= .6;
      L[k].gain.cancelScheduledValues(t); L[k].gain.setTargetAtTime(v, t, tc);
    });
    padFilter.frequency.setTargetAtTime(name === 'ready' ? W.moon.cut * 1.6 : name === 'intro' ? 650 : W.moon.cut, t, 1);
    if (name !== 'eclipse' && name !== 'silence') {
      applyWorldSound(W, t);
      applyChord(t, name === 'intro' || name === 'glow' ? 1.6 : .5);
      if (name === 'ready' && enabled) playMotif(t + S.beatLen * .02, .05, L.arp);   // 2枚がそろった瞬間、その組み合わせだけの旋律
    }
  }
  function request(name, quant) {
    if (!ctx) { S.sec = name; return; }
    if (quant === 'now') { S.pending = null; setSection(name, ctx.currentTime + .02); return; }
    S.pending = { name: name, quant: quant };
  }
  function selectStage() { var n = (S.picks.sun ? 1 : 0) + (S.picks.moon ? 1 : 0); return n === 0 ? 'select0' : n === 1 ? 'select1' : 'ready'; }

  /* ---------- 拍ごとの演奏 ---------- */
  function playBeat(i, t) {
    if (S.pending && (S.pending.quant === 'beat' || (S.pending.quant === 'bar' && i % 4 === 0))) { var p = S.pending; S.pending = null; setSection(p.name, t); }
    var sec = S.sec, W = S.world, B = S.beatLen;
    if (sec === 'eclipse' || sec === 'silence') return;
    var sb = i - S.secStart, bars = sec === 'select0' || sec === 'intro' ? 2 : W.moon.bars;
    if (sb > 0 && sb % (4 * bars) === 0) { S.chord++; applyChord(t, sec === 'glow' || sec === 'intro' ? 1.6 : .35); }
    var c = W.chords[S.chord % W.chords.length], inBar = sb % 4, bar = Math.floor(sb / 4);
    /* 鼓動 */
    if (LV[sec].pulse > 0 && !(W.moon.pulse === 'half' && bar % 2 === 1)) {
      if (inBar === 0) { thump(t, .5, 70, 42, .32, L.pulse); thump(t + .2, .3, 64, 40, .28, L.pulse); }
      if (sec === 'ready' && inBar === 2) thump(t, .38, 70, 42, .3, L.pulse);
    }
    /* 歩く低音（MOON 05・10） */
    if (LV[sec].bass > 0 && W.moon.bass === 'walk') {
      var wk = [0, 7, 12, 7][inBar]; pluck(midi(c.root + 12 + wk), t, .3, B * .95, 'triangle', L.bass);
    }
    /* 前景の旋律：SUNの型（SUNを選んでいなければ控えめな既定の型） */
    var dens = DENS[sec];
    if (dens && (sec !== 'select1' || W.hasSun || W.hasMoon)) {
      var Su = W.sun;
      for (var s = 0; s < 4; s++) {
        var st = inBar * 4 + s, v = Su.r[st];
        if (!v) continue;
        if (v < 2 && Math.random() > dens) continue;
        if (sec === 'glow' && v < 2 && Math.random() < .5) continue;
        var k = sb * 4 + s, ci = Su.rotate ? Su.c[(k + bar) % Su.c.length] : Su.c[k % Su.c.length];
        var note = Su.scale ? W.T + 24 + W.deg(c.d + ci) : c.tones[ci % 5] + 12 * Math.floor(ci / 5);
        note += Su.oct;
        var type = Su.wave === 'alt' ? (bar % 2 ? 'sine' : 'triangle') : Su.wave;
        var vol = (v === 2 ? .2 : .13) * (.85 + Math.random() * .3), tt = t + s * B / 4;
        pluck(midi(note), tt, vol, Su.len * (sec === 'glow' ? 1.6 : 1), type, L.arp);
        if (Su.fifth) pluck(midi(note + 7), tt, vol * .8, Su.len, type, L.arp);
        if (Su.call && st < 8) pluck(midi(note - 12), tt + 2 * B, vol * .7, Su.len * 1.3, 'sine', L.arp);
      }
    }
    /* 余韻：4小節ごとにモチーフが戻ってくる */
    if (sec === 'glow' && inBar === 0 && bar % 4 === 1 && enabled) playMotif(t, .035, L.arp);
    /* 刻み */
    if (LV[sec].perc > 0) {
      noise(t + B / 2, .05, .22, 'highpass', 6500, L.perc);
      if (Math.random() < .5) noise(t + B * .75, .03, .1, 'highpass', 8000, L.perc);
      if (inBar === 3) noise(t + B * .25, .03, .12, 'highpass', 7000, L.perc);
    }
    /* 星のまたたき */
    if ((sec === 'intro' || sec === 'select0') && inBar === 0 && Math.random() < .55) bell(midi(W.T + 36 + W.deg(Math.floor(Math.random() * 8))), t + Math.random() * B * 3, .02, 3.2, true);
  }
  function tick() {
    if (!ctx || ctx.state !== 'running') return;
    while (S.nextT < ctx.currentTime + .15) {
      if (S.nextT < ctx.currentTime - .2) S.nextT = ctx.currentTime + .05;
      if (enabled) playBeat(S.beat, S.nextT); else if (S.pending) { var p = S.pending; S.pending = null; setSection(p.name, S.nextT); }
      S.nextT += S.beatLen; S.beat++;
    }
  }

  /* ---------- 日食 ---------- */
  function endHit(t) {
    var W = S.world;
    [0, 7, 12, 12 + W.deg(2), 12 + W.deg(4), 24].forEach(function (x, i) { bell(midi(W.T + 12 + x), t + .04 + i * .05, .05, 6.5, false); });
    bell(midi(W.motif[0].m + 12), t, .16, 5.5, true); bell(midi(W.motif[0].m + 19), t + .02, .08, 4.5, true);
    thump(t, .55, 90, 30, 1.4);
    Object.keys(L).forEach(function (k) { L[k].gain.cancelScheduledValues(t); L[k].gain.setTargetAtTime(0, t, .05); });
    S.log.push({ sec: 'end', t: +t.toFixed(3) });
  }
  function cancelScheduled() {
    var t = ctx.currentTime;
    S.scheduled.forEach(function (n) { try { n.stop(t + .03); } catch (e) {} });
    S.scheduled = [];
    if (S.ecl) S.ecl.timers.forEach(clearTimeout);
  }

  var API = {
    get enabled() { return enabled; },
    start: function () {
      if (!init()) return;
      if (enabled && ctx.state !== 'running') ctx.resume();
      if (!S.timer) {
        S.nextT = ctx.currentTime + .1; S.beat = 0;
        setSection(S.mode === 'select' ? selectStage() : S.mode === 'work' ? 'glow' : 'intro', ctx.currentTime + .05);
        S.timer = setInterval(tick, 25);
      }
    },
    setEnabled: function (on) {
      enabled = !!on;
      try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch (e) {}
      if (!init()) return;
      if (enabled) { ctx.resume(); master.gain.setTargetAtTime(1, ctx.currentTime, .2); }
      else master.gain.setTargetAtTime(0, ctx.currentTime, .15);
    },
    mode: function (m) {
      var prev = S.mode; S.mode = m;
      if (m === 'select') { var st = selectStage(); if (S.sec !== st || S.pending) request(st, prev === 'work' ? 'bar' : 'beat'); }
      else if (m === 'intro') request('intro', 'now');
      else if (m === 'work' && S.sec !== 'eclipse' && S.sec !== 'silence') request('glow', 'now');
    },
    picks: function (sun, moon) {
      var changed = S.picks.sun !== (sun || null) || S.picks.moon !== (moon || null);
      S.picks = { sun: sun || null, moon: moon || null };
      if (S.mode !== 'select') return;
      var st = selectStage();
      if (S.pending && S.pending.name === st && !changed) return;
      if (S.pending && S.pending.quant === 'bar' && S.pending.name === st) return;
      if (changed || S.sec !== st) request(st, 'beat');
    },
    pick: function (type, id, on) {
      if (!ctx || !enabled) return;
      var W = buildWorld(type === 'sun' ? id : null, type === 'moon' ? id : null), step = parseInt(id, 10) - 1;
      if (!on) { bell(midi(type === 'sun' ? 69 : 57), 0, .05, .6, false); return; }
      if (type === 'sun') bell(midi(W.T + 36 + W.deg(step % 7)), 0, .11, 2.6, true);
      else bell(midi(W.T + 24 + W.deg(step % 7)), 0, .12, 3.4, false);
    },
    locked: function () { if (ctx && enabled) { var t = ctx.currentTime; thump(t, .22, 140, 48, .6); bell(midi(50), t + .02, .03, .8, false); } },
    tap: function () { if (ctx && enabled) bell(midi(81), 0, .025, .35, false); },
    /* ECLIPSE：映像（月が重なる12〜58%、金の円52〜82%、ダイヤモンドリング83.5%）に合わせ、
       組み合わせの調で8拍かけて高め、ダイヤモンドリングの瞬間に曲を終わらせる */
    eclipse: function (dur) {
      if (!ctx) return;
      cancelScheduled(); S.pending = null;
      var t0 = ctx.currentTime + .02, flash = t0 + dur * .835, b = (flash - t0) / 8;
      setSection('eclipse', t0);
      var W = S.world;
      S.ecl = { t0: t0, flash: flash, dur: dur, timers: [] };
      var at = function (fn, when) { S.ecl.timers.push(setTimeout(fn, Math.max(0, (when - ctx.currentTime) * 1000))); };
      if (!enabled) { at(function () { setSection('silence', ctx.currentTime); }, flash); at(function () { request('glow', 'now'); }, flash + 2.6); return; }
      thump(t0, .5, 120, 45, .7); bell(midi(W.T + 36), t0, .08, 2.5, true);
      var c = W.chords[W.chords.length - 1];
      voices.forEach(function (os, i) { os.forEach(function (o) { o.frequency.setTargetAtTime(midi([W.T - 7, W.T, W.T + 5, W.T + 12, W.T + 19][i]), t0, .4); }); });
      padFilter.frequency.cancelScheduledValues(t0); padFilter.frequency.setValueAtTime(600, t0); padFilter.frequency.exponentialRampToValueAtTime(3200, flash);
      L.pad.gain.setValueAtTime(.18, t0); L.pad.gain.linearRampToValueAtTime(.34, flash);
      var drone = ctx.createOscillator(), dg = ctx.createGain(), df = ctx.createBiquadFilter();
      drone.type = 'sawtooth'; drone.frequency.value = midi(W.T - 12); df.type = 'lowpass'; df.frequency.value = 180;
      dg.gain.setValueAtTime(0, t0); dg.gain.linearRampToValueAtTime(.28, flash - .05); dg.gain.setTargetAtTime(0, flash, .05);
      drone.connect(df); df.connect(dg); dg.connect(bus); drone.start(t0); drone.stop(flash + .5); keep(drone);
      for (var k = 0; k < 8; k++) {
        var tk = t0 + k * b, v = .2 + k * .06;
        thump(tk, v, 110, 50, .45);
        if (k >= 4) noise(tk + b / 2, .06, .08 + k * .02, 'bandpass', 2200, bus);
        if (k >= 6) for (var r = 1; r < 4; r++) thump(tk + r * b / 4, v * .55, 120, 60, .2);
        /* SUNの音色で、組み合わせのモチーフを高まりの中に一音ずつ */
        if (k < W.motif.length) pluck(midi(W.motif[k].m), tk, .12, .6, W.sun.wave === 'alt' ? 'triangle' : W.sun.wave, bus);
      }
      noise(t0 + dur * .1, flash - t0 - dur * .1, .07, 'bandpass', 180, bus, 2600);
      for (var i = 0; i < 12; i++) bell(midi(W.T + 24 + W.deg(i)), t0 + dur * (.52 + .30 * i / 11), .045 + i * .004, 2.4, true);
      at(function () { endHit(flash); setSection('silence', flash + .01); }, flash - .12);
      at(function () { if (S.sec === 'silence') request('glow', 'now'); }, flash + 2.6);
    },
    skip: function () {
      if (!ctx || !S.ecl || S.sec !== 'eclipse') return;
      var t = ctx.currentTime, prog = (t - S.ecl.t0) / S.ecl.dur;
      cancelScheduled();
      if (prog < .5) {
        Object.keys(L).forEach(function (k) { L[k].gain.cancelScheduledValues(t); L[k].gain.setTargetAtTime(0, t, .4); });
        if (enabled) bell(midi(S.world.T + 36), t + .05, .06, 3, true);
        S.log.push({ sec: 'soft-end', t: +t.toFixed(3) });
        setSection('silence', t + .02);
        S.ecl.timers.push(setTimeout(function () { request('glow', 'now'); }, 1200));
      } else {
        if (enabled) endHit(t + .03); else Object.keys(L).forEach(function (k) { L[k].gain.setTargetAtTime(0, t, .05); });
        setSection('silence', t + .04);
        S.ecl.timers.push(setTimeout(function () { request('glow', 'now'); }, 2400));
      }
    },
    reveal: function (i) { if (ctx && enabled && i < 6) { var W = S.world; bell(midi(W.T + 24 + W.deg([0, 2, 4, 3, 5, 7][i])), 0, .03, 2.2, false); } },
    ok: function () { if (ctx && enabled) { var W = S.world, t = ctx.currentTime; bell(midi(W.T + 36), t, .07, 1.6, true); bell(midi(W.T + 36 + W.deg(4)), t + .12, .07, 2.2, true); } },
    soft: function () { if (ctx && enabled) bell(midi(66), 0, .04, 1.4, false); },
    /* 画面に出す説明（例：〈進む〉のぼっていく分散和音 × 〈休みたい〉ただよう浮遊の和音） */
    describe: function (sunId, moonId) { var W = buildWorld(sunId, moonId); return { sun: SUNS[sunId] ? SUNS[sunId].n : '', moon: MOONS[moonId] ? MOONS[moonId].n : '', key: W.key, bpm: Math.round(W.bpm * .85), motif: W.motif.length }; },
    _world: buildWorld,
    _debug: function () { return { ctx: ctx, master: master, state: S }; }
  };
  window.SMSound = API;
})();
