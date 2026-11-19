/* HYOGEN LAB408Gallery — 自分の展示録（この端末のブラウザだけに保存）
 * ギャラリーの各ページと、VOICE BLOOM の体験ページの両方から使う。
 * 保存先は localStorage。端末をまたいだ同期はしない。
 * 保存できない環境（プライベートモード、保存の拒否など）では available() が false を返す。
 */
(function (root) {
  'use strict';
  var KEY = 'hl408-gallery:v1';
  var MAX_CAPTURES = 24;

  function empty() { return { v: 1, favorites: {}, captures: [], visits: {} }; }

  function available() {
    try {
      var k = KEY + ':probe';
      root.localStorage.setItem(k, '1');
      root.localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  }

  function load() {
    try {
      var raw = root.localStorage.getItem(KEY);
      if (!raw) return empty();
      var d = JSON.parse(raw);
      if (!d || d.v !== 1) return empty();
      d.favorites = d.favorites || {}; d.captures = d.captures || []; d.visits = d.visits || {};
      return d;
    } catch (e) { return empty(); }
  }

  /* 書き込み。容量不足のときは古い画像から減らして、もう一度試す */
  function save(d) {
    for (var i = 0; i < 30; i++) {
      try { root.localStorage.setItem(KEY, JSON.stringify(d)); return { ok: true }; }
      catch (e) {
        var quota = e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);
        if (quota && d.captures.length > 1) { d.captures.pop(); continue; }
        return { ok: false, reason: quota ? 'quota' : 'unavailable' };
      }
    }
    return { ok: false, reason: 'quota' };
  }

  function now() { return new Date().toISOString(); }
  function id() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  var api = {
    available: available,
    get: load,
    isFav: function (slug) { return !!load().favorites[slug]; },
    toggleFav: function (slug, title) {
      var d = load();
      if (d.favorites[slug]) delete d.favorites[slug];
      else d.favorites[slug] = { title: title || slug, addedAt: now(), note: '' };
      var r = save(d); r.on = !!d.favorites[slug]; return r;
    },
    setNote: function (slug, title, text) {
      var d = load();
      if (!d.favorites[slug]) d.favorites[slug] = { title: title || slug, addedAt: now(), note: '' };
      d.favorites[slug].note = String(text || '').slice(0, 2000);
      d.favorites[slug].noteAt = now();
      return save(d);
    },
    removeFav: function (slug) { var d = load(); delete d.favorites[slug]; return save(d); },
    addCapture: function (c) {
      var d = load();
      var item = { id: id(), slug: c.slug, title: c.title, image: c.image, meta: c.meta || {}, createdAt: now() };
      d.captures.unshift(item);
      var dropped = 0;
      while (d.captures.length > MAX_CAPTURES) { d.captures.pop(); dropped++; }
      var before = d.captures.length;
      var r = save(d);
      r.id = item.id;
      r.dropped = dropped + (before - d.captures.length);
      r.kept = d.captures.some(function (x) { return x.id === item.id; });
      if (!r.kept) r.ok = false;
      return r;
    },
    removeCapture: function (cid) {
      var d = load();
      d.captures = d.captures.filter(function (x) { return x.id !== cid; });
      return save(d);
    },
    markVisit: function (slug, title) {
      var d = load();
      d.visits[slug] = { title: title || slug, at: now() };
      return save(d);
    },
    clearAll: function () {
      try { root.localStorage.removeItem(KEY); return { ok: true }; } catch (e) { return { ok: false, reason: 'unavailable' }; }
    },
    MAX_CAPTURES: MAX_CAPTURES
  };
  root.HL408Record = api;
})(window);
