/* DOM helper, storage, sound and read-aloud. Classic script: works from a folder as well as from a server. */
(function () {
  'use strict';
  var D = (window.DDJ = window.DDJ || {});
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* h(tag, attrs, ...kids). Text goes in as text nodes, never as markup. */
  function build(el, attrs, kids) {
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === false || v == null) return;
      if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.setAttribute('class', v);
      else if (k === 'style' && typeof v === 'object') Object.keys(v).forEach(function (s) { el.style.setProperty(s, v[s]); });
      else el.setAttribute(k, v === true ? '' : String(v));
    });
    kids.forEach(function add(kid) {
      if (kid == null || kid === false) return;
      if (Array.isArray(kid)) kid.forEach(add);
      else el.appendChild(kid.nodeType ? kid : document.createTextNode(String(kid)));
    });
    return el;
  }
  function h(tag, attrs) { return build(document.createElement(tag), attrs, [].slice.call(arguments, 2)); }
  function s(tag, attrs) { return build(document.createElementNS(SVGNS, tag), attrs, [].slice.call(arguments, 2)); }

  /* Seeded random for tests and screenshots: add ?seed=7 to the address. */
  var seed = null;
  try { var m = /[?&]seed=(\d+)/.exec(location.search); if (m) seed = parseInt(m[1], 10); } catch (e) { /* ignore */ }
  var rnd = seed == null ? Math.random : D.engine.mulberry32(seed);

  /* Progress: one localStorage key, with an in-memory fallback. */
  var KEY = 'ddj.progress';   // "Just try it": this device only. A signed-in pupil gets 'ddj.progress.p<id>' (and the server keeps a copy).
  function fresh() { return { v: 1, friend: 'duck', mute: false, levels: {}, stickers: {}, missed: {}, seen: {}, rounds: 0 }; }
  var mem = null;
  function profile(id) { KEY = id ? 'ddj.progress.p' + id : 'ddj.progress'; mem = null; }
  function replace(obj) { mem = Object.assign(fresh(), obj); save(); }
  function load() {
    if (mem) return mem;
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { mem = Object.assign(fresh(), JSON.parse(raw)); return mem; }
    } catch (e) { /* storage blocked: keep going in memory */ }
    mem = fresh();
    return mem;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* ignore */ } }
  function reset() { mem = fresh(); try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }

  /* Sound: soft Web Audio tones, no files. */
  var ctx = null;
  function audio() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; }
    return ctx;
  }
  function tone(freq, start, len, type, vol) {
    var c = audio();
    if (!c) return;
    var o = c.createOscillator(), g = c.createGain(), t = c.currentTime + start;
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.05, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + len + 0.05);
  }
  var SOUNDS = {
    tap: function () { tone(660, 0, 0.07, 'sine', 0.03); },
    right: function () { tone(523, 0, 0.14); tone(784, 0.12, 0.22); },
    wrong: function () { tone(330, 0, 0.18, 'triangle', 0.035); tone(294, 0.14, 0.22, 'triangle', 0.03); },
    star: function () { tone(659, 0, 0.12); tone(784, 0.1, 0.12); tone(988, 0.2, 0.26); },
    sticker: function () { tone(784, 0, 0.1); tone(988, 0.09, 0.1); tone(1319, 0.18, 0.3); }
  };
  function play(name) {
    if (load().mute || !SOUNDS[name]) return;
    try { var c = audio(); if (c && c.state === 'suspended') c.resume(); SOUNDS[name](); } catch (e) { /* ignore */ }
  }

  /* Read aloud: browser voice in British English. Hidden when the device has none. */
  function britishVoice() {
    var ss = window.speechSynthesis;
    if (!ss || typeof ss.getVoices !== 'function') return null;
    var vs = ss.getVoices() || [];
    for (var i = 0; i < vs.length; i++) if (/^en[-_]GB$/i.test(vs[i].lang)) return vs[i];
    return null;
  }
  function speak(text) {
    var ss = window.speechSynthesis, v = britishVoice();
    if (!ss || !v || typeof window.SpeechSynthesisUtterance !== 'function') return;
    try {
      ss.cancel();
      var u = new window.SpeechSynthesisUtterance(text);
      u.voice = v; u.lang = v.lang; u.rate = 0.85;
      ss.speak(u);
    } catch (e) { /* ignore */ }
  }
  function stopSpeaking() { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
  function refreshSpeakers() {
    var ok = !!britishVoice();
    [].forEach.call(document.querySelectorAll('[data-speak]'), function (b) { b.hidden = !ok; });
  }
  if (window.speechSynthesis && window.speechSynthesis.addEventListener) {
    window.speechSynthesis.addEventListener('voiceschanged', refreshSpeakers);
  }

  function reducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  D.u = {
    h: h, s: s, rnd: function () { return rnd(); }, seeded: seed != null,
    load: load, save: save, reset: reset, profile: profile, replace: replace,
    play: play, speak: speak, stopSpeaking: stopSpeaking, refreshSpeakers: refreshSpeakers,
    britishVoice: britishVoice, reducedMotion: reducedMotion
  };
})();
