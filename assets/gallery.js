/* HYOGEN LAB408Gallery — ページ共通の動き
 * ・作品体験へ進むときに「戻り先」を覚える（体験ページの「展示へ戻る」で使う）
 * ・一覧のスクロール位置を覚えて、戻ってきたときに同じ位置へ
 * ・作品一覧の絞り込み（検索・主展示室・媒体）
 * ・お気に入り・メモ・自分の展示録の表示
 * ・動きを減らす表示の切り替え
 */
(function () {
  'use strict';
  var R = window.HL408Record;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var canStore = !!(R && R.available());

  function toast(msg) {
    var t = $('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(function () { t.hidden = true; }, 3200);
  }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }

  /* 言語（<html lang>）ごとの言葉。日本語はそのまま */
  var LANG = (document.documentElement.lang || 'ja').slice(0, 2);
  var MSG = {
    en: { liteOn: 'Reduce motion: On', liteOff: 'Reduce motion: Off', noSave: 'This setting cannot be saved in this browser', liteDone: 'Motion reduced (VOICE BLOOM also switches to a lighter display)', liteUndo: 'Back to the normal display', back: 'Back to the gallery', all: 'All works and records ', unit: '', sep: ' · ', q1: '“', q2: '”' },
    zh: { liteOn: '减少动态效果：开', liteOff: '减少动态效果：关', noSave: '此浏览器无法保存该设置', liteDone: '已减少动态效果（VOICE BLOOM 也会切换为轻量显示）', liteUndo: '已恢复正常显示', back: '返回展厅', all: '全部作品与记录 ', unit: '件', sep: '・', q1: '“', q2: '”' },
    ko: { liteOn: '움직임 줄이기: 켬', liteOff: '움직임 줄이기: 끔', noSave: '이 브라우저에서는 이 설정을 저장할 수 없습니다', liteDone: '움직임을 줄였습니다 (VOICE BLOOM도 가벼운 화면으로 바뀝니다)', liteUndo: '보통 화면으로 되돌렸습니다', back: '전시로 돌아가기', all: '모든 작품과 기록 ', unit: '건', sep: ' · ', q1: '“', q2: '”' }
  }[LANG] || { liteOn: '動きを減らす：オン', liteOff: '動きを減らす：オフ', noSave: 'この設定はこのブラウザでは保存できません', liteDone: '動きを減らしました（VOICE BLOOM も軽い表示になります）', liteUndo: '通常の表示に戻しました', back: '展示へ戻る', all: 'すべての作品と記録 ', unit: '件', sep: '・', q1: '「', q2: '」' };

  /* ---- 動きを減らす ---- */
  function isLite() { try { return localStorage.getItem('hl408:lite') === '1'; } catch (e) { return false; } }
  if (isLite()) document.documentElement.classList.add('lite');
  $$('[data-lite-toggle]').forEach(function (b) {
    var sync = function () { b.setAttribute('aria-pressed', String(isLite())); b.textContent = isLite() ? MSG.liteOn : MSG.liteOff; };
    sync();
    b.addEventListener('click', function () {
      try { localStorage.setItem('hl408:lite', isLite() ? '0' : '1'); } catch (e) { return toast(MSG.noSave); }
      document.documentElement.classList.toggle('lite', isLite()); sync();
      toast(isLite() ? MSG.liteDone : MSG.liteUndo);
    });
  });


  /* ---- 展示室の照明と、額の傾き（マウスのある端末だけ。動きを減らす設定では使わない） ---- */
  var still = function () { return isLite() || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); };
  if (window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var raf = 0, px = 0, py = 0;
    window.addEventListener('pointermove', function (e) {
      px = e.clientX; py = e.clientY;
      if (raf || still()) return;
      raf = requestAnimationFrame(function () { raf = 0; var st = document.body.style; st.setProperty('--mx', px + 'px'); st.setProperty('--my', py + 'px'); });
    }, { passive: true });
    $$('.piece').forEach(function (p) {
      p.addEventListener('pointermove', function (e) {
        if (still()) return;
        var r = p.getBoundingClientRect(), dx = (e.clientX - r.left) / r.width - .5, dy = (e.clientY - r.top) / r.height - .5;
        p.style.setProperty('--ry', (dx * 5).toFixed(2) + 'deg'); p.style.setProperty('--rx', (-dy * 4).toFixed(2) + 'deg');
      });
      p.addEventListener('pointerleave', function () { p.style.removeProperty('--rx'); p.style.removeProperty('--ry'); });
    });
  }


  /* ---- ページ移動のアニメーション（View Transitions）の後始末 ----
     作品の体験ページは別の作品ファイルなので、移動のアニメーションをかけない。
     途中で取りやめになったときの通知は、エラーとして残さない。 */
  function quietVT(vt) { if (!vt) return; ['ready', 'finished', 'updateCallbackDone'].forEach(function (k) { if (vt[k] && vt[k].catch) vt[k].catch(function () {}); }); }
  window.addEventListener('pageswap', function (e) {
    quietVT(e.viewTransition);
    var to = e.activation && e.activation.entry && e.activation.entry.url;
    if (e.viewTransition && (isLite() || (to && /\/experience\//.test(to)))) e.viewTransition.skipTransition();
  });
  window.addEventListener('pagereveal', function (e) { quietVT(e.viewTransition); if (e.viewTransition && isLite()) e.viewTransition.skipTransition(); });

  /* ---- 入口の「ひらく」 ---- */
  var op = $('.seal');
  if (op) requestAnimationFrame(function () { setTimeout(function () { op.classList.add('is-open'); }, 250); });

  /* ---- 戻り先とスクロール位置 ---- */
  var scrollKey = 'hl408:scroll:' + location.pathname + location.search;
  function rememberScroll() { ss(scrollKey, String(Math.round(window.scrollY))); }
  window.addEventListener('pagehide', rememberScroll);
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-exp], a[data-work]');
    if (!a) return;
    rememberScroll();
    if (a.hasAttribute('data-exp')) ss('hl408:return', JSON.stringify({ href: location.href, label: MSG.back }));
  });
  /* 館内マップなどから「#部屋」つきで来たとき：画像や文字が後から入って位置がずれても、部屋の看板を画面の上に合わせ直す */
  (function () {
    var id = location.hash && location.hash.slice(1); if (!id) return;
    var el = document.getElementById(id); if (!el) return;
    var moved = false;
    ['wheel', 'touchstart', 'keydown'].forEach(function (t) { window.addEventListener(t, function () { moved = true; }, { once: true, passive: true }); });
    function align() { if (!moved && !el.hidden) el.scrollIntoView({ block: 'start' }); }
    requestAnimationFrame(align);
    window.addEventListener('load', align);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(align);
    setTimeout(align, 600);
  })();
  /* 入口の扉が出ているときに「館内案内」を押したら、演出を飛ばして館内マップへ */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href$="#floor"]');
    if (!a || !document.getElementById('threshold')) return;
    if (document.documentElement.dataset.entry === 'lobby') return;
    e.preventDefault();
    var sk = document.getElementById('skip'); if (sk) sk.click();
    setTimeout(function () { var f = document.getElementById('floor'); if (f) f.scrollIntoView({ block: 'start' }); try { history.replaceState(null, '', '#floor'); } catch (x) {} }, 80);
  });
  function restoreScroll() {
    var y = parseInt(ss(scrollKey) || '', 10);
    if (!isFinite(y) || y <= 0) return;
    var ref = document.referrer || '';
    var nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || {};
    var cameBack = nav.type === 'back_forward' || /\/experience\//.test(ref) || /\/works\/[^/]+\/(index\.html)?$/.test(ref);
    if (cameBack && !location.hash) window.scrollTo(0, y);
  }

  /* ---- 作品一覧の絞り込み ---- */
  var list = $('#work-list');
  if (list) {
    var form = $('#filter-form'), q = $('#q'), line = $('#result-line'), none = $('#no-result');
    var cards = $$('.card', list);
    var state = { q: '', room: '', media: '', kind: '', reach: '', wall: '', wm: '' };
    var params = new URLSearchParams(location.search);
    state.q = params.get('q') || ''; state.room = params.get('room') || ''; state.media = params.get('media') || ''; state.kind = params.get('kind') || ''; state.reach = params.get('reach') || ''; state.wall = params.get('wall') || ''; state.wm = params.get('wm') || '';
    var wm = $('#wall-main'); if (wm) { wm.checked = state.wm === '1'; wm.addEventListener('change', function () { state.wm = wm.checked ? '1' : ''; apply(true); }); }
    q.value = state.q;
    function norm(s) { return String(s || '').toLowerCase().normalize('NFKC'); }
    function apply(push) {
      var shown = 0, words = norm(state.q).split(/\s+/).filter(Boolean);
      cards.forEach(function (c) {
        var hay = norm(c.getAttribute('data-search'));
        var ok = (!state.reach || c.getAttribute('data-reach') === state.reach) &&
          (!state.wall || (state.wm ? c.getAttribute('data-wallmain') === state.wall : (c.getAttribute('data-wall') || '').split('|').indexOf(state.wall) >= 0)) &&
          (!state.kind || c.getAttribute('data-kind') === state.kind) &&
          (!state.room || c.getAttribute('data-room') === state.room) &&
          (!state.media || (c.getAttribute('data-media') || '').split('|').indexOf(state.media) >= 0) &&
          words.every(function (w) { return hay.indexOf(w) >= 0; });
        c.hidden = !ok; if (ok) shown++;
      });
      $$('[data-filter]').forEach(function (b) {
        var k = b.getAttribute('data-filter'), v = b.getAttribute('data-value');
        b.setAttribute('aria-pressed', String(state[k] === v));
      });
      var parts = [];
      if (state.room) { var rb = $('[data-filter="room"][data-value="' + state.room + '"]'); if (rb) parts.push(rb.getAttribute('data-name')); }
      ['reach', 'wall'].forEach(function (k) { if (state[k]) { var b = $('[data-filter="' + k + '"][data-value="' + state[k] + '"]'); parts.push(b ? b.getAttribute('data-name') : state[k]); } });
      if (state.kind) { var kb = $('[data-filter="kind"][data-value="' + state.kind + '"]'); if (kb) parts.push(kb.getAttribute('data-name')); }
      if (state.media) parts.push(state.media);
      if (state.q) parts.push(MSG.q1 + state.q + MSG.q2);
      $$('[data-room-wall]', list).forEach(function (wall) { wall.hidden = !$$('.card', wall).some(function (c) { return !c.hidden; }); });
      $$('[data-archive]', list).forEach(function (ar) { ar.hidden = !$$('.card', ar).some(function (c) { return !c.hidden; }); });
      line.textContent = (parts.length ? parts.join(MSG.sep) + ' ' : MSG.all) + shown + MSG.unit;
      none.hidden = shown > 0;
      if (push) {
        var p = new URLSearchParams();
        if (state.q) p.set('q', state.q); if (state.room) p.set('room', state.room); if (state.media) p.set('media', state.media); if (state.kind) p.set('kind', state.kind); if (state.reach) p.set('reach', state.reach); if (state.wall) p.set('wall', state.wall); if (state.wm) p.set('wm', state.wm);
        var url = location.pathname + (p.toString() ? '?' + p.toString() : '');
        try { history.replaceState(null, '', url); } catch (e) {}
        scrollKey = 'hl408:scroll:' + location.pathname + location.search;
      }
    }
    $$('[data-filter]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-filter'), v = b.getAttribute('data-value');
        state[k] = state[k] === v ? '' : v; apply(true);
      });
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); state.q = q.value.trim(); apply(true); });
    q.addEventListener('input', function () { state.q = q.value.trim(); apply(true); });
    $('#filter-clear').addEventListener('click', function () { state = { q: '', room: '', media: '', kind: '', reach: '', wall: '', wm: '' }; if ($('#wall-main')) $('#wall-main').checked = false; q.value = ''; apply(true); });
    apply(false);
  }

  /* ---- お気に入り（作品詳細・一覧） ---- */
  function syncFav(btn) {
    var on = canStore && R.isFav(btn.getAttribute('data-fav'));
    btn.setAttribute('aria-pressed', String(on));
    var full = btn.getAttribute('data-full') === '1';
    btn.textContent = full ? (on ? '展示録に入っています' : '展示録に加える') : (on ? '★' : '☆');
    if (!full) btn.setAttribute('aria-label', on ? '展示録から外す' : '展示録に加える');
  }
  $$('[data-fav]').forEach(function (b) {
    if (!canStore) { b.disabled = true; b.title = 'このブラウザでは保存できません'; }
    syncFav(b);
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (!canStore) return toast('このブラウザでは展示録に保存できません');
      var r = R.toggleFav(b.getAttribute('data-fav'), b.getAttribute('data-title'));
      if (!r.ok) return toast('保存できませんでした');
      $$('[data-fav="' + b.getAttribute('data-fav') + '"]').forEach(syncFav);
      toast(r.on ? '展示録に加えました' : '展示録から外しました');
    });
  });

  /* ---- 作品のメモ ---- */
  var memo = $('#memo');
  if (memo) {
    var slug = memo.getAttribute('data-slug'), title = memo.getAttribute('data-title'), st = $('#memo-state');
    if (!canStore) { memo.disabled = true; st.textContent = 'このブラウザでは保存できないため、メモは使えません。'; }
    else {
      var f = R.get().favorites[slug]; if (f && f.note) memo.value = f.note;
      var t = 0;
      memo.addEventListener('input', function () {
        st.textContent = '書いています…';
        clearTimeout(t); t = setTimeout(function () {
          var r = R.setNote(slug, title, memo.value);
          st.textContent = r.ok ? 'この端末に保存しました' : '保存できませんでした';
          $$('[data-fav="' + slug + '"]').forEach(syncFav);
        }, 500);
      });
    }
  }
  /* 作品詳細を開いたことを記録（「最近見た作品」） */
  var visit = $('[data-visit]');
  if (visit && canStore) R.markVisit(visit.getAttribute('data-visit'), visit.getAttribute('data-title'));

  /* 保存できない環境の案内 */
  if (!canStore) $$('[data-store-warn]').forEach(function (el) { el.hidden = false; });

  /* ---- 自分の展示録 ---- */
  var my = $('#my-record');
  if (my) renderMy();
  function fmtDate(iso) {
    var d = new Date(iso); if (isNaN(d)) return '';
    return d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  async function saveImage(dataUrl, name) {
    try {
      var dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
      if (dl) { var blob = await (await fetch(dataUrl)).blob(); await dl.save({ filename: name, data: blob }); return; }
    } catch (e) { return; }
    var a = document.createElement('a'); a.href = dataUrl; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
  function confirmRow(label, onYes, onNo) {
    var box = el('div', { class: 'confirm', role: 'group', 'aria-label': '確認' }, [
      el('span', { text: label }),
      el('button', { class: 'btn small danger', type: 'button', text: '消す' }),
      el('button', { class: 'btn small quiet', type: 'button', text: 'やめる' })
    ]);
    var b = box.querySelectorAll('button');
    b[0].addEventListener('click', onYes);
    b[1].addEventListener('click', function () { if (onNo) onNo(); else renderMy(); });
    return box;
  }
  function renderMy() {
    var data = window.__WORKS__ || {};
    var d = canStore ? R.get() : { favorites: {}, captures: [], visits: {} };
    var favBox = $('#my-favs'), capBox = $('#my-captures'), visBox = $('#my-visits');
    favBox.textContent = ''; capBox.textContent = ''; visBox.textContent = '';
    var slugs = Object.keys(d.favorites).sort(function (a, b) { return (d.favorites[b].addedAt || '').localeCompare(d.favorites[a].addedAt || ''); });
    $('#my-fav-count').textContent = slugs.length + '件';
    if (!slugs.length) favBox.appendChild(el('p', { class: 'empty', text: 'まだありません。作品のページで「展示録に加える」を押すか、メモを書くと、ここに並びます。' }));
    else {
      var ul = el('ul', { class: 'favs' });
      slugs.forEach(function (s) {
        var w = data[s] || { title: d.favorites[s].title, href: null, cover: null };
        var ta = el('textarea', { id: 'note-' + s, 'aria-label': w.title + ' のメモ' }); ta.value = d.favorites[s].note || '';
        var st = el('span', { class: 'store-note', 'aria-live': 'polite' });
        var t = 0;
        ta.addEventListener('input', function () { clearTimeout(t); st.textContent = '書いています…'; t = setTimeout(function () { var r = R.setNote(s, w.title, ta.value); st.textContent = r.ok ? '保存しました' : '保存できませんでした'; }, 500); });
        var rm = el('button', { class: 'btn small quiet', type: 'button', text: '展示録から外す' });
        var li = el('li', { class: 'fav' }, [
          w.cover ? el('a', { href: w.href, class: 'frame', 'aria-hidden': 'true', tabindex: '-1' }, [el('img', { src: w.cover, alt: '', loading: 'lazy' })]) : el('div', { class: 'frame light' }),
          el('div', { style: 'display:grid;gap:10px;min-width:0' }, [
            el('h3', {}, [w.href ? el('a', { href: w.href, 'data-work': '', text: w.title }) : el('span', { text: w.title })]),
            el('span', { class: 'store-note', text: '加えた日時 ' + fmtDate(d.favorites[s].addedAt) }),
            el('div', { class: 'memo' }, [el('label', { for: 'note-' + s, text: 'メモ' }), ta, st]),
            el('div', { class: 'actions' }, [w.href ? el('a', { class: 'btn small', href: w.href, 'data-work': '', text: 'もう一度見る' }) : null, rm])
          ])
        ]);
        rm.addEventListener('click', function () { rm.parentNode.replaceChild(confirmRow('メモも消えます。外しますか？', function () { R.removeFav(s); renderMy(); toast('外しました'); }), rm); });
        ul.appendChild(li);
      });
      favBox.appendChild(ul);
    }
    $('#my-cap-count').textContent = d.captures.length + '件';
    if (!d.captures.length) capBox.appendChild(el('p', { class: 'empty', text: 'まだありません。VOICE BLOOM で花を咲かせて「展示録に残す」を押すと、ここに並びます。' }));
    else {
      var cl = el('ul', { class: 'captures' });
      d.captures.forEach(function (c) {
        var m = c.meta || {};
        var inp = { mic: 'マイク', file: '録音ファイル', demo: 'デモ音（合成音）' }[m.input] || '';
        var save = el('button', { class: 'btn small', type: 'button', text: '画像を保存' });
        var del = el('button', { class: 'btn small quiet', type: 'button', text: '消す' });
        var w = data[c.slug];
        var li = el('li', { class: 'capture' }, [
          el('img', { src: c.image, alt: (c.title || '') + ' で咲かせた花（' + fmtDate(c.createdAt) + '）', loading: 'lazy' }),
          el('div', {}, [el('strong', { text: c.title || '' }), el('div', { class: 'meta', text: fmtDate(c.createdAt) + (inp ? ' ・ ' + inp : '') + (m.seed != null ? ' ・ seed ' + m.seed : '') })]),
          el('div', { class: 'actions' }, [save, w ? el('a', { class: 'btn small quiet', href: w.exp || w.href, 'data-exp': '', text: 'もう一度咲かせる' }) : null, del])
        ]);
        save.addEventListener('click', function () { saveImage(c.image, (c.slug || 'bloom') + '-' + (m.seed != null ? m.seed : c.id) + '.jpg'); });
        del.addEventListener('click', function () { del.parentNode.replaceChild(confirmRow('この画像を消しますか？', function () { R.removeCapture(c.id); renderMy(); toast('消しました'); }), del); });
        cl.appendChild(li);
      });
      capBox.appendChild(cl);
    }
    var vs = Object.keys(d.visits).sort(function (a, b) { return (d.visits[b].at || '').localeCompare(d.visits[a].at || ''); }).slice(0, 8);
    if (!vs.length) visBox.appendChild(el('p', { class: 'store-note', text: 'まだありません。' }));
    else {
      var vl = el('ul', { class: 'path-list', style: 'list-style:none;margin:0;padding:0;display:grid;gap:0' });
      vs.forEach(function (s) {
        var w = data[s] || { title: d.visits[s].title };
        vl.appendChild(el('li', { style: 'display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--rule)' }, [
          w.href ? el('a', { href: w.href, 'data-work': '', text: w.title }) : el('span', { text: w.title }),
          el('span', { class: 'store-note', text: fmtDate(d.visits[s].at) })
        ]));
      });
      visBox.appendChild(vl);
    }
  }
  /* 一覧の絞り込みを当てた後で、もとの位置へ戻す */
  restoreScroll();

  var clear = $('#my-clear');
  if (clear) clear.addEventListener('click', function () {
    var box = confirmRow('お気に入り・メモ・残した花・見た記録を、この端末からすべて消しますか？', function () { R.clearAll(); box.replaceWith(clear); renderMy(); toast('すべて消しました'); }, function () { box.replaceWith(clear); });
    clear.replaceWith(box);
  });
})();
