/* SUN & MOON — 選択と作品の対応ロジック（アプリと自動テストで共用） */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SMCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var IDS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
  var FIELDS = ['id', 'sunId', 'moonId', 'title', 'essay', 'smallAction', 'todaysPhrase', 'reflectionQuestion'];

  var SUN = {
    '01': ['進む', 'MOVE'], '02': ['頑張る', 'STRIVE'], '03': ['笑う', 'SMILE'], '04': ['与える', 'GIVE'],
    '05': ['支える', 'SUPPORT'], '06': ['強くある', 'STAND'], '07': ['怒る', 'ANGER'], '08': ['整える', 'ORGANIZE'],
    '09': ['目立つ', 'SHINE'], '10': ['合わせる', 'ALIGN'], '11': ['教える', 'TEACH'], '12': ['変わる', 'CHANGE']
  };
  var MOON = {
    '01': ['立ち止まりたい', 'REST'], '02': ['休みたい', 'RESTORE'], '03': ['わかってほしい', 'BE SEEN'],
    '04': ['受け取りたい', 'RECEIVE'], '05': ['支えられたい', 'LEAN'], '06': ['守られたい', 'SAFE'],
    '07': ['大切にしてほしい', 'VALUE'], '08': ['安心したい', 'FEEL SAFE'], '09': ['認められたい', 'ACCEPT'],
    '10': ['自分で決めたい', 'CHOOSE'], '11': ['確かめたい', 'VERIFY'], '12': ['そのままでいたい', 'STAY AS I AM']
  };

  function key(sunId, moonId) { return sunId + '-' + moonId; }

  /* 作品データ → (sunId,moonId) の索引。重複は例外。 */
  function buildIndex(works) {
    var idx = new Map();
    works.forEach(function (w) {
      var k = key(w.sunId, w.moonId);
      if (idx.has(k)) throw new Error('duplicate key ' + k);
      idx.set(k, w);
    });
    return idx;
  }

  /* 全144通りが揃っているか・空欄がないかを検査し、問題の一覧を返す */
  function validate(works) {
    var errs = [];
    var seenKey = new Set(), seenId = new Set();
    works.forEach(function (w) {
      FIELDS.forEach(function (f) {
        if (typeof w[f] !== 'string' || !w[f].trim()) errs.push((w.id || '?') + ': empty ' + f);
      });
      var k = key(w.sunId, w.moonId);
      if (seenKey.has(k)) errs.push('duplicate key ' + k);
      if (seenId.has(w.id)) errs.push('duplicate id ' + w.id);
      seenKey.add(k); seenId.add(w.id);
      if (IDS.indexOf(w.sunId) < 0) errs.push(w.id + ': bad sunId ' + w.sunId);
      if (IDS.indexOf(w.moonId) < 0) errs.push(w.id + ': bad moonId ' + w.moonId);
    });
    IDS.forEach(function (s) {
      IDS.forEach(function (m) { if (!seenKey.has(key(s, m))) errs.push('missing ' + key(s, m)); });
    });
    if (works.length !== 144) errs.push('expected 144 records, got ' + works.length);
    return errs;
  }

  /* 選んだ2枚（順不同）から作品を引く。picks = [{type:'sun'|'moon', id:'01'}, ...] */
  function resolve(idx, picks) {
    var sun = null, moon = null;
    (picks || []).forEach(function (p) {
      if (!p) return;
      if (p.type === 'sun') sun = p.id;
      else if (p.type === 'moon') moon = p.id;
    });
    if (!sun || !moon) return null;
    return idx.get(key(sun, moon)) || null;
  }

  function byId(works, id) {
    for (var i = 0; i < works.length; i++) if (works[i].id === id) return works[i];
    return null;
  }

  return { IDS: IDS, FIELDS: FIELDS, SUN: SUN, MOON: MOON, key: key, buildIndex: buildIndex, validate: validate, resolve: resolve, byId: byId };
});
