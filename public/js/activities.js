/* The four tap-only activities. mount(model, hooks) -> { el, response, showWrong, showRight, freeze, api }
   hooks.onChange() runs after any tap. hooks.onPick(mark) runs for Pick one. */
(function () {
  'use strict';
  var D = window.DDJ, h = D.u.h, E = D.engine, OPEN = E.OPEN, CLOSE = E.CLOSE;

  /* Text with speech marks drawn large in orange. */
  function markup(text) {
    var out = [], buf = '';
    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      if (c === OPEN || c === CLOSE) {
        if (buf) { out.push(buf); buf = ''; }
        out.push(h('span', { class: 'mark', 'aria-hidden': 'true' }, c));
      } else buf += c;
    }
    if (buf) out.push(buf);
    return out;
  }
  function spoken(text) { return text.split(OPEN).join('').split(CLOSE).join(''); }
  function num(a, b) { return a - b; }
  function clearWrong(root) { [].forEach.call(root.querySelectorAll('.wrong'), function (e) { e.classList.remove('wrong'); }); }

  /* ---- Tap the words ---- */
  function words(m, hooks) {
    var sel = [], btns = [];
    var root = h('div', { class: 'tiles', role: 'group', 'aria-label': 'Sentence' });
    m.tokens.forEach(function (t, i) {
      var b = h('button', {
        type: 'button', class: 'tile', 'aria-pressed': 'false', 'data-i': i, 'aria-label': spoken(t),
        onclick: function () {
          clearWrong(root);
          var k = sel.indexOf(i);
          if (k >= 0) sel.splice(k, 1); else sel.push(i);
          b.classList.toggle('on', k < 0);
          b.setAttribute('aria-pressed', k < 0 ? 'true' : 'false');
          D.u.play('tap');
          hooks.onChange();
        }
      }, markup(t));
      btns.push(b); root.appendChild(b);
    });
    function set(list) {
      sel = list.slice();
      btns.forEach(function (b, i) { var on = sel.indexOf(i) >= 0; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    }
    return {
      el: root,
      response: function () { return sel.slice(); },
      showWrong: function (list) { list.forEach(function (i) { btns[i].classList.add('wrong'); }); },
      showRight: function () { clearWrong(root); set(m.answer); btns.forEach(function (b, i) { if (m.answer.indexOf(i) >= 0) b.classList.add('right'); b.disabled = true; }); },
      freeze: function () { btns.forEach(function (b) { b.disabled = true; }); },
      api: { toggle: function (i) { btns[i].click(); }, el: function (i) { return btns[i]; } }
    };
  }

  /* ---- Tap the gap (speech marks, or line breaks) ---- */
  function gap(m, hooks) {
    var lines = m.kind === 'gap-lines';
    var sel = [], slots = {}, nls = {};
    var root = h('div', { class: 'flow' + (lines ? ' lines' : ''), role: 'group', 'aria-label': 'Sentence' });
    function label(i) {
      if (i === 0) return 'Gap before ' + m.tokens[0];
      if (i === m.tokens.length) return 'Gap after ' + m.tokens[i - 1];
      return 'Gap between ' + m.tokens[i - 1] + ' and ' + m.tokens[i];
    }
    function paint() {
      var sorted = sel.slice().sort(num);
      Object.keys(slots).forEach(function (k) {
        var on = sel.indexOf(+k) >= 0, b = slots[k];
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        while (b.firstChild) b.removeChild(b.firstChild);
        if (on) b.appendChild(lines ? D.art.icon('newline') : h('span', { class: 'mark big', 'aria-hidden': 'true' }, sorted.indexOf(+k) === 0 ? OPEN : CLOSE));
        if (nls[k]) nls[k].classList.toggle('on', on);
      });
    }
    for (var i = 0; i <= m.tokens.length; i++) {
      if (lines && (i === 0 || i === m.tokens.length)) { if (i === 0) root.appendChild(h('span', { class: 'word' }, m.tokens[0])); continue; }
      (function (i) {
        var b = h('button', {
          type: 'button', class: 'slot', 'aria-pressed': 'false', 'aria-label': label(i), 'data-i': i,
          onclick: function () {
            clearWrong(root);
            var k = sel.indexOf(i);
            if (k >= 0) sel.splice(k, 1); else sel.push(i);
            paint(); D.u.play('tap'); hooks.onChange();
          }
        });
        slots[i] = b; root.appendChild(b);
        if (lines) { nls[i] = h('span', { class: 'nl', 'aria-hidden': 'true' }); root.appendChild(nls[i]); }
        if (i < m.tokens.length) root.appendChild(h('span', { class: 'word' }, m.tokens[i]));
      })(i);
    }
    return {
      el: root,
      response: function () { return sel.slice(); },
      showWrong: function (list) { list.forEach(function (i) { if (slots[i]) slots[i].classList.add('wrong'); }); },
      showRight: function () {
        clearWrong(root); sel = m.answer.slice(); paint();
        Object.keys(slots).forEach(function (k) { slots[k].disabled = true; });
        m.answer.forEach(function (i) { slots[i].classList.add('right'); });
      },
      freeze: function () { Object.keys(slots).forEach(function (k) { slots[k].disabled = true; }); },
      api: { toggle: function (i) { slots[i].click(); }, el: function (i) { return slots[i]; } }
    };
  }

  /* ---- Pick one ---- */
  function pick(m, hooks) {
    var blank = h('span', { class: 'blank', 'aria-label': 'blank' });
    var sentence = h('p', { class: 'sentence' }, markup(m.pre), blank, markup(m.post));
    var btns = {};
    var row = h('div', { class: 'choices', role: 'group', 'aria-label': 'Marks' });
    m.options.forEach(function (o) {
      var b = h('button', {
        type: 'button', class: 'choice', 'data-mark': o, 'aria-label': E.MARK_NAMES[o],
        onclick: function () { D.u.play('tap'); hooks.onPick(o); }
      }, h('span', { 'aria-hidden': 'true' }, o));
      btns[o] = b; row.appendChild(b);
    });
    var root = h('div', { class: 'pick' }, sentence, row);
    function fill(mark, cls) { blank.textContent = mark; blank.classList.add('filled'); if (cls) blank.classList.add(cls); }
    return {
      el: root,
      response: function () { return null; },
      showWrong: function (list) { list.forEach(function (o) { btns[o].classList.add('wrong'); btns[o].disabled = true; }); },
      showRight: function () {
        Object.keys(btns).forEach(function (o) { btns[o].disabled = true; btns[o].classList.remove('wrong'); });
        btns[m.answer].classList.add('right'); fill(m.answer, 'right');
      },
      freeze: function () { Object.keys(btns).forEach(function (o) { btns[o].disabled = true; }); },
      api: { pickMark: function (o) { btns[o].click(); }, el: function (o) { return btns[o]; } }
    };
  }

  /* ---- Build it ---- */
  function build(m, hooks) {
    var placed = [], frozen = false, last = null;
    var line = h('div', { class: 'line', role: 'group', 'aria-label': 'Your sentence' });
    var tray = h('div', { class: 'tray', role: 'group', 'aria-label': 'Words to use' });
    var root = h('div', { class: 'build' }, line, tray);
    var wrongPos = [];
    function tile(tok, where) {
      return h('button', {
        type: 'button', class: 'tile', 'data-token': tok, 'aria-label': spoken(tok) + (where === 'line' ? ', in your sentence' : ''), disabled: frozen,
        onclick: function () {
          var k = placed.indexOf(tok);
          if (k >= 0) placed.splice(k, 1); else placed.push(tok);
          last = tok; wrongPos = []; D.u.play('tap'); paint(); hooks.onChange();
        }
      }, markup(tok));
    }
    function paint() {
      while (line.firstChild) line.removeChild(line.firstChild);
      while (tray.firstChild) tray.removeChild(tray.firstChild);
      placed.forEach(function (t, i) { var b = tile(t, 'line'); if (wrongPos.indexOf(i) >= 0) b.classList.add('wrong'); if (frozen && wrongPos.length === 0) b.classList.add('right'); line.appendChild(b); });
      m.tray.forEach(function (i) { var t = m.tokens[i]; if (placed.indexOf(t) < 0) tray.appendChild(tile(t, 'tray')); });
      line.classList.toggle('empty', placed.length === 0);
      if (last && !frozen) {
        var f = root.querySelector('[data-token="' + last.replace(/"/g, '') + '"]');
        if (f) f.focus();
      }
    }
    paint();
    return {
      el: root,
      response: function () { return placed.slice(); },
      showWrong: function (list) { wrongPos = list.slice(); paint(); },
      showRight: function () { placed = m.answer.slice(); wrongPos = []; frozen = true; last = null; paint(); },
      freeze: function () { frozen = true; paint(); },
      api: { put: function (tok) { root.querySelector('.tray [data-token="' + tok + '"]').click(); }, el: function (tok) { return root.querySelector('[data-token="' + tok + '"]'); } }
    };
  }

  /* ---- Write it: edit a plain sentence. Big buttons put the marks in, so nobody hunts for them on a keyboard. ---- */
  function write(m, hooks) {
    var area = h('textarea', {
      class: 'writebox', rows: '3', 'aria-label': 'Your sentence', spellcheck: 'false', autocomplete: 'off',
      autocapitalize: 'off', autocorrect: 'off', maxlength: '120'
    });
    area.value = m.start;
    area.addEventListener('input', function () { area.classList.remove('wrong'); hooks.onChange(); });
    area.addEventListener('keydown', function (e) { if (e.key === 'Enter') e.preventDefault(); });
    function put(ch) {
      if (area.disabled) return;
      var a = area.selectionStart == null ? area.value.length : area.selectionStart, b = area.selectionEnd == null ? a : area.selectionEnd;
      area.value = area.value.slice(0, a) + ch + area.value.slice(b);
      var at = a + ch.length;
      try { area.focus(); area.setSelectionRange(at, at); } catch (e) { /* ignore */ }
      area.classList.remove('wrong'); D.u.play('tap'); hooks.onChange();
    }
    var NAMES = { '“': 'open speech mark', '”': 'close speech mark', ',': 'comma', '.': 'full stop', '!': 'exclamation mark', '?': 'question mark' };
    var bar = h('div', { class: 'markbar', role: 'group', 'aria-label': 'Marks' });
    ['“', '”', ',', '.', '!', '?'].forEach(function (c) {
      bar.appendChild(h('button', { type: 'button', class: 'choice mk', 'data-put': c, 'aria-label': NAMES[c], onclick: function () { put(c); } }, h('span', { 'aria-hidden': 'true' }, c)));
    });
    var root = h('div', { class: 'write' }, area, bar);
    function lock() { area.disabled = true; [].forEach.call(bar.querySelectorAll('button'), function (b) { b.disabled = true; }); }
    return {
      el: root,
      response: function () { return area.value; },
      showWrong: function () { area.classList.add('wrong'); },
      showRight: function () { area.classList.remove('wrong'); area.value = m.answer; area.classList.add('right'); lock(); },
      freeze: lock,
      api: { type: function (t) { area.value = t; hooks.onChange(); }, put: put, el: function () { return area; } }
    };
  }

  function mount(m, hooks) {
    return ({ words: words, 'gap-marks': gap, 'gap-lines': gap, pick: pick, build: build, write: write })[m.kind](m, hooks);
  }

  /* Instruction wording: one verb per action, 8 words or fewer. */
  var INSTRUCTIONS = {
    1: ['Tap the words someone says.', 'tap'],
    2: ['Tap where the speech marks go.', 'tap'],
    3: ['Pick the right mark.', 'pick'],
    4: ['Tap the words in order.', 'put'],
    5: ['Tap where each new line starts.', 'newline'],
    6: ['Tap the words in order.', 'put'],
    7: ['Tap the words in order.', 'put']
  };
  /* The same activity can need different words: Level 7 sometimes asks for the speaking word, and Write it has its own. */
  function instructionFor(m) {
    if (m.kind === 'write') return ['Put in the marks.', 'put'];
    if (m.level === 7 && m.kind === 'words') return ['Tap how they said it.', 'tap'];
    return INSTRUCTIONS[m.level];
  }

  /* ---- Watch first: a 5 second demo that plays itself on a made-up item ---- */
  var DEMOS = {
    words: { level: 1, sentence: 'Mia said, “I am hungry.”' },
    gap: { level: 2, sentence: 'Raj said, “I see a cat.”' },
    pick: { level: 3, sentence: '“I am tired,” said Mia.', cue: 'statement' },
    build: { level: 4, sentence: '“Let’s go!” said Ben.' }
  };
  function demo(activity) {
    var item = DEMOS[activity], m = E.derive(item, E.mulberry32(3));
    var a = mount(m, { onChange: function () {}, onPick: function () {} });
    var finger = h('span', { class: 'finger', 'aria-hidden': 'true' }, D.art.icon('tap'));
    var stage = h('div', { class: 'demo-stage inert', 'aria-hidden': 'true', inert: true }, a.el, finger);
    var timers = [];
    function at(ms, targetFn, act) {
      timers.push(setTimeout(function () {
        var t = targetFn(); if (!t) return;
        var sr = stage.getBoundingClientRect(), tr = t.getBoundingClientRect();
        finger.style.setProperty('left', (tr.left - sr.left + tr.width / 2 - 14) + 'px');
        finger.style.setProperty('top', (tr.top - sr.top + tr.height / 2 - 14) + 'px');
        finger.classList.add('show');
        timers.push(setTimeout(function () { finger.classList.add('press'); act(); timers.push(setTimeout(function () { finger.classList.remove('press'); }, 250)); }, 350));
      }, ms));
    }
    function play() {
      if (activity === 'words') {
        [2, 3, 4].forEach(function (i, n) { at(300 + n * 1100, function () { return a.api.el(i); }, function () { a.api.toggle(i); }); });
      } else if (activity === 'gap') {
        at(300, function () { return a.api.el(2); }, function () { a.api.toggle(2); });
        at(1900, function () { return a.api.el(6); }, function () { a.api.toggle(6); });
      } else if (activity === 'pick') {
        at(500, function () { return a.api.el(','); }, function () { a.api.pickMark(','); });
      } else {
        m.answer.forEach(function (t, n) { at(300 + n * 1000, function () { return a.api.el(t); }, function () { a.api.put(t); }); });
      }
      timers.push(setTimeout(function () { a.showRight(); finger.classList.remove('show'); }, 4600));
    }
    function stop() { timers.forEach(clearTimeout); timers = []; }
    return { el: stage, play: play, stop: stop };
  }

  D.act = { mount: mount, markup: markup, INSTRUCTIONS: INSTRUCTIONS, instructionFor: instructionFor, demo: demo, spoken: spoken };
})();
