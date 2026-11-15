/* All pictures are drawn here from plain SVG shapes: four friends, action icons, 20 stickers. */
(function () {
  'use strict';
  var D = window.DDJ, s = D.u.s;
  var INK = '#1F2A44', CHEEK = '#FF9DB5';

  function svg(box, label, kids) {
    return s.apply(null, ['svg', { viewBox: box, role: label ? 'img' : null, 'aria-label': label || null, 'aria-hidden': label ? null : 'true', focusable: 'false' }].concat(kids));
  }
  function eyes(y, dx) { return [s('circle', { cx: 50 - dx, cy: y, r: 4.5, fill: INK }), s('circle', { cx: 50 + dx, cy: y, r: 4.5, fill: INK })]; }
  function cheeks(y, dx) { return [s('circle', { cx: 50 - dx, cy: y, r: 6, fill: CHEEK, opacity: '0.85' }), s('circle', { cx: 50 + dx, cy: y, r: 6, fill: CHEEK, opacity: '0.85' })]; }
  function smile(y) { return s('path', { d: 'M42 ' + y + ' Q50 ' + (y + 8) + ' 58 ' + y, fill: 'none', stroke: INK, 'stroke-width': 3, 'stroke-linecap': 'round' }); }

  var FRIENDS = {
    duck: { name: 'Duffy', colour: '#FFD23F', draw: function () { return [
      s('path', { d: 'M46 14 Q50 4 56 14', fill: 'none', stroke: '#FFD23F', 'stroke-width': 5, 'stroke-linecap': 'round' }),
      s('circle', { cx: 50, cy: 56, r: 36, fill: '#FFD23F' }),
      s('ellipse', { cx: 50, cy: 74, rx: 20, ry: 13, fill: '#FFE98A' })
    ].concat(eyes(48, 14), cheeks(60, 22), [s('ellipse', { cx: 50, cy: 58, rx: 10, ry: 6, fill: '#FF9F43' }), smile(70)]); } },
    bunny: { name: 'Bibi', colour: '#F3D6F5', draw: function () { return [
      s('ellipse', { cx: 36, cy: 22, rx: 8, ry: 20, fill: '#F3D6F5' }), s('ellipse', { cx: 64, cy: 22, rx: 8, ry: 20, fill: '#F3D6F5' }),
      s('ellipse', { cx: 36, cy: 24, rx: 4, ry: 13, fill: '#FF9DB5' }), s('ellipse', { cx: 64, cy: 24, rx: 4, ry: 13, fill: '#FF9DB5' }),
      s('circle', { cx: 50, cy: 62, r: 32, fill: '#F3D6F5' })
    ].concat(eyes(56, 13), cheeks(66, 21), [s('circle', { cx: 50, cy: 63, r: 3.5, fill: '#FF6F91' }), smile(70)]); } },
    frog: { name: 'Pip', colour: '#8EDB6A', draw: function () { return [
      s('circle', { cx: 34, cy: 28, r: 14, fill: '#8EDB6A' }), s('circle', { cx: 66, cy: 28, r: 14, fill: '#8EDB6A' }),
      s('circle', { cx: 50, cy: 60, r: 34, fill: '#8EDB6A' }),
      s('ellipse', { cx: 50, cy: 76, rx: 18, ry: 11, fill: '#C9F2B5' })
    ].concat(eyes(28, 16).map(function (e) { e.setAttribute('cx', e.getAttribute('cx')); return e; }), cheeks(60, 22), [smile(62)]); } },
    cat: { name: 'Mochi', colour: '#B9C4E0', draw: function () { return [
      s('path', { d: 'M18 40 L22 10 L44 26 Z', fill: '#B9C4E0' }), s('path', { d: 'M82 40 L78 10 L56 26 Z', fill: '#B9C4E0' }),
      s('circle', { cx: 50, cy: 58, r: 34, fill: '#B9C4E0' })
    ].concat(eyes(52, 14), cheeks(64, 22), [
      s('path', { d: 'M47 60 L53 60 L50 64 Z', fill: '#FF6F91' }), smile(68),
      s('path', { d: 'M20 60 L34 62', stroke: INK, 'stroke-width': 2, 'stroke-linecap': 'round' }),
      s('path', { d: 'M80 60 L66 62', stroke: INK, 'stroke-width': 2, 'stroke-linecap': 'round' })
    ]); } }
  };
  var FRIEND_IDS = ['duck', 'bunny', 'frog', 'cat'];
  function friend(id) { var f = FRIENDS[id] || FRIENDS.duck; return svg('0 0 100 100', null, f.draw()); }

  var ICONS = {
    speaker: function () { return svg('0 0 24 24', null, [s('path', { d: 'M3 9h4l5-4v14l-5-4H3z', fill: 'currentColor' }), s('path', { d: 'M16 8c2 2 2 6 0 8M19 5c4 4 4 10 0 14', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' })]); },
    muted: function () { return svg('0 0 24 24', null, [s('path', { d: 'M3 9h4l5-4v14l-5-4H3z', fill: 'currentColor' }), s('path', { d: 'M16 9l6 6M22 9l-6 6', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round' })]); },
    home: function () { return svg('0 0 24 24', null, [s('path', { d: 'M3 12L12 4l9 8M6 10v10h12V10', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' })]); },
    lock: function () { return svg('0 0 24 24', null, [s('rect', { x: 5, y: 11, width: 14, height: 10, rx: 3, fill: 'currentColor' }), s('path', { d: 'M8 11V8a4 4 0 018 0v3', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4 })]); },
    tap: function () { return svg('0 0 24 24', null, [s('circle', { cx: 12, cy: 12, r: 3.5, fill: 'currentColor' }), s('path', { d: 'M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' })]); },
    pick: function () { return svg('0 0 24 24', null, [s('rect', { x: 3, y: 5, width: 18, height: 6, rx: 3, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }), s('rect', { x: 3, y: 14, width: 18, height: 6, rx: 3, fill: 'currentColor' })]); },
    put: function () { return svg('0 0 24 24', null, [s('path', { d: 'M12 3v10M7 9l5 5 5-5', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }), s('path', { d: 'M4 15v5h16v-5', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round' })]); },
    newline: function () { return svg('0 0 24 24', null, [s('path', { d: 'M19 5v8H6M10 8l-5 5 5 5', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })]); },
    star: function (on) { return svg('0 0 24 24', null, [s('path', { d: 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z', fill: on ? '#FFD23F' : '#FFFFFF', stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' })]); }
  };
  function icon(name, arg) { return ICONS[name](arg); }

  /* 20 stickers, each 1 to 4 plain shapes on a 48 x 48 board. */
  function P(d, fill, extra) { return s('path', Object.assign({ d: d, fill: fill }, extra || {})); }
  function C(x, y, r, fill) { return s('circle', { cx: x, cy: y, r: r, fill: fill }); }
  function R(x, y, w, h, rx, fill) { return s('rect', { x: x, y: y, width: w, height: h, rx: rx, fill: fill }); }
  var STICKERS = [
    ['Star', function () { return [P('M24 4l5.5 12 13 1.5-9.7 8.8 2.7 12.9L24 32l-11.5 7.2 2.7-12.9-9.7-8.8 13-1.5z', '#FFD23F', { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' })]; }],
    ['Heart', function () { return [P('M24 41C8 29 5 20 9 13c4-6 12-5 15 1 3-6 11-7 15-1 4 7 1 16-15 28z', '#FF8FA3')]; }],
    ['Moon', function () { return [P('M32 6a18 18 0 100 36A15 15 0 0132 6z', '#FFE98A', { stroke: INK, 'stroke-width': 2 })]; }],
    ['Sun', function () { return [C(24, 24, 11, '#FFD23F'), P('M24 3v7M24 38v7M3 24h7M38 24h7M9 9l5 5M34 34l5 5M39 9l-5 5M14 34l-5 5', 'none', { stroke: '#FF9F43', 'stroke-width': 3.5, 'stroke-linecap': 'round' })]; }],
    ['Cloud', function () { return [C(17, 28, 9, '#CFE8FF'), C(29, 24, 11, '#CFE8FF'), R(8, 28, 32, 9, 4.5, '#CFE8FF')]; }],
    ['Flower', function () { return [C(24, 12, 7, '#FF8FA3'), C(36, 24, 7, '#FF8FA3'), C(24, 36, 7, '#FF8FA3'), C(12, 24, 7, '#FF8FA3'), C(24, 24, 6, '#FFD23F')]; }],
    ['Apple', function () { return [C(24, 28, 15, '#FF6F6F'), P('M24 14c0-5 2-8 6-9', 'none', { stroke: '#5A8F3C', 'stroke-width': 3, 'stroke-linecap': 'round' })]; }],
    ['Fish', function () { return [s('ellipse', { cx: 21, cy: 24, rx: 15, ry: 10, fill: '#5BB8F5' }), P('M34 24l11-9v18z', '#5BB8F5'), C(14, 21, 2.2, INK)]; }],
    ['Bus', function () { return [R(5, 10, 38, 26, 6, '#FFD23F'), R(9, 15, 30, 9, 2, '#CFE8FF'), C(15, 38, 4.5, INK), C(33, 38, 4.5, INK)]; }],
    ['Train', function () { return [R(7, 8, 34, 30, 9, '#1D6FD8'), R(12, 14, 24, 10, 3, '#CFE8FF'), C(16, 31, 2.8, '#FFD23F'), C(32, 31, 2.8, '#FFD23F')]; }],
    ['House', function () { return [R(10, 20, 28, 20, 2, '#FFB4AB'), P('M5 22L24 6l19 16z', '#C2410C'), R(20, 28, 8, 12, 2, '#FFF8E7')]; }],
    ['Tree', function () { return [R(21, 28, 6, 15, 2, '#A0693C'), C(24, 20, 14, '#7DE2B8')]; }],
    ['Kite', function () { return [P('M24 3l14 17-14 17L10 20z', '#FF8FA3'), P('M24 37c-3 4 3 5 0 9', 'none', { stroke: INK, 'stroke-width': 2, 'stroke-linecap': 'round' })]; }],
    ['Balloon', function () { return [s('ellipse', { cx: 24, cy: 19, rx: 13, ry: 16, fill: '#FF6F91' }), P('M24 35v10', 'none', { stroke: INK, 'stroke-width': 2 })]; }],
    ['Ice cream', function () { return [P('M14 24h20L24 44z', '#E8B86D'), C(24, 17, 11, '#FFC2D6'), C(24, 9, 6, '#FFF8E7')]; }],
    ['Cup', function () { return [R(9, 14, 24, 26, 5, '#FFFFFF'), P('M33 20h4a5 5 0 010 12h-4', 'none', { stroke: INK, 'stroke-width': 3 }), R(9, 14, 24, 8, 4, '#C2410C')]; }],
    ['Umbrella', function () { return [P('M4 24C4 12 14 5 24 5s20 7 20 19z', '#1D6FD8'), P('M24 24v14a4 4 0 01-8 0', 'none', { stroke: INK, 'stroke-width': 3, 'stroke-linecap': 'round' })]; }],
    ['Cupcake', function () { return [P('M10 26h28l-4 16H14z', '#FFB4AB'), C(24, 20, 12, '#FFF8E7'), C(24, 9, 4, '#FF4D6D')]; }],
    ['Rocket', function () { return [s('ellipse', { cx: 24, cy: 22, rx: 8, ry: 18, fill: '#CFE8FF', stroke: INK, 'stroke-width': 2 }), C(24, 20, 4, '#1D6FD8'), P('M16 30l-7 9 9-3zM32 30l7 9-9-3z', '#FF6F6F')]; }],
    ['Rainbow', function () { return [P('M5 38a19 19 0 0138 0', 'none', { stroke: '#FF8FA3', 'stroke-width': 5 }), P('M11 38a13 13 0 0126 0', 'none', { stroke: '#FFD23F', 'stroke-width': 5 }), P('M17 38a7 7 0 0114 0', 'none', { stroke: '#7DE2B8', 'stroke-width': 5 })]; }]
  ];
  function sticker(i, label) {
    var st = STICKERS[i];
    return svg('0 0 48 48', label === false ? null : st[0] + ' sticker', st[1]());
  }

  D.art = { friend: friend, FRIENDS: FRIENDS, FRIEND_IDS: FRIEND_IDS, icon: icon, sticker: sticker, STICKERS: STICKERS };
})();
