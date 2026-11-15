/* Screens and the round. Welcome, Home, Learn card, Round, Round end, Sticker book. */
(function () {
  'use strict';
  var D = window.DDJ, h = D.u.h, U = D.u, E = D.engine, A = D.art, ACT = D.act;
  var OPEN = E.OPEN, CLOSE = E.CLOSE;
  var root = null, R = null, holdTimer = null;
  var HOLD_MS = window.DDJ_HOLD_MS || 3000;

  var MAXL = 7;
  var NAMES = { 1: 'Who is talking?', 2: 'Speech marks', 3: 'Little marks', 4: 'Build it', 5: 'New line', 6: 'Split speech', 7: 'Speaking words' };
  var LEARN = {
    1: 'Some words are what someone says out loud. Tap those words.',
    2: 'Speech marks go round the spoken words. They go round only those words.',
    3: 'A mark goes before the last speech mark. Use a comma, ! or ?',
    4: 'Spoken words start with a capital letter. The word said starts small.',
    5: 'A new speaker starts a new line. Tap where each line starts.',
    6: 'Speech can split in two. The second part starts small.',
    7: 'Said has friends: whispered, called, replied and cried.'
  };
  var CHEERS = ['Well done!', 'Super!', 'Great job!', 'Yes!', 'Hooray!'];

  function prog() { return U.load(); }
  function byLevel(l) { return D.items.filter(function (i) { return i.level === l; }); }
  function unlocked(l) { var p = prog(); return l === 1 || !!(p.levels[l - 1] && p.levels[l - 1].done); }
  function currentLevel() { for (var l = 1; l <= MAXL; l++) if (unlocked(l) && !(prog().levels[l] && prog().levels[l].done)) return l; return MAXL; }
  function writeOpen() { var p = prog(); return !!(p.levels[4] && p.levels[4].done); }

  /* ---------- shared pieces ---------- */
  function speakBtn(text) {
    return h('button', { type: 'button', class: 'btn icon speak', 'data-speak': '', 'aria-label': 'Read aloud', hidden: !U.britishVoice(), onclick: function () { U.speak(text); } }, A.icon('speaker'));
  }
  function instruction(text, iconName) {
    return h('div', { class: 'instruction' }, speakBtn(text), iconName ? h('span', { class: 'act-icon' }, A.icon(iconName)) : null, h('p', { class: 'itext' }, text));
  }
  function muteBtn() {
    var b = h('button', { type: 'button', class: 'btn icon mute', onclick: function () {
      var p = prog(); p.mute = !p.mute; U.save(); paint(); if (!p.mute) U.play('tap');
    } });
    function paint() { var off = prog().mute; b.setAttribute('aria-label', off ? 'Sound off' : 'Sound on'); b.setAttribute('aria-pressed', off ? 'true' : 'false'); while (b.firstChild) b.removeChild(b.firstChild); b.appendChild(A.icon(off ? 'muted' : 'speaker')); }
    paint(); return b;
  }
  function homeBtn(to) { return h('button', { type: 'button', class: 'btn icon home', 'aria-label': 'Home', onclick: function () { if (R) R = null; (to || goHome)(); } }, A.icon('home')); }
  function topbar(opts) {
    opts = opts || {};
    return h('header', { class: 'topbar' }, opts.home ? homeBtn(opts.homeTo) : h('span', { class: 'spacer' }), opts.mid || h('span', { class: 'spacer' }), muteBtn());
  }
  function btn(label, kind, onclick, extra) { return h('button', Object.assign({ type: 'button', class: 'btn ' + kind, onclick: onclick }, extra || {}), label); }

  function show(name, bar, cardKids) {
    U.stopSpeaking();
    var card = h('main', { class: 'card', tabindex: '-1', 'data-screen': name }, cardKids);
    while (root.firstChild) root.removeChild(root.firstChild);
    root.appendChild(h('div', { class: 'screen ' + name }, bar, card));
    U.refreshSpeakers();
    try { card.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    window.scrollTo && window.scrollTo(0, 0);
    return card;
  }

  /* ---------- Welcome ---------- */
  function welcome() {
    var p = prog(), row = h('div', { class: 'friends', role: 'group', 'aria-label': 'Pick a friend' }), pals = {};
    A.FRIEND_IDS.forEach(function (id) {
      var b = h('button', { type: 'button', class: 'btn friend', 'aria-label': A.FRIENDS[id].name, 'aria-pressed': p.friend === id ? 'true' : 'false', onclick: function () {
        p.friend = id; U.save(); U.play('tap');
        Object.keys(pals).forEach(function (k) { pals[k].setAttribute('aria-pressed', k === id ? 'true' : 'false'); });
      } }, A.friend(id));
      pals[id] = b; row.appendChild(b);
    });
    show('welcome', topbar(), [
      h('h1', { class: 'logo' }, h('span', { class: 'mark big', 'aria-hidden': 'true' }, OPEN), 'Dialogue Dash', h('span', { class: 'mark big', 'aria-hidden': 'true' }, CLOSE), h('span', { class: 'jr' }, 'Junior')),
      instruction('Tap Start.', 'tap'),
      row,
      h('div', { class: 'foot' },
        btn('Start', 'primary', function () { U.play('tap'); if (D.net.savedClass()) names(); else guest(); }),
        D.net.savedClass() ? null : btn('My class', 'secondary', function () { U.play('tap'); codeScreen(); }))
    ]);
  }

  /* ---------- Class sign-in: a grown-up types the code once, then each child taps their name ---------- */
  function guest() { D.net.signOut(); goHome(); }
  function notice(kind, text) {
    return h('div', { class: 'feedback' + (kind ? ' ' + kind : ''), role: 'status', 'aria-live': 'polite' }, text || '');
  }
  function codeScreen(message) {
    var input = h('input', { type: 'text', class: 'code-input', 'aria-label': 'Class code', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', maxlength: '12', enterkeyhint: 'go' });
    var fb = notice(message ? 'wrong' : '', message);
    var go = function (e) {
      if (e) e.preventDefault();
      var code = input.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      if (code.length < 4) { fb.className = 'feedback wrong'; fb.textContent = 'Check the code.'; return; }
      fb.className = 'feedback'; fb.textContent = 'One moment.';
      D.net.lookup(code).then(function (r) { D.net.saveClass({ code: code, name: r.className }); names(r); },
        function (err) { fb.className = 'feedback wrong'; fb.textContent = D.net.say(err, 'Code not found.'); });
    };
    show('code', topbar({ home: true, homeTo: welcome }), [
      instruction('Type the class code.', 'tap'),
      h('form', { class: 'code-form', onsubmit: go }, input, fb, h('div', { class: 'foot' }, h('button', { type: 'submit', class: 'btn primary' }, 'Go'))),
    ]);
    try { input.focus(); } catch (e) { /* ignore */ }
  }
  function namesScreen(r, message) {
    var saved = D.net.savedClass(), fb = notice(message ? 'wrong' : '', message);
    var grid = h('div', { class: 'names', role: 'group', 'aria-label': 'Names' });
    (r.pupils || []).forEach(function (p) {
      grid.appendChild(h('button', { type: 'button', class: 'btn name', onclick: function () {
        U.play('tap'); fb.className = 'feedback'; fb.textContent = 'One moment.';
        D.net.signIn(saved.code, p).then(goHome, function (err) {
          fb.className = 'feedback wrong'; fb.textContent = D.net.say(err, 'Try again.');
          if (err && err.status === 404) { D.net.forgetClass(); codeScreen('New code needed.'); }
        });
      } }, p.name));
    });
    show('names', topbar({ home: true, homeTo: welcome }), [
      h('h1', { class: 'title' }, r.className || saved.name),
      instruction('Tap your name.', 'tap'),
      (r.pupils || []).length ? grid : h('p', { class: 'msg' }, 'No names yet.'),
      fb,
      h('div', { class: 'foot row' }, btn('Just try it', 'secondary', guest), btn('Change class', 'secondary', function () { D.net.forgetClass(); codeScreen(); }))
    ]);
  }
  function names() {
    var saved = D.net.savedClass();
    show('loading', topbar({ home: true, homeTo: welcome }), [h('h1', { class: 'title' }, saved.name), notice('', 'One moment.')]);
    D.net.lookup(saved.code).then(function (r) { D.net.saveClass({ code: saved.code, name: r.className }); namesScreen(r); }, function (err) {
      if (err && err.status === 404) { D.net.forgetClass(); codeScreen('New code needed.'); return; }
      namesScreen({ className: saved.name, pupils: [] }, D.net.say(err));
    });
  }
  function signOutToWelcome() { D.net.signOut(); welcome(); }

  /* ---------- Home ---------- */
  function stars(n, small) {
    var w = h('span', { class: 'stars' + (small ? ' small' : ''), role: 'img', 'aria-label': n + ' of 3 stars' });
    for (var i = 1; i <= 3; i++) w.appendChild(A.icon('star', i <= n));
    return w;
  }
  function goHome() {
    var p = prog(), cur = currentLevel(), path = h('div', { class: 'path' });
    for (var l = 1; l <= MAXL; l++) (function (l) {
      var lv = p.levels[l], open = unlocked(l), done = !!(lv && lv.done);
      var label = 'Level ' + l + ', ' + NAMES[l] + (done ? ', ' + lv.stars + ' stars' : open ? '' : ', locked');
      var b = h('button', {
        type: 'button', class: 'btn stone' + (done ? ' done' : open ? ' open' : ' locked'), 'data-level': l, 'aria-label': label, 'aria-disabled': open ? null : 'true',
        onclick: function () { if (!open) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); return; } U.play('tap'); learn(l); }
      }, open ? h('span', { class: 'num' }, String(l)) : A.icon('lock'), done ? stars(lv.stars, true) : null);
      var cell = h('div', { class: 'cell' }, l === cur ? h('div', { class: 'pal', 'aria-hidden': 'true' }, A.friend(p.friend)) : null, b);
      path.appendChild(cell);
    })(l);
    var who = D.net.pupil();
    var chip = who ? h('button', { type: 'button', class: 'btn chip', 'aria-label': 'Not ' + who.name + '? Tap to change.', onclick: signOutToWelcome }, h('span', { class: 'chip-name' }, who.name)) : null;
    show('home', topbar({ mid: chip }), [
      instruction('Tap a stone.', 'tap'), path,
      h('div', { class: 'foot row' }, btn('Practise', 'primary', function () { U.play('tap'); startRound('practise', 0); }), writeOpen() ? btn('Write it', 'primary', function () { U.play('tap'); startRound('write', 0); }) : null, btn('Sticker book', 'secondary', function () { U.play('tap'); book(); }))
    ]);
  }

  /* ---------- Learn card ---------- */
  function learnExample(l) {
    var s = function (cls, t, d) { return h('span', { class: cls, style: d == null ? null : { 'animation-delay': d + 's' } }, t); };
    var kids;
    if (l === 1) kids = ['Mia said, ', s('mark', OPEN), s('sp', 'I', 0.4), ' ', s('sp', 'am', 0.8), ' ', s('sp', 'hungry.', 1.2), s('mark', CLOSE)];
    else if (l === 2) kids = ['Raj said, ', s('mark pop', OPEN, 0.4), 'I see a cat.', s('mark pop', CLOSE, 1.2)];
    else if (l === 3) kids = [s('mark', OPEN), 'I am tired', s('mark pop', ',', 0.6), s('mark', CLOSE), ' said Mia.'];
    else if (l === 4) kids = [s('mark', OPEN), s('cap', 'L', 0.4), 'et’s go!', s('mark', CLOSE), ' ', s('cap', 's', 1.2), 'aid Ben.'];
    else if (l === 6) kids = [s('mark', OPEN), 'I am,', s('mark', CLOSE), ' said Mia, ', s('mark pop', OPEN, 0.8), s('cap', 's', 1.4), 'o hungry.', s('mark pop', CLOSE, 1.9)];
    else if (l === 7) kids = [s('mark', OPEN), 'Come here,', s('mark', CLOSE), ' ', s('sp', 'called', 0.6), ' Raj.'];
    else kids = [h('div', { class: 'ln' }, s('mark', OPEN), 'Hello,', s('mark', CLOSE), ' said Mia.'), h('div', { class: 'ln late' }, s('mark', OPEN), 'Hi,', s('mark', CLOSE), ' said Ben.')];
    return h('div', { class: 'bubble example', 'aria-hidden': 'true' }, kids);
  }
  function learn(l) {
    var go = function () { U.play('tap'); startRound('level', l); };
    show('learn', topbar({ home: true }), [
      h('h1', { class: 'title' }, NAMES[l]),
      learnExample(l),
      instruction(LEARN[l], null),
      h('div', { class: 'foot' }, btn('Start', 'primary', go), btn('Skip', 'secondary', go))
    ]);
  }

  /* ---------- Round ---------- */
  function pickItems(mode, level) {
    if (mode === 'level') return E.shuffle(byLevel(level), U.rnd).slice(0, 5);
    var pool = [], w = [], out = [];
    // Write it uses the one-sentence items (not the 3-line chats of Level 5).
    for (var l = 1; l <= MAXL; l++) if (unlocked(l) && !(mode === 'write' && l === 5)) pool = pool.concat(byLevel(l));
    pool.forEach(function (it) { w.push(1 + 3 * (prog().missed[it.id] || 0)); });
    while (out.length < 5 && pool.length) {
      var tot = w.reduce(function (a, b) { return a + b; }, 0), r = U.rnd() * tot, k = 0;
      while (k < w.length - 1 && r >= w[k]) { r -= w[k]; k++; }
      out.push(pool.splice(k, 1)[0]); w.splice(k, 1);
    }
    return out;
  }
  function startRound(mode, level) {
    R = { mode: mode, level: level, queue: pickItems(mode, level).map(function (it) { return { item: it, re: false }; }), pos: 0, first: 0, cur: null, results: [] };
    nextItem();
  }
  function nextItem() {
    var q = R.queue[R.pos];
    R.cur = { item: q.item, re: q.re, model: R.mode === 'write' ? E.deriveWrite(q.item) : E.derive(q.item, U.rnd), attempts: 0, resolved: false };
    renderItem();
  }
  function dots() {
    var w = h('span', { class: 'dots', role: 'img' });
    R.queue.forEach(function (q, i) {
      var done = i < R.pos || (i === R.pos && R.cur && R.cur.resolved);
      w.appendChild(h('span', { class: 'dot' + (done ? ' done' : '') + (i === R.pos ? ' now' : '') }));
    });
    w.setAttribute('aria-label', 'Item ' + (R.pos + 1) + ' of ' + R.queue.length);
    return w;
  }

  function renderItem() {
    var c = R.cur, m = c.model, p = prog();
    var ins = ACT.instructionFor(m);
    var act = ACT.mount(m, {
      onChange: function () { if (!c.resolved) setFeedback(null); },
      onPick: function (mark) { handle(E.check(m, mark), mark); }
    });
    var fb = h('div', { class: 'feedback', role: 'status', 'aria-live': 'polite' });
    var pal = h('span', { class: 'pal-small', 'aria-hidden': 'true' }, A.friend(p.friend));
    var primary = m.kind === 'pick' ? null : btn('Check', 'primary', function () { if (c.resolved) advance(); else handle(E.check(m, act.response())); }, { id: 'primary' });
    var insEl = instruction(ins[0], ins[1]);
    var watch = m.kind !== 'write' && !p.seen[m.activity] ? btn('Watch first', 'secondary watch', function () { watchFirst(c, act); }) : null;
    var top = topbar({ home: true, mid: dots() });
    var dotsEl = top.querySelector('.dots');

    function setFeedback(kind, text, starOn, extra) {
      while (fb.firstChild) fb.removeChild(fb.firstChild);
      fb.className = 'feedback' + (kind ? ' ' + kind : '');
      if (!kind) return;
      fb.appendChild(pal);
      if (starOn) fb.appendChild(h('span', { class: 'fb-star' }, A.icon('star', true)));
      fb.appendChild(h('span', { class: 'fb-text' }, text));
      if (extra) fb.appendChild(h('span', { class: 'fb-answer' }, ACT.markup(extra)));
      pal.classList.remove('bounce', 'wiggle'); void pal.offsetWidth;
      pal.classList.add(kind === 'wrong' ? 'wiggle' : 'bounce');
    }
    function setPrimary() {
      var last = R.pos >= R.queue.length - 1;
      var label = last ? 'Finish' : 'Next';
      if (!primary) { primary = btn(label, 'primary', advance, { id: 'primary' }); foot.appendChild(primary); }
      else primary.textContent = label;
      try { primary.focus(); } catch (e) { /* ignore */ }
    }
    function resolve() {
      c.resolved = true; p.seen[m.activity] = true; U.save();
      if (!c.re) R.results.push({ id: c.item.id, level: c.item.level, first: c.attempts === 0, revealed: c.attempts >= 2 });
      if (watch && watch.parentNode) watch.parentNode.removeChild(watch);
      var ds = dots(); dotsEl.parentNode.replaceChild(ds, dotsEl); dotsEl = ds;
      setPrimary();
    }
    function handle(res, mark) {
      if (c.resolved) return;
      if (res.status === 'incomplete') { insEl.classList.remove('nudge'); void insEl.offsetWidth; insEl.classList.add('nudge'); return; }
      if (res.status === 'ok') {
        var first = c.attempts === 0 && !c.re;
        if (first) R.first++;
        act.showRight(); U.play(first ? 'star' : 'right');
        setFeedback('right', CHEERS[Math.floor(U.rnd() * CHEERS.length)], first);
        resolve(); return;
      }
      c.attempts++;
      if (c.attempts === 1) {
        p.missed[c.item.id] = (p.missed[c.item.id] || 0) + 1; U.save();
        act.showWrong(res.wrong); U.play('wrong'); setFeedback('wrong', m.kind === 'write' ? res.hint : 'Nearly! Try again.');
      } else {
        act.showRight();
        if (!c.re) R.queue.push({ item: c.item, re: true });
        setFeedback('look', 'Look:');
        resolve();
      }
    }
    var foot = h('div', { class: 'foot row' }, watch, primary);
    c.handle = handle; c.act = act;
    show('round', top, [insEl, h('div', { class: 'task' }, act.el), fb, foot]);
  }
  function advance() {
    R.pos++;
    if (R.pos >= R.queue.length) endRound(); else nextItem();
  }

  function watchFirst(c, act) {
    var d = ACT.demo(c.model.activity);
    var done = function () { d.stop(); prog().seen[c.model.activity] = true; U.save(); renderItem(); };
    show('demo', topbar({ home: true }), [
      instruction('Watch, then tap Got it.', 'tap'),
      h('div', { class: 'task' }, d.el),
      h('div', { class: 'foot' }, btn('Got it', 'primary', done))
    ]);
    setTimeout(d.play, 300);
  }

  /* ---------- Round end ---------- */
  function endRound() {
    var p = prog(), st = E.starsFor(R.first), unlock = 0, isNew;
    if (R.mode === 'level') {
      var prev = p.levels[R.level], was = prev && prev.done;
      p.levels[R.level] = { done: true, stars: Math.max(prev ? prev.stars : 0, st) };
      if (!was && R.level < MAXL) unlock = R.level + 1;
    }
    var avail = [];
    for (var i = 0; i < A.STICKERS.length; i++) if (!p.stickers[i]) avail.push(i);
    var idx = avail.length ? avail[Math.floor(U.rnd() * avail.length)] : Math.floor(U.rnd() * A.STICKERS.length);
    isNew = !p.stickers[idx]; p.stickers[idx] = (p.stickers[idx] || 0) + 1; p.rounds++;
    U.save();
    if (D.net.signedIn()) D.net.recordRound({ mode: R.mode, level: R.level, stars: R.mode === 'level' ? st : 0, results: R.results });
    var mode = R.mode; R = null;
    U.play('star'); setTimeout(function () { U.play('sticker'); }, 500);
    show('end', topbar({ home: true }), [
      h('h1', { class: 'title' }, mode === 'level' ? 'Round done!' : 'Well done!'),
      mode === 'level' ? h('div', { class: 'big-stars' }, stars(st, false)) : null,
      h('div', { class: 'sticker-win' }, h('div', { class: 'sticker big' }, A.sticker(idx)), h('p', { class: 'msg' }, isNew ? 'New sticker!' : 'Sticker again!')),
      unlock ? h('p', { class: 'msg unlock' }, 'New level!') : null,
      instruction('Tap Home.', 'tap'),
      h('div', { class: 'foot row' }, btn('Home', 'primary', goHome), btn('Sticker book', 'secondary', book))
    ]);
  }

  /* ---------- Sticker book ---------- */
  function holdButton() {
    var fill = h('span', { class: 'fill' }), b = h('button', { type: 'button', class: 'btn secondary hold', 'aria-describedby': 'hold-note' }, fill, h('span', { class: 'lab' }, 'Hold to reset'));
    function stop() { clearTimeout(holdTimer); holdTimer = null; b.classList.remove('holding'); }
    function start() {
      if (holdTimer) return;
      b.classList.add('holding');
      holdTimer = setTimeout(function () { stop(); U.reset(); welcome(); }, HOLD_MS);
    }
    b.addEventListener('pointerdown', start);
    ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach(function (e) { b.addEventListener(e, stop); });
    b.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); start(); } });
    b.addEventListener('keyup', function (e) { if (e.key === 'Enter' || e.key === ' ') stop(); });
    b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    return b;
  }
  function book() {
    var p = prog(), grid = h('div', { class: 'stickers' }), have = 0;
    A.STICKERS.forEach(function (st, i) {
      var n = p.stickers[i] || 0; if (n) have++;
      grid.appendChild(h('div', { class: 'slot-sticker' + (n ? ' got' : ''), role: 'img', 'aria-label': n ? st[0] + ' sticker' + (n > 1 ? ', ' + n : '') : 'Empty spot' },
        n ? A.sticker(i, false) : h('span', { class: 'qm', 'aria-hidden': 'true' }, '?'), n > 1 ? h('span', { class: 'count', 'aria-hidden': 'true' }, 'x' + n) : null));
    });
    show('book', topbar({ home: true }), [
      instruction('Look at your stickers.', null),
      h('p', { class: 'tally' }, have + ' of ' + A.STICKERS.length), grid,
      h('div', { class: 'foot' }, btn('Home', 'primary', goHome), D.net.signedIn() ? null : holdButton(), D.net.signedIn() ? null : h('p', { id: 'hold-note', class: 'note' }, 'Grown-ups: hold for 3 seconds to start again.'))
    ]);
  }

  function start() {
    root = document.getElementById('app');
    welcome();
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline shell is optional */ });
    }
  }
  D.app = { start: start, current: function () { return R && R.cur ? { item: R.cur.item, model: R.cur.model, attempts: R.cur.attempts } : null; }, round: function () { return R; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
