/* 人間語辞典 — app.js
   words.json を読み込み、紙面を組み、StPageFlip でめくれる本にする。
   語句の追加は words.json だけで完結する（ページ・索引・URLは自動生成）。 */
(() => {
  'use strict';

  /* ---------- 保存（使えない環境でも止まらない） ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ngj:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ngj:' + k, JSON.stringify(v)); } catch (e) { /* 保存不可でも読書は続ける */ } }
  };

  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad3 = (n) => String(n).padStart(3, '0');
  const mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  /* ---------- かな処理（五十音） ---------- */
  const ROWS = [
    ['あ行', 'あいうえおぁぃぅぇぉ'], ['か行', 'かきくけこ'], ['さ行', 'さしすせそ'], ['た行', 'たちつてとっ'],
    ['な行', 'なにぬねの'], ['は行', 'はひふへほ'], ['ま行', 'まみむめも'], ['や行', 'やゆよゃゅょ'],
    ['ら行', 'らりるれろ'], ['わ行', 'わをん']
  ];
  const toHira = (s) => String(s).replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const baseKana = (ch) => toHira(ch).normalize('NFD').replace(/[゙゚]/g, '').normalize('NFC');
  const rowOf = (reading) => { const k = baseKana(reading.charAt(0)); const i = ROWS.findIndex((r) => r[1].includes(k)); return i < 0 ? 0 : i; };
  const collator = new Intl.Collator('ja');

  /* ---------- 状態 ---------- */
  const S = {
    meta: null, words: [], pages: [], bySlug: new Map(),
    pf: null, current: 0, flipState: 'read', orientation: 'landscape',
    favs: new Set(store.get('favs', [])),
    sound: store.get('sound', true),
    speed: store.get('speed', mqReduce.matches ? 'fast' : 'normal'),
    calm: store.get('calm', mqReduce.matches),
    large: store.get('large', false),
    panel: null, opener: null
  };
  const SPEEDS = { slow: 1150, normal: 780, fast: 460 };
  const PAGE_W = 500, PAGE_H = 707, MIN_W = 260, MAX_W = 520; // A判比
  const EDGE = 9; // 小口に見える紙束の最大の厚み（px）

  /* =========================================================
     紙面を組む
     ========================================================= */
  function noteHtml(note) {
    return esc(note).replace(/→\s*([^\s　、。]+)/g, (m, word) => {
      const w = S.words.find((x) => x.word === word);
      return w ? `<button type="button" class="xref" data-goto="${esc(w.slug)}" aria-label="${esc(word)}のページへ">→ ${esc(word)}</button>` : m;
    });
  }

  function buildPages() {
    const m = S.meta, W = S.words, pages = [];
    const add = (p) => { p.index = pages.length; pages.push(p); return p; };

    add({ kind: 'cover', label: '表紙', hard: true, html: `
      <div class="cover-frame">
        <div class="cover-en">${esc(m.titleEn)}</div>${m.volume ? `<div class="cover-vol">VOLUME ${['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][m.volume] || m.volume}</div>` : ''}
        <h1 class="cover-title">${esc(m.title)}</h1>
        <div class="cover-copy">${m.copy.map(esc).join('<br>')}</div>
        <div class="cover-pub">${esc(m.publisherEn)}</div>
      </div>`, sr: `表紙。${m.title}。${m.titleEn}。${m.copy.join('')}。${m.publisherEn}` });

    add({ kind: 'endpaper', label: '見返し', html: `<div class="pg-in"></div>`, sr: '見返し' });

    add({ kind: 'title', label: '扉', html: `
      <div class="pg-in title-page">
        <h1>${esc(m.title)}</h1>
        <div class="en">${esc(m.titleEn)}</div>
        ${m.volume ? `<div class="vol">第${'〇一二三四五六七八九十'[m.volume] || m.volume}巻</div>` : ''}
        <div class="rule"></div>
        <div class="pub">${esc(m.publisher)}<span>${esc(m.publisherEn)}</span></div>
      </div>`, sr: `扉。${m.title}。${m.publisher}` });

    const intro = ['人間は、いろんな言葉をつくりました。',
      '正しいことを言うために。<br>間違ったことをごまかすために。<br>誰かを好きになるために。<br>誰かを嫌いになるために。',
      'それなのに、<br>自分の気持ちを説明する言葉は、<br>まだ少し足りないようです。',
      'だから、もう一冊、辞典をつくりました。'];
    add({ kind: 'intro', label: 'はじめに', toc: true, html: `
      <div class="pg-in prose"><h2>はじめに</h2>
        <div class="txt">${intro.map((p) => `<p>${p}</p>`).join('')}</div>
        <div class="folio">{{folio}}</div></div>`,
      sr: 'はじめに。' + intro.join('').replace(/<br>/g, '') });

    add({ kind: 'howto', label: 'この辞典の読み方', toc: true, html: `
      <div class="pg-in prose"><h2>この辞典の読み方</h2>
        <div class="txt" style="margin-top:4cqw">
          <p>ひとつの言葉に、ひとつのページ。言葉は五十音順に並んでいます。</p>
        </div>
        <dl class="howto">
          <div class="row"><dt>見出し語</dt><dd>【<span class="sample">言葉</span>】と、その読み。</dd></div>
          <div class="row"><dt>① 辞書</dt><dd>世間で、ふつうに使われている意味。</dd></div>
          <div class="row"><dt>② 人間語</dt><dd>人間がその言葉で、実際にしていること。</dd></div>
          <div class="row"><dt>※</dt><dd>観察のあとに残った、短い補足。</dd></div>
          <div class="row"><dt>番号</dt><dd>採集した順番です。</dd></div>
        </dl>
        <div class="txt" style="margin-top:4.5cqw"><p>どの定義も、正解ではありません。<br>うなずいても、反論しても、かまいません。</p></div>
        <div class="folio">{{folio}}</div></div>`,
      sr: 'この辞典の読み方。ひとつの言葉にひとつのページ。五十音順。①辞書は世間でふつうに使われている意味。②人間語は人間がその言葉で実際にしていること。番号は採集した順番。どの定義も正解ではありません。' });

    W.forEach((w, i) => {
      const next = W[i + 1];
      const guide = esc(w.reading.slice(0, 2)) + (next ? ' — ' + esc(next.reading.slice(0, 2)) : '');
      const len = [...w.word].length;
      const hw = len <= 1 ? 17 : len === 2 ? 16 : len === 3 ? 14.5 : len === 4 ? 12 : 10;
      const dlen = [...w.definition].length;
      const df = dlen <= 20 ? 6.2 : dlen <= 26 ? 5.7 : dlen <= 32 ? 5.2 : 4.8;
      const row = rowOf(w.reading);
      const p = add({ kind: 'word', label: w.word, word: w, toc: false, html: `
        <span class="thumb" style="--tt:${(11 + row * 7.6).toFixed(1)}%" aria-hidden="true">${esc(baseKana(w.reading.charAt(0)))}</span>
        <span class="w-fav-mark" data-favmark="${esc(w.slug)}" aria-hidden="true"${S.favs.has(w.slug) ? '' : ' hidden'}></span>
        <article class="pg-in" lang="ja">
          <header class="w-head"><span class="w-label">${esc(m.title)}</span><span class="w-guide">${guide}</span><span class="w-num">${pad3(w.id)}</span></header>
          <p class="w-reading">${esc(w.reading)}<small>〔${esc(w.pos)}〕</small></p>
          <h2 class="w-word" style="--hw:${hw}cqw"><span class="bk">【</span>${esc(w.word)}<span class="bk">】</span></h2>
          <div class="w-bar"></div>
          <section class="w-sense"><h3 class="w-tag"><i>1</i>辞書</h3><p class="w-dict"><budoux-ja>${esc(w.dictionary)}</budoux-ja></p></section>
          <section class="w-sense"><h3 class="w-tag"><i>2</i>人間語</h3><p class="w-def" style="--df:${df}cqw"><budoux-ja>${esc(w.definition)}</budoux-ja></p></section>
          ${w.note ? `<p class="w-note">${noteHtml(w.note)}</p>` : ''}
          <footer class="w-foot">
            <span class="w-acts"><button type="button" class="w-act" data-act="fav" data-slug="${esc(w.slug)}" aria-pressed="${S.favs.has(w.slug)}" aria-label="「${esc(w.word)}」にしおりを挟む">しおり</button><button type="button" class="w-act" data-act="share" data-slug="${esc(w.slug)}" aria-label="「${esc(w.word)}」を共有">共有</button></span>
            <span class="folio">{{folio}}</span>
          </footer>
        </article>`,
        sr: `${pad3(w.id)}。${w.word}、${w.reading}。①辞書。${w.dictionary}。②人間語。${w.definition}。${w.note ? '補足。' + w.note : ''}` });
      S.bySlug.set(w.slug, p.index);
    });

    // 五十音索引（行ごと、ページ容量で自動分割）
    const groups = [];
    W.forEach((w) => { const r = rowOf(w.reading); let g = groups.find((x) => x.row === r); if (!g) groups.push(g = { row: r, items: [] }); g.items.push(w); });
    const CAP = 32; const idxPages = []; let cur = []; let units = 0;
    groups.forEach((g) => {
      let part = { row: g.row, items: [], cont: false };
      g.items.forEach((w) => {
        const need = (part.items.length ? 0 : 1.6) + 1;
        if (units + need > CAP && (cur.length || part.items.length)) {
          if (part.items.length) cur.push(part);
          idxPages.push(cur); cur = []; units = 0;
          part = { row: g.row, items: [], cont: true };
        }
        units += (part.items.length ? 0 : 1.6) + 1; part.items.push(w);
      });
      if (part.items.length) cur.push(part);
    });
    if (cur.length) idxPages.push(cur);
    idxPages.forEach((parts, k) => {
      add({ kind: 'index', label: '五十音索引', toc: k === 0, html: `
        <div class="pg-in idx"><h2>五十音索引${idxPages.length > 1 ? `<small>INDEX ${k + 1} / ${idxPages.length}</small>` : '<small>INDEX</small>'}</h2>
          <div class="idx-cols">${parts.map((pt) => `<div class="idx-row"><h3>${ROWS[pt.row][0]}${pt.cont ? '（つづき）' : ''}</h3><ul>${pt.items.map((w) =>
            `<li><button type="button" data-goto="${esc(w.slug)}" aria-label="${esc(w.word)}、${S.bySlug.get(w.slug)}ページへ">${esc(w.word)}<span class="p">${S.bySlug.get(w.slug)}</span></button></li>`).join('')}</ul></div>`).join('')}
          </div><div class="folio">{{folio}}</div></div>`,
        sr: '五十音索引。' + parts.map((pt) => pt.items.map((w) => w.word).join('、')).join('。') });
    });

    add({ kind: 'colophon', label: '奥付', toc: true, html: `
      <div class="pg-in colophon"><div class="colo-box">
        <div class="t">${esc(m.title)}</div>
        <div class="c">${m.copy.map(esc).join('<br>')}</div>
        <dl>
          <dt>企画・制作</dt><dd>${esc(m.publisher)}<br><span class="lab">${esc(m.publisherEn)}</span></dd>
          <dt>収録語数</dt><dd>${W.length}語</dd>
          <dt>発行</dt><dd>${esc(m.edition)}</dd>
          <dt>所在</dt><dd><a href="${esc(m.siteUrl)}" target="_blank" rel="noopener">${esc(m.siteUrl.replace(/^https?:\/\//, ''))}</a></dd>
        </dl>
        <div class="colo-end">© ${esc(m.publisher)}　本書の定義は、すべて観察にもとづく創作です。</div>
      </div><div class="folio">{{folio}}</div></div>`,
      sr: `奥付。${m.title}。${m.copy.join('')}。企画・制作、${m.publisher}、${m.publisherEn}。${m.siteUrl}` });

    // 見開きの都合で総ページ数を偶数にそろえる（裏表紙が左に単独で来るように）
    if ((pages.length + 2) % 2 !== 0) add({ kind: 'blank', label: '白', html: `<div class="pg-in"><span class="blank-mark">　</span></div>`, sr: '白紙' });
    add({ kind: 'endpaper', label: '見返し', html: `<div class="pg-in"></div>`, sr: '見返し' });
    add({ kind: 'back', label: '裏表紙', hard: true, html: `<div class="back-mark"><b>${esc(m.title)}</b>${esc(m.publisherEn)}</div>`, sr: '裏表紙' });

    pages.forEach((p) => { p.html = p.html.replace(/\{\{folio\}\}/g, String(p.index)); });
    S.pages = pages;
  }

  function renderBook() {
    const book = $('#book');
    book.innerHTML = S.pages.map((p) =>
      `<div class="pg pg--${p.kind}" data-index="${p.index}"${p.hard ? ' data-density="hard"' : ''}>${p.html}</div>`).join('');
  }

  /* =========================================================
     本の大きさ（見開き／一枚を自分で決め、高さに必ず収める）
     ========================================================= */
  function fitStage() {
    const wrap = $('.stage-wrap'), stage = $('#stage');
    const availW = wrap.clientWidth - EDGE * 2 - 4, availH = Math.max(240, wrap.clientHeight - 16);
    const ratio = PAGE_H / PAGE_W;
    const landW = Math.min(availW, (availH / ratio) * 2, MAX_W * 2);
    let w, portrait;
    if (landW >= MIN_W * 2) { w = landW; portrait = false; }
    else { w = Math.min(availW, availH / ratio, MIN_W * 2 - 2); portrait = true; }
    stage.style.width = Math.floor(w) + 'px';
    stage.classList.toggle('is-portrait', portrait);
  }

  /* =========================================================
     ページめくり
     ========================================================= */
  function initFlip(startPage) {
    const lite = (navigator.hardwareConcurrency || 8) <= 2;
    S.pf = new St.PageFlip($('#book'), {
      width: PAGE_W, height: PAGE_H, size: 'stretch',
      minWidth: MIN_W, maxWidth: MAX_W, minHeight: Math.round(MIN_W * PAGE_H / PAGE_W), maxHeight: Math.round(MAX_W * PAGE_H / PAGE_W),
      showCover: true, usePortrait: true, autoSize: true, mobileScrollSupport: false,
      drawShadow: !lite, maxShadowOpacity: 0.42, flippingTime: SPEEDS[S.speed] || 780,
      startPage: startPage, swipeDistance: 24, showPageCorners: true, disableFlipByClick: false, clickEventForward: true
    });
    S.pf.loadFromHTML(document.querySelectorAll('#book .pg'));
    tuneRelease(S.pf);
    S.current = S.pf.getCurrentPageIndex();
    S.orientation = S.pf.getOrientation();

    S.pf.on('flip', (e) => { S.current = e.data; afterPageChange(true); });
    S.pf.on('changeState', (e) => {
      const prev = S.flipState; S.flipState = e.data;
      if (e.data === 'flipping' && prev !== 'flipping') sound.swish();
      if (e.data === 'read' && prev === 'flipping') sound.land();
    });
    S.pf.on('changeOrientation', (e) => { S.orientation = e.data; afterPageChange(false); });
  }

  /* 指を離したときの判定を「移動量と速さ」で決め直す。
     元の実装は綴じ目を越えないと戻ってしまい、スマホの1ページ表示ではほぼめくれないため。 */
  const track = [];
  const note = (x) => { const t = performance.now(); track.push({ x, t }); while (track.length > 8 || (track.length && t - track[0].t > 180)) track.shift(); };
  window.addEventListener('mousemove', (e) => note(e.clientX), { passive: true });
  window.addEventListener('touchmove', (e) => { if (e.changedTouches[0]) note(e.changedTouches[0].clientX); }, { passive: true });
  ['mousedown', 'touchstart'].forEach((t) => window.addEventListener(t, () => { track.length = 0; }, { passive: true, capture: true }));
  const velocity = () => (track.length < 2 ? 0 : (track[track.length - 1].x - track[0].x) / Math.max(1, track[track.length - 1].t - track[0].t));

  function tuneRelease(pf) {
    const fc = pf.getFlipController && pf.getFlipController();
    if (!fc || typeof fc.stopMove !== 'function' || typeof fc.animateFlippingTo !== 'function') return;
    // めくる向きは「触れ始めた位置」で決める（タッチでは判定が遅れて逆向きになることがあるため）
    const origFold = fc.fold.bind(fc);
    fc.fold = function (p) {
      if (this.calc === null && pf.mousePosition) this.start(pf.mousePosition);
      return origFold(p);
    };
    fc.stopMove = function () {
      if (this.calc === null) return;
      const pos = this.calc.getPosition();
      const rect = this.render.getRect();
      const y = this.calc.getCorner() === 'bottom' ? rect.height : 0;
      const forward = this.calc.getDirection() === 0;
      const v = velocity();
      const flick = forward ? v < -0.45 : v > 0.45;
      const back = forward ? v > 0.3 : v < -0.3; // 戻す方向に振ったら戻す
      const go = !back && (flick || pos.x <= rect.pageWidth * 0.5);
      if (go) this.animateFlippingTo(pos, { x: -rect.pageWidth, y }, true);
      else this.animateFlippingTo(pos, { x: rect.pageWidth, y }, false);
    };
  }

  function visibleIndices() {
    const n = S.pages.length, c = S.current;
    if (S.orientation === 'portrait' || c === 0) return [c];
    if (c === n - 1 && n % 2 === 0) return [c];
    const left = c % 2 === 1 ? c : c - 1;
    return [left, left + 1].filter((i) => i >= 0 && i < n);
  }

  function pageLabel(i) {
    const p = S.pages[i]; if (!p) return '';
    if (p.kind === 'cover' || p.kind === 'back') return p.label;
    return 'p.' + i;
  }

  function updateEdges() {
    // 読んだ分は左に、残りは右に積もる。表紙を閉じているときは右だけ、裏表紙では左だけ。
    const n = S.pages.length - 1, c = Math.min(S.current, n);
    const stage = $('#stage');
    const portrait = S.orientation === 'portrait';
    const left = portrait ? 0 : Math.round(EDGE * c / n);
    const right = Math.round(EDGE * (n - c) / n);
    stage.style.setProperty('--edge-l', (c === 0 ? 0 : Math.max(left, c > 0 ? 2 : 0)) + 'px');
    stage.style.setProperty('--edge-r', (c >= n ? 0 : Math.max(right, 2)) + 'px');
    stage.classList.toggle('is-closed-front', !portrait && c === 0);
    stage.classList.toggle('is-closed-back', !portrait && c >= n);
  }

  function afterPageChange(announce) {
    updateEdges();
    const vis = visibleIndices();
    const range = $('#pg-range'); range.value = S.current;
    const words = vis.map((i) => S.pages[i]).filter((p) => p.kind === 'word');
    $('#pg-out').textContent = vis.length > 1 ? `${pageLabel(vis[0])}–${vis[1]}` : pageLabel(vis[0]);
    range.setAttribute('aria-valuetext', vis.map(pageLabel).join('から') + (words.length ? '、' + words.map((p) => p.word.word).join('と') : ''));
    $('#btn-prev').disabled = S.current <= 0;
    $('#btn-next').disabled = vis[vis.length - 1] >= S.pages.length - 1;
    store.set('pos', S.current);
    if (announce) $('#sr-live').textContent = vis.map((i) => S.pages[i].sr).join('　');
    if (announce && !$('#hint').hidden) closeHint();
    // 個別URL（ホスティング時のみ書き換え）
    if (window.top === window && /^https?:/.test(location.protocol)) {
      try { history.replaceState(null, '', words.length ? '#' + words[0].word.slug : location.pathname + location.search); } catch (e) { /* 無視 */ }
    }
  }

  function canAct() { return S.pf && (S.flipState === 'read' || S.flipState === 'flipping'); }
  function next() { if (canAct()) S.pf.flipNext(); }
  function prev() { if (canAct()) S.pf.flipPrev(); }

  function goTo(i, opts = {}) {
    if (!S.pf || i == null) return;
    i = Math.max(0, Math.min(S.pages.length - 1, i));
    if (visibleIndices().includes(i)) return;
    if (S.calm || opts.instant) { S.pf.turnToPage(i); S.current = S.pf.getCurrentPageIndex(); afterPageChange(true); }
    else S.pf.flip(i);
  }
  const goToSlug = (slug) => { const i = S.bySlug.get(slug); if (i != null) goTo(i); return i != null; };

  function randomWord() {
    const vis = visibleIndices();
    const pool = S.words.filter((w) => !vis.includes(S.bySlug.get(w.slug)));
    const w = pool[Math.floor(Math.random() * pool.length)];
    if (!w) return;
    const target = S.bySlug.get(w.slug);
    if (S.calm) return goTo(target, { instant: true });
    // ぱらぱら：近くまで瞬時に寄せ、最後の一枚だけめくる
    const step = S.orientation === 'portrait' ? 1 : 2;
    const pre = target > S.current ? target - step * 2 : target + step * 2;
    S.pf.turnToPage(Math.max(0, Math.min(S.pages.length - 1, pre)));
    S.current = S.pf.getCurrentPageIndex();
    requestAnimationFrame(() => S.pf.flip(target));
  }

  /* =========================================================
     音（紙の擦れを合成。操作後のみ鳴る）
     ========================================================= */
  const sound = (() => {
    let ctx = null, buf = null;
    const unlock = () => {
      if (ctx || !S.sound) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        ctx = new AC();
        buf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
        const d = buf.getChannelData(0); let last = 0;
        for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = last * 0.6 + w * 0.4; d[i] = last; }
      } catch (e) { ctx = null; }
    };
    ['pointerdown', 'keydown', 'touchstart'].forEach((t) => window.addEventListener(t, unlock, { passive: true }));
    function play(dur, f0, f1, gain, q) {
      if (!S.sound || !ctx) return;
      try {
        if (ctx.state === 'suspended') ctx.resume();
        const t = ctx.currentTime, src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
        src.buffer = buf; bp.type = 'bandpass'; bp.Q.value = q;
        bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(bp); bp.connect(g); g.connect(ctx.destination); src.start(t); src.stop(t + dur + 0.02);
      } catch (e) { /* 鳴らなくても読める */ }
    }
    return {
      swish: () => play(Math.min(0.5, (SPEEDS[S.speed] || 780) / 1600), 2600, 700, 0.22, 0.9),
      land: () => play(0.09, 420, 180, 0.12, 1.4),
      unlock
    };
  })();

  /* =========================================================
     しおり・共有
     ========================================================= */
  function toggleFav(slug) {
    const on = !S.favs.has(slug);
    on ? S.favs.add(slug) : S.favs.delete(slug);
    store.set('favs', [...S.favs]);
    document.querySelectorAll(`[data-favmark="${CSS.escape(slug)}"]`).forEach((el) => { el.hidden = !on; });
    document.querySelectorAll(`.w-act[data-act="fav"][data-slug="${CSS.escape(slug)}"]`).forEach((b) => b.setAttribute('aria-pressed', String(on)));
    const w = S.words.find((x) => x.slug === slug);
    toast(on ? `「${w.word}」にしおりを挟みました` : `「${w.word}」のしおりを外しました`);
    if (S.panel === 'fav') renderPanel('fav');
  }

  function shareUrl(w) {
    const hosted = window.top === window && /^https?:/.test(location.protocol);
    const base = hosted ? location.origin + location.pathname : S.meta.shareBaseUrl;
    return base + '#' + w.slug;
  }
  const shareText = (w) => `【${w.word}】${w.definition}\n――『${S.meta.title}』${S.meta.publisher}`;

  async function copyText(text, done) {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
      try { const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); } catch (e2) { ok = false; }
    }
    toast(ok ? done : 'コピーできませんでした。文字を長押しして選んでください');
  }

  /* =========================================================
     パネル（目次・検索・しおり・設定・共有）
     ========================================================= */
  const TITLES = { toc: '目次', search: '検索・索引', fav: 'しおり', settings: '音と表示', share: '共有' };
  let shareSlug = null;

  function wordItem(w) {
    return `<li><button type="button" class="p-item" data-goto="${esc(w.slug)}">
      <span class="w">${esc(w.word)}</span><span class="r">${esc(w.reading)}</span><span class="n">${pad3(w.id)}</span>
      <span class="d">${esc(w.definition)}</span></button></li>`;
  }

  function renderPanel(kind, opts = {}) {
    const body = $('#panel-body');
    $('#panel-title').textContent = TITLES[kind];
    if (kind === 'toc') {
      const firstOfRow = new Map();
      S.words.forEach((w) => { const r = rowOf(w.reading); if (!firstOfRow.has(r)) firstOfRow.set(r, w); });
      const sec = (label, i, sub = '') => `<li><button type="button" class="p-item" data-page="${i}"><span class="w">${label}</span><span class="r">${sub}</span><span class="n">p.${i}</span></button></li>`;
      const tocPages = S.pages.filter((p) => p.toc);
      body.innerHTML = `
        <p class="p-sec">はじまり</p><ul class="p-list">
          <li><button type="button" class="p-item" data-page="0"><span class="w">最初から読む</span><span class="r">表紙へ</span><span class="n"></span></button></li>
          ${tocPages.filter((p) => p.kind === 'intro' || p.kind === 'howto').map((p) => sec(p.label, p.index)).join('')}</ul>
        <p class="p-sec">本文</p><ul class="p-list">
          ${[...firstOfRow.entries()].map(([r, w]) => sec(ROWS[r][0], S.bySlug.get(w.slug), `${esc(w.word)} から`)).join('')}</ul>
        <p class="p-sec">おわりに</p><ul class="p-list">
          ${tocPages.filter((p) => p.kind === 'index' || p.kind === 'colophon').map((p) => sec(p.label, p.index)).join('')}</ul>`;
    } else if (kind === 'search') {
      const present = new Set(S.words.map((w) => rowOf(w.reading)));
      body.innerHTML = `
        <div class="search-box"><label class="sr" for="q">見出し語・読み・定義で探す</label>
          <input id="q" type="search" placeholder="言葉・よみ・定義の一部" autocomplete="off" enterkeyhint="search">
          <div class="kana-row" role="group" aria-label="五十音で開く">${ROWS.map((r, i) =>
            `<button type="button" data-row="${i}" ${present.has(i) ? '' : 'disabled'} aria-label="${r[0]}を開く">${r[0].charAt(0)}</button>`).join('')}</div>
        </div>
        <p class="p-sec" id="q-count"></p><ul class="p-list" id="q-list"></ul>`;
      const q = $('#q'); q.value = opts.q || '';
      const run = () => {
        const v = toHira(q.value.trim());
        const list = !v ? S.words : S.words.filter((w) => [w.word, w.reading, w.definition, w.dictionary].some((s) => toHira(s).includes(v)));
        $('#q-count').textContent = v ? `「${q.value.trim()}」　${list.length}語` : `全${S.words.length}語　五十音順`;
        $('#q-list').innerHTML = list.length ? list.map(wordItem).join('') : `<li class="p-empty">見つかりませんでした。<br>ひらがなの読みでも探せます。</li>`;
      };
      q.addEventListener('input', run); run();
    } else if (kind === 'fav') {
      const list = S.words.filter((w) => S.favs.has(w.slug));
      body.innerHTML = list.length
        ? `<p class="p-sec">${list.length}語にしおり</p><ul class="p-list">${list.map(wordItem).join('')}</ul>`
        : `<p class="p-empty">まだしおりはありません。<br>気になった言葉のページで「しおり」を押すと、ここに集まります。</p>`;
    } else if (kind === 'settings') {
      body.innerHTML = `
        <div class="set-row"><label for="set-sound">ページをめくる音<small>端末の音量で鳴ります</small></label><input type="checkbox" class="switch" id="set-sound" ${S.sound ? 'checked' : ''}></div>
        <div class="set-row"><span class="lbl" id="speed-lbl">めくる速さ</span>
          <span class="seg" role="group" aria-labelledby="speed-lbl">${[['slow', 'ゆっくり'], ['normal', 'ふつう'], ['fast', 'はやい']].map(([k, l]) =>
            `<button type="button" data-speed="${k}" aria-pressed="${S.speed === k}">${l}</button>`).join('')}</span></div>
        <div class="set-row"><label for="set-calm">動きを抑える<small>目次や検索から、めくらずに直接開きます</small></label><input type="checkbox" class="switch" id="set-calm" ${S.calm ? 'checked' : ''}></div>
        <div class="set-row"><label for="set-large">文字を大きく<small>本文の文字をひとまわり大きくします</small></label><input type="checkbox" class="switch" id="set-large" ${S.large ? 'checked' : ''}></div>
        <p class="p-empty">操作：ページの角をドラッグ、ページをタップ、スワイプ、← → キー。Home／End で最初と最後へ。</p>`;
    } else if (kind === 'share') {
      const w = S.words.find((x) => x.slug === shareSlug); if (!w) return;
      const url = shareUrl(w), text = shareText(w);
      const x = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url);
      const line = 'https://social-plugins.line.me/lineit/share?url=' + encodeURIComponent(url);
      body.innerHTML = `
        <div class="share-card"><div class="w">【${esc(w.word)}】</div><p>${esc(w.definition)}</p></div>
        <div class="share-actions">
          <button type="button" id="sh-def">定義をコピー</button>
          <button type="button" id="sh-link">リンクをコピー</button>
          <a href="${x}" target="_blank" rel="noopener">X で共有</a>
          <a href="${line}" target="_blank" rel="noopener">LINE で送る</a>
          ${navigator.share ? '<button type="button" id="sh-native" style="grid-column:1/-1">ほかのアプリで共有</button>' : ''}
        </div>
        <p class="share-url">${esc(url)}</p>`;
      $('#sh-def').onclick = () => copyText(text, '定義をコピーしました');
      $('#sh-link').onclick = () => copyText(url, 'リンクをコピーしました');
      const nat = $('#sh-native');
      if (nat) nat.onclick = async () => { try { await navigator.share({ title: `【${w.word}】${S.meta.title}`, text, url }); } catch (e) { /* キャンセル */ } };
    }
  }

  function openPanel(kind, opener, opts) {
    S.panel = kind; S.opener = opener || document.activeElement;
    renderPanel(kind, opts);
    $('#scrim').hidden = false; $('#panel').hidden = false;
    const f = $('#panel-body input, #panel-body button, #panel-body a') || $('#panel-close');
    setTimeout(() => (kind === 'search' ? $('#q') : f).focus({ preventScroll: true }), 30);
  }
  function closePanel() {
    if (!S.panel) return;
    S.panel = null; $('#scrim').hidden = true; $('#panel').hidden = true;
    if (S.opener && S.opener.focus && document.contains(S.opener)) S.opener.focus({ preventScroll: true });
  }

  /* ---------- 小さな知らせ ---------- */
  let toastTimer = 0;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2200); }
  function closeHint() { $('#hint').hidden = true; store.set('hint', 1); }

  /* =========================================================
     操作の配線
     ========================================================= */
  function wire() {
    $('#btn-next').addEventListener('click', next);
    $('#btn-prev').addEventListener('click', prev);
    $('#btn-random').addEventListener('click', randomWord);
    $('#hint-close').addEventListener('click', closeHint);
    document.querySelectorAll('[data-panel]').forEach((b) => b.addEventListener('click', () => openPanel(b.dataset.panel, b)));
    $('#panel-close').addEventListener('click', closePanel);
    $('#scrim').addEventListener('click', closePanel);

    const range = $('#pg-range');
    range.max = String(S.pages.length - 1);
    range.addEventListener('input', () => { $('#pg-out').textContent = pageLabel(+range.value); });
    range.addEventListener('change', () => goTo(+range.value, { instant: true }));

    // 本の中のボタン（索引・しおり・共有）
    $('#book').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      e.stopPropagation();
      if (b.dataset.goto) goToSlug(b.dataset.goto);
      else if (b.dataset.act === 'fav') toggleFav(b.dataset.slug);
      else if (b.dataset.act === 'share') { shareSlug = b.dataset.slug; openPanel('share', b); }
    });

    // タッチ端末の短いタップ（ライブラリは短いタップではめくらないため補う）
    let tp = null;
    $('#book').addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      tp = (e.touches.length === 1 && !e.target.closest('button, a')) ? { x: t.clientX, y: t.clientY, t: Date.now() } : null;
    }, { passive: true });
    $('#book').addEventListener('touchend', (e) => {
      if (!tp) return; const t = e.changedTouches[0];
      const moved = Math.hypot(t.clientX - tp.x, t.clientY - tp.y), dt = Date.now() - tp.t; tp = null;
      if (moved > 10 || dt > 240) return; // スワイプ・長押しはライブラリに任せる
      const r = $('#book .stf__block').getBoundingClientRect();
      ((t.clientX - r.left) / r.width > 0.5 ? next : prev)();
    }, { passive: true });

    // パネル内
    $('#panel-body').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.goto) { closePanel(); goToSlug(b.dataset.goto); }
      else if (b.dataset.page != null) { closePanel(); goTo(+b.dataset.page); }
      else if (b.dataset.row != null) {
        const w = S.words.find((x) => rowOf(x.reading) === +b.dataset.row);
        if (w) { closePanel(); goToSlug(w.slug); }
      } else if (b.dataset.speed) {
        S.speed = b.dataset.speed; store.set('speed', S.speed);
        if (S.pf) S.pf.getSettings().flippingTime = SPEEDS[S.speed];
        b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      }
    });
    $('#panel-body').addEventListener('change', (e) => {
      const t = e.target;
      if (t.id === 'set-sound') { S.sound = t.checked; store.set('sound', S.sound); if (S.sound) sound.unlock(); syncSoundIcon(); }
      if (t.id === 'set-calm') { S.calm = t.checked; store.set('calm', S.calm); }
      if (t.id === 'set-large') { S.large = t.checked; store.set('large', S.large); applyLarge(); }
    });

    // キーボード
    document.addEventListener('keydown', (e) => {
      if (S.panel) {
        if (e.key === 'Escape') { e.preventDefault(); closePanel(); }
        else if (e.key === 'Tab') trapFocus(e);
        return;
      }
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
      else if (e.key === 'Home') { e.preventDefault(); goTo(0); }
      else if (e.key === 'End') { e.preventDefault(); goTo(S.pages.length - 1); }
    });

    window.addEventListener('hashchange', () => { const s = location.hash.slice(1); if (S.bySlug.has(s)) goToSlug(s); });
  }

  function trapFocus(e) {
    const f = [...$('#panel').querySelectorAll('button:not([disabled]), a[href], input')].filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function syncSoundIcon() { $('[data-panel="settings"]').setAttribute('aria-pressed', String(S.sound)); }
  function applyLarge() { document.documentElement.style.setProperty('--fs', S.large ? '1.12' : '1'); }

  /* =========================================================
     起動
     ========================================================= */
  async function boot() {
    applyLarge(); syncSoundIcon();
    let data;
    try {
      const res = await fetch('words.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status);
      data = await res.json();
    } catch (e) {
      $('#loading').innerHTML = '言葉のデータ（words.json）を読み込めませんでした。<br>ローカルで開く場合は README の手順でサーバーを起動してください。';
      $('#loading').style.textAlign = 'center'; $('#loading').style.lineHeight = '2';
      return;
    }
    if (typeof St === 'undefined' || !St.PageFlip) { $('#loading').textContent = 'ページめくりの部品を読み込めませんでした。'; return; }

    S.meta = data.meta;
    S.words = data.words.filter((w) => w && w.word && w.slug).slice().sort((a, b) => collator.compare(a.reading, b.reading) || a.order - b.order);
    buildPages(); renderBook();

    fitStage();
    window.addEventListener('resize', fitStage);           // ライブラリより先に寸法を決める
    window.addEventListener('orientationchange', () => setTimeout(() => { fitStage(); S.pf && S.pf.update(); }, 120));

    const hash = decodeURIComponent(location.hash.slice(1));
    let start = S.bySlug.has(hash) ? S.bySlug.get(hash) : store.get('pos', 0);
    if (!(start >= 0 && start < S.pages.length)) start = 0;
    initFlip(start);
    wire();
    $('#loading').hidden = true;
    afterPageChange(false);
    $('#sr-live').textContent = visibleIndices().map((i) => S.pages[i].sr).join('　');

    if (!store.get('hint', 0)) $('#hint').hidden = false;
  }

  boot();
})();
