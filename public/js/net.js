/* Talking to the server. Only used when a class is signed in: "Just try it" never makes a request.
   Rounds that cannot be sent wait in the outbox on the device and are sent later, once (the server counts each round id once). */
(function () {
  'use strict';
  var D = window.DDJ, U = D.u;
  var CLASS_KEY = 'ddj.class', OUTBOX_KEY = 'ddj.outbox';
  var LEVELS = [1, 2, 3, 4, 5, 6, 7], ACTIVITIES = ['words', 'gap', 'pick', 'build', 'write'], FRIENDS = ['duck', 'bunny', 'frog', 'cat'];
  var ITEM_ID = /^L[1-7]-\d{2}$/;
  var session = null, flushing = false;

  function read(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage blocked */ }
  }
  var cap = function (n, max) { return Math.max(0, Math.min(max, isFinite(+n) ? Math.floor(+n) : 0)); };

  /* Same logic as src/progress.js on the server (a test checks they agree). */
  function sanitize(raw) {
    var d = raw && typeof raw === 'object' ? raw : {}, out = { v: 1, friend: 'duck', levels: {}, stickers: {}, missed: {}, seen: {}, rounds: 0 };
    out.friend = FRIENDS.indexOf(d.friend) >= 0 ? d.friend : 'duck';
    LEVELS.forEach(function (l) { var v = d.levels && d.levels[l]; if (v && v.done) out.levels[l] = { done: true, stars: Math.max(1, cap(v.stars, 3)) }; });
    for (var i = 0; i < 20; i++) { var n = cap(d.stickers && d.stickers[i], 999); if (n) out.stickers[i] = n; }
    Object.keys(d.missed && typeof d.missed === 'object' ? d.missed : {}).forEach(function (k) { if (ITEM_ID.test(k) && cap(d.missed[k], 999)) out.missed[k] = cap(d.missed[k], 999); });
    ACTIVITIES.forEach(function (a) { if (d.seen && d.seen[a]) out.seen[a] = true; });
    out.rounds = cap(d.rounds, 99999);
    return out;
  }
  function union(a, b) { var o = {}; Object.keys(a).concat(Object.keys(b)).forEach(function (k) { o[k] = 1; }); return Object.keys(o); }
  function merge(a, b) {
    var x = sanitize(a), y = sanitize(b), out = sanitize({});
    out.friend = b && b.friend ? y.friend : x.friend;
    LEVELS.forEach(function (l) { var p = x.levels[l], q = y.levels[l]; if (p || q) out.levels[l] = { done: true, stars: Math.max(p ? p.stars : 0, q ? q.stars : 0) }; });
    union(x.stickers, y.stickers).forEach(function (k) { out.stickers[k] = Math.max(x.stickers[k] || 0, y.stickers[k] || 0); });
    union(x.missed, y.missed).forEach(function (k) { out.missed[k] = Math.max(x.missed[k] || 0, y.missed[k] || 0); });
    ACTIVITIES.forEach(function (k) { if (x.seen[k] || y.seen[k]) out.seen[k] = true; });
    out.rounds = Math.max(x.rounds, y.rounds);
    return out;
  }

  /* One request. Resolves {status, data}; rejects {kind: 'network'} when the server cannot be reached. */
  function request(method, path, body, token) {
    var headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = 'Bearer ' + token;
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 10000) : null;
    return Promise.resolve().then(function () {
      return window.fetch(path, { method: method, headers: headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl ? ctl.signal : undefined });
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      return res.json().catch(function () { return null; }).then(function (data) { return { status: res.status, data: data }; });
    }, function () {
      if (timer) clearTimeout(timer);
      return Promise.reject({ kind: 'network' });
    });
  }
  /* Short messages for children (1 to 4 words). */
  function say(e, notFound) {
    if (e && e.kind === 'network') return 'No signal.';
    if (e && e.status === 404) return notFound || 'Not found.';
    if (e && e.status === 429) return 'Wait a minute.';
    return 'Try again.';
  }
  function expect(res) { return res.status >= 200 && res.status < 300 ? res.data : Promise.reject({ kind: 'http', status: res.status }); }

  /* The class a grown-up set up on this device. */
  function savedClass() { var c = read(CLASS_KEY, null); return c && c.code ? c : null; }
  function saveClass(c) { write(CLASS_KEY, c); }
  function forgetClass() { write(CLASS_KEY, null); }

  function lookup(code) { return request('POST', '/api/class', { code: code }).then(expect); }

  function signIn(code, pupil) {
    return request('POST', '/api/login', { code: code, pupilId: pupil.id }).then(expect).then(function (r) {
      session = { token: r.token, pupil: r.pupil, code: code };
      U.profile(r.pupil.id);
      return request('GET', '/api/progress', undefined, session.token).then(expect).then(function (s) {
        var local = U.load(), merged = merge(local, s.progress);
        merged.mute = local.mute;
        U.replace(merged);
        queueProgress();
      }, function () { queueProgress(); }).then(function () { flush(); return r.pupil; });
    });
  }
  function signOut() { session = null; U.profile(null); }
  function signedIn() { return !!session; }
  function pupil() { return session ? session.pupil : null; }

  function relogin() {
    return request('POST', '/api/login', { code: session.code, pupilId: session.pupil.id }).then(function (res) {
      if (res.status === 200 && res.data && res.data.token) { session.token = res.data.token; return true; }
      return false;
    });
  }

  /* Outbox */
  function tasks() { return read(OUTBOX_KEY, []); }
  function setTasks(t) { write(OUTBOX_KEY, t.length ? t : null); }
  function queueProgress() {
    if (!session) return;
    var t = tasks().filter(function (x) { return !(x.k === 'progress' && x.pupil === session.pupil.id); });
    t.push({ k: 'progress', pupil: session.pupil.id });
    setTasks(t);
  }
  function rid() {
    try { if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID(); } catch (e) { /* fall through */ }
    return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function recordRound(body) {
    if (!session) return;
    var t = tasks(); t.push({ k: 'round', pupil: session.pupil.id, body: Object.assign({ rid: rid() }, body) });
    setTasks(t);
    queueProgress();
    flush();
  }
  function sendOne(task) {
    if (task.k === 'round') return request('POST', '/api/round', task.body, session.token);
    var local = U.load();
    return request('PUT', '/api/progress', { progress: local }, session.token).then(function (res) {
      if (res.status === 200 && res.data && res.data.progress) { var m = merge(local, res.data.progress); m.mute = local.mute; U.replace(m); }
      return res;
    });
  }
  /* Sends this pupil's waiting tasks, oldest first. Stops at the first sign of no signal. */
  function flush() {
    if (!session || flushing) return Promise.resolve();
    flushing = true;
    var me = session.pupil.id;
    var retried = false;
    function step() {
      if (!session) return;
      var task = tasks().filter(function (x) { return x.pupil === me; })[0];
      if (!task) return;
      return sendOne(task).then(function (res) {
        if (res.status === 401) {
          // The sign-in ran out (tablets stay open all day). Sign in again quietly with the class code on this device.
          // If the code has changed, the tasks wait on the device until the pupil signs in again.
          if (retried) return;
          retried = true;
          return relogin().then(function (ok) { return ok ? step() : undefined; });
        }
        var rest = tasks(), i = rest.indexOf(rest.filter(function (x) { return JSON.stringify(x) === JSON.stringify(task); })[0]);
        if (i >= 0) rest.splice(i, 1);
        setTasks(rest);
        return step();
      });
    }
    return Promise.resolve().then(step).catch(function () { /* no signal: try again later */ }).then(function () { flushing = false; });
  }
  window.addEventListener('online', function () { flush(); });

  D.net = {
    savedClass: savedClass, saveClass: saveClass, forgetClass: forgetClass, lookup: lookup, signIn: signIn, signOut: signOut,
    signedIn: signedIn, pupil: pupil, recordRound: recordRound, syncProgress: function () { queueProgress(); return flush(); }, flush: flush,
    pending: function () { return tasks().length; }, say: say, merge: merge, sanitize: sanitize
  };
})();
