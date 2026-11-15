/* Pure logic: derive every activity from the one correct sentence. No DOM. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.DDJ = root.DDJ || {}; root.DDJ.engine = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var OPEN = '“', CLOSE = '”';
  var MARK_NAMES = { ',': 'comma', '.': 'full stop', '!': 'exclamation mark', '?': 'question mark' };

  function tokens(s) { return s.split(' '); }

  function spokenIndexes(toks) {
    var inq = false, out = [];
    toks.forEach(function (w, i) {
      if (w.indexOf(OPEN) >= 0) inq = true;
      if (inq) out.push(i);
      if (w.indexOf(CLOSE) >= 0) inq = false;
    });
    return out;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rnd) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* Speaker words: said, asked and shouted from 0.1.0; the rest arrive in Level 7. */
  var SPEAKER_WORDS = ['said', 'asked', 'shouted', 'whispered', 'called', 'replied', 'cried'];
  function bare(w) { return w.split(OPEN).join('').split(CLOSE).join('').replace(/[,.!?]/g, ''); }

  function activityFor(level, item) {
    if (level === 7 && item && item.activity) return item.activity;
    return { 1: 'words', 2: 'gap', 3: 'pick', 4: 'build', 5: 'gap', 6: 'build', 7: 'build' }[level];
  }

  /* derive(item, rnd) -> model used by the UI and by the checks below */
  function derive(item, rnd) {
    rnd = rnd || Math.random;
    var lvl = item.level, toks, sp;
    if (lvl === 1) {
      toks = tokens(item.sentence);
      return { level: 1, kind: 'words', activity: 'words', tokens: toks, answer: spokenIndexes(toks) };
    }
    if (lvl === 2) {
      toks = tokens(item.sentence);
      sp = spokenIndexes(toks);
      var plain = toks.map(function (w) { return w.split(OPEN).join('').split(CLOSE).join(''); });
      return {
        level: 2, kind: 'gap-marks', activity: 'gap', tokens: plain, original: toks,
        slots: plain.length + 1, answer: [sp[0], sp[sp.length - 1] + 1]
      };
    }
    if (lvl === 3) {
      var s = item.sentence, c = s.lastIndexOf(CLOSE);
      var mark = s.charAt(c - 1);
      var choices = [mark].concat(shuffle([',', '.', '!', '?'].filter(function (m) { return m !== mark; }), rnd).slice(0, 2));
      if (mark === ',' && choices.indexOf('.') < 0) choices[2] = '.';
      return {
        level: 3, kind: 'pick', activity: 'pick', pre: s.slice(0, c - 1), post: s.slice(c),
        answer: mark, options: shuffle(choices, rnd)
      };
    }
    if (lvl === 7 && item.activity === 'words') {
      toks = tokens(item.sentence);
      var vi = toks.map(bare).map(function (w) { return SPEAKER_WORDS.indexOf(w) >= 0; }).indexOf(true);
      return { level: 7, kind: 'words', activity: 'words', variant: 'speaker', tokens: toks, answer: [vi] };
    }
    if (lvl === 4 || lvl === 6 || lvl === 7) {
      toks = tokens(item.sentence);
      var order = toks.map(function (t, i) { return i; }), tries = 0;
      do { order = shuffle(order, rnd); tries++; }
      while (tries < 50 && order.every(function (v, i) { return v === i; }));
      return { level: lvl, kind: 'build', activity: 'build', tokens: toks, tray: order, answer: toks.slice() };
    }
    // level 5
    var all = [], breaks = [];
    item.lines.forEach(function (ln, i) {
      var t = tokens(ln);
      if (i > 0) breaks.push(all.length);
      all = all.concat(t);
    });
    return { level: 5, kind: 'gap-lines', activity: 'gap', tokens: all, lines: item.lines, answer: breaks, slots: all.length };
  }

  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    var s = {}; a.forEach(function (x) { s[x] = 1; });
    return b.every(function (x) { return s[x]; });
  }

  /* check(model, response) -> {status:'ok'|'wrong'|'incomplete', wrong:[...]}
     response: words/gap: array of indexes; pick: mark string; build: array of tokens placed in order */
  function check(m, r) {
    if (m.kind === 'write') { var w = checkWrite(m.answer, r); return { status: w.status, wrong: [], hint: w.hint }; }
    if (m.kind === 'pick') return r === m.answer ? { status: 'ok', wrong: [] } : { status: 'wrong', wrong: [r] };
    if (m.kind === 'build') {
      if (r.length < m.tokens.length) return { status: 'incomplete', wrong: [] };
      var wr = [];
      r.forEach(function (t, i) { if (t !== m.answer[i]) wr.push(i); });
      return { status: wr.length ? 'wrong' : 'ok', wrong: wr };
    }
    var need = m.kind === 'words' ? 1 : m.answer.length;
    if (r.length === 0 || (m.kind !== 'words' && r.length < need)) return { status: 'incomplete', wrong: [] };
    var bad = r.filter(function (x) { return m.answer.indexOf(x) < 0; });
    return { status: sameSet(r, m.answer) ? 'ok' : 'wrong', wrong: bad };
  }

  /* ---------- Write it: the child edits a plain sentence; a gentle checker gives one hint at a time ---------- */
  /* The sentence with every mark taken out, and each spoken sentence start made small (except I). */
  function plain(sentence) {
    var toks = tokens(sentence), sp = spokenIndexes(toks), starts = {};
    var inq = false;
    toks.forEach(function (w, i) { if (w.indexOf(OPEN) >= 0) starts[i] = true; });
    return toks.map(function (w, i) {
      var b = bare(w);
      if (starts[i] && b !== 'I' && sp.length) b = b.charAt(0).toLowerCase() + b.slice(1);
      return b;
    }).join(' ');
  }

  /* Straight quote marks and missing spaces are tidied, so typing on any keyboard works. */
  function tidy(text) {
    var t = String(text == null ? '' : text), n = 0;
    t = t.replace(/[\u201C\u201D"]/g, function (c) {
      if (c === OPEN || c === CLOSE) return c;
      return (n++ % 2 === 0) ? OPEN : CLOSE;
    });
    t = t.replace(/[\u2018\u2019']/g, '\u2019');
    t = t.replace(/([^\s])“/g, '$1 “').replace(/”([A-Za-z])/g, '” $1').replace(/([,.!?])([A-Za-z])/g, '$1 $2');
    return t.replace(/\s+/g, ' ').trim();
  }

  function marksOf(w) { return w.replace(/[“”]/g, '').replace(/[^,.!?]/g, ''); }
  function flags(w) { return (w.indexOf(OPEN) >= 0 ? 'o' : '') + (w.indexOf(CLOSE) >= 0 ? 'c' : ''); }
  function letters(w) { return bare(w); }

  /* checkWrite(sentence, text) -> {status: 'ok'|'wrong'|'incomplete', hint}. Hints are 3 to 4 words, one at a time:
     words first, then speech marks, then capitals, then the other marks. */
  function checkWrite(sentence, text) {
    var t = tidy(text);
    if (!t) return { status: 'incomplete', hint: '' };
    if (t === sentence) return { status: 'ok', hint: '' };
    var a = tokens(t), b = tokens(sentence);
    var wa = a.map(letters).join(' ').toLowerCase(), wb = b.map(letters).join(' ').toLowerCase();
    if (wa !== wb) return { status: 'wrong', hint: 'Keep the same words.' };
    if (a.map(flags).join('|') !== b.map(flags).join('|')) return { status: 'wrong', hint: a.some(function (w) { return flags(w); }) ? 'Check the speech marks.' : 'Add speech marks.' };
    for (var i = 0; i < b.length; i++) {
      var x = letters(a[i]), y = letters(b[i]);
      if (x !== y) return { status: 'wrong', hint: y.charAt(0) !== y.charAt(0).toLowerCase() && x.charAt(0) === x.charAt(0).toLowerCase() ? 'Add a capital.' : 'Use a small letter.' };
    }
    for (var j = 0; j < b.length; j++) {
      var m = marksOf(a[j]), n = marksOf(b[j]);
      if (m !== n) return { status: 'wrong', hint: !m ? (n === ',' ? 'Add a comma.' : 'Add a mark.') : !n ? 'Take one away.' : 'Try another mark.' };
    }
    return { status: 'wrong', hint: 'Look again.' };
  }

  /* A Write it item: the plain sentence to edit, and the one right answer. */
  function deriveWrite(item) { return { level: item.level, kind: 'write', activity: 'write', start: plain(item.sentence), answer: item.sentence }; }

  function starsFor(firstTimeRight) { return firstTimeRight >= 5 ? 3 : firstTimeRight >= 3 ? 2 : 1; }

  return {
    OPEN: OPEN, CLOSE: CLOSE, MARK_NAMES: MARK_NAMES,
    tokens: tokens, spokenIndexes: spokenIndexes, mulberry32: mulberry32, shuffle: shuffle,
    derive: derive, check: check, starsFor: starsFor, activityFor: activityFor,
    SPEAKER_WORDS: SPEAKER_WORDS, deriveWrite: deriveWrite, plain: plain, tidy: tidy, checkWrite: checkWrite
  };
});
