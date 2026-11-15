/* Teacher console. Sign in, classes, paste names, class code card, one progress table per class.
   The admin also makes teacher accounts. Everything from the server is shown as text, never as markup. */
(function () {
  'use strict';
  var root = document.getElementById('app');
  var S = { token: null, me: null };
  try { S.token = sessionStorage.getItem('ddj.teacher'); } catch (e) { /* ignore */ }

  function h(tag, attrs) {
    var el = document.createElement(tag), kids = [].slice.call(arguments, 2);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === false || v == null) return;
      if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    });
    (function add(list) { list.forEach(function (c) { if (c == null || c === false) return; if (Array.isArray(c)) add(c); else el.appendChild(c.nodeType ? c : document.createTextNode(String(c))); }); })(kids);
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function btn(label, cls, fn, attrs) { return h('button', Object.assign({ type: 'button', class: cls || '', onclick: fn }, attrs || {}), label); }

  /* ---------- server ---------- */
  function api(method, path, body) {
    return fetch('/api/t' + path, { method: method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + S.token }, body: body === undefined ? undefined : JSON.stringify(body) })
      .then(function (res) {
        return res.json().catch(function () { return null; }).then(function (data) {
          if (res.status === 401) { signOut('Please sign in again.'); return Promise.reject({ handled: true }); }
          if (!res.ok) return Promise.reject({ message: (data && data.error) || 'Something went wrong.' });
          return data;
        });
      }, function () { return Promise.reject({ message: 'Could not reach the server. Check the connection.' }); });
  }
  function fail(e) { if (e && e.handled) return; flash('bad', (e && e.message) || 'Something went wrong.'); }
  function signOut(message) {
    S.token = null; S.me = null;
    try { sessionStorage.removeItem('ddj.teacher'); } catch (e) { /* ignore */ }
    loginView(message);
  }

  /* ---------- page frame ---------- */
  var flashEl = null;
  function flash(kind, text) {
    if (!flashEl) return;
    clear(flashEl);
    if (text) flashEl.appendChild(h('div', { class: 'msg ' + kind }, text));
  }
  function frame(title, kids, nav) {
    flashEl = h('div', { id: 'flash', role: 'status', 'aria-live': 'polite' });
    clear(root);
    var top = h('header', { class: 'top' },
      h('div', { class: 'brand' }, h('span', { class: 'mark', 'aria-hidden': 'true' }, '“'), 'Dialogue Dash Junior', h('span', { class: 'mark', 'aria-hidden': 'true' }, '”'), ' Teachers'),
      S.me ? h('nav', { class: 'nav', 'aria-label': 'Main' },
        btn('Classes', '', classesView), S.me.admin ? btn('Teachers', '', teachersView) : null,
        btn('Password', '', passwordView), btn('Sign out', '', function () { signOut(); })) : null);
    root.appendChild(top);
    root.appendChild(h('main', { id: 'main' }, flashEl, kids));
    document.title = title + ' - Dialogue Dash Junior';
    window.scrollTo && window.scrollTo(0, 0);
  }
  var field = function (id, label, attrs) {
    return h('div', { class: 'grow' }, h('label', { for: id }, label), h('input', Object.assign({ id: id, type: 'text', autocomplete: 'off' }, attrs || {})));
  };

  /* ---------- sign in ---------- */
  function loginView(message) {
    S.me = null;
    var user = h('input', { id: 'user', type: 'text', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false' });
    var pass = h('input', { id: 'pass', type: 'password', autocomplete: 'current-password' });
    var form = h('form', { class: 'card', onsubmit: function (e) {
      e.preventDefault();
      flash('info', 'Signing in...');
      fetch('/api/teacher/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: user.value, password: pass.value }) })
        .then(function (r) { return r.json().catch(function () { return null; }).then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (r) {
          if (!r.ok) { flash('bad', (r.d && r.d.error) || 'Could not sign in.'); return; }
          S.token = r.d.token; S.me = { admin: !!r.d.admin, name: r.d.name };
          try { sessionStorage.setItem('ddj.teacher', S.token); } catch (e) { /* ignore */ }
          classesView();
        }, function () { flash('bad', 'Could not reach the server. Check the connection.'); });
    } },
      h('h1', {}, 'Teacher sign in'),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('label', { for: 'user' }, 'Username'), user), h('div', { class: 'grow' }, h('label', { for: 'pass' }, 'Password'), pass),
        h('button', { type: 'submit', class: 'primary' }, 'Sign in')));
    frame('Sign in', form);
    if (message) flash('info', message);
    user.focus();
  }

  /* ---------- classes ---------- */
  function classesView() {
    api('GET', '/classes').then(function (r) {
      var name = h('input', { id: 'newclass', type: 'text', maxlength: '60', autocomplete: 'off' });
      var cards = r.classes.map(function (c) {
        return h('article', { class: 'class-card' + (c.archived ? ' archived' : '') },
          h('h2', {}, c.name, ' ', c.archived ? h('span', { class: 'badge' }, 'Archived') : null),
          h('div', { class: 'code', 'aria-label': 'Class code ' + c.code.split('').join(' ') }, c.code),
          h('p', { class: 'muted' }, c.pupils + (c.pupils === 1 ? ' pupil' : ' pupils')),
          h('div', { class: 'row' }, btn('Open', 'primary', function () { classView(c.id); }, { 'aria-label': 'Open ' + c.name })));
      });
      frame('Classes', [
        h('h1', {}, 'Your classes'),
        h('form', { class: 'card', onsubmit: function (e) {
          e.preventDefault();
          if (!name.value.trim()) { flash('bad', 'Give the class a name.'); return; }
          api('POST', '/classes', { name: name.value }).then(function (d) { classView(d.class.id, 'ok', 'Class made. Now add the pupils’ names.'); }, fail);
        } }, h('div', { class: 'row' }, h('div', { class: 'grow' }, h('label', { for: 'newclass' }, 'New class name'), name), h('button', { type: 'submit', class: 'primary' }, 'Create class'))),
        r.classes.length ? h('section', { class: 'classes', 'aria-label': 'Classes' }, cards) : h('p', { class: 'muted' }, 'No classes yet. Make one above.')
      ]);
    }, fail);
  }

  var DAY = 86400000;
  function ago(ts) {
    if (!ts) return 'Never';
    var d0 = new Date(); d0.setHours(0, 0, 0, 0);
    var d1 = new Date(ts); d1.setHours(0, 0, 0, 0);
    var days = Math.round((d0 - d1) / DAY);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return days + ' days ago';
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  function stars(n) {
    if (!n) return h('span', { class: 'stars none', 'aria-label': 'Not played' }, '–');
    return h('span', { class: 'stars', 'aria-label': n + (n === 1 ? ' star' : ' stars') }, '★'.repeat(n) + '☆'.repeat(3 - n));
  }

  function classView(id, kind, text) {
    Promise.all([api('GET', '/classes'), api('GET', '/classes/' + id + '/table')]).then(function (res) {
      var cls = res[0].classes.filter(function (c) { return c.id === id; })[0], table = res[1];
      if (!cls) { classesView(); return; }
      var reload = function (k, t) { classView(id, k, t); };

      var head = h('section', { class: 'card' },
        h('h1', {}, cls.name, ' ', cls.archived ? h('span', { class: 'badge' }, 'Archived') : null),
        h('p', { class: 'muted' }, 'Class code'),
        h('div', { class: 'code', style: 'font-size:40px', 'aria-label': 'Class code ' + cls.code.split('').join(' ') }, cls.code),
        h('div', { class: 'row', style: 'margin-top:12px' },
          btn('Class code card', 'primary', function () { cardView(cls); }),
          btn('New code', '', function () {
            if (!window.confirm('Make a new class code? The old code stops working on every tablet, and signed-in children are signed out.')) return;
            api('POST', '/classes/' + id + '/regen', { signOut: true }).then(function () { reload('ok', 'New code made. Give out the new class code card.'); }, fail);
          }),
          btn('Rename', '', function () {
            var n = window.prompt('Class name', cls.name);
            if (n && n.trim()) api('PATCH', '/classes/' + id, { name: n }).then(function () { reload('ok', 'Renamed.'); }, fail);
          }),
          btn(cls.archived ? 'Restore' : 'Archive', '', function () {
            api('PATCH', '/classes/' + id, { archived: !cls.archived }).then(function () { reload('ok', cls.archived ? 'Class restored.' : 'Class archived. Its code no longer works.'); }, fail);
          }),
          cls.owned ? btn('Delete class', 'danger', function () {
            if (!window.confirm('Delete ' + cls.name + ' and every pupil’s record in it? This cannot be undone.')) return;
            api('DELETE', '/classes/' + id).then(function () { classesView(); }, fail);
          }) : null));

      var levelHeads = [1, 2, 3, 4, 5, 6, 7].map(function (l) { return h('th', { scope: 'col', title: table.rules[l].rule }, 'L' + l + ' ', h('span', { class: 'small' }, table.rules[l].name)); });
      var body = table.rows.map(function (r) {
        return h('tr', {},
          h('th', { scope: 'row' }, r.name),
          [1, 2, 3, 4, 5, 6, 7].map(function (l) { return h('td', {}, stars(r.levels[l])); }),
          h('td', {}, ago(r.lastPlayed)),
          h('td', {}, r.missesMost ? [h('strong', {}, r.missesMost.name), h('br'), h('span', { class: 'small muted' }, r.missesMost.rule)] : h('span', { class: 'muted' }, '–')));
      });
      var progress = h('section', { class: 'card', 'aria-labelledby': 'h-progress' },
        h('h2', { id: 'h-progress' }, 'Progress'),
        table.rows.length ? [
          h('div', { class: 'tablewrap', tabindex: '0', role: 'region', 'aria-label': 'Progress table, scrolls sideways' },
            h('table', {}, h('caption', { class: 'small muted', style: 'text-align:left;padding:8px 12px' }, 'Stars are the best round at each level. The last column is the rule with the most first-try misses (2 or more).'),
              h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Pupil'), levelHeads, h('th', { scope: 'col' }, 'Last played'), h('th', { scope: 'col' }, 'Misses most'))),
              h('tbody', {}, body)))
        ] : h('p', { class: 'muted' }, 'No pupils yet. Paste their names below.'));

      var area = h('textarea', { id: 'paste', 'aria-describedby': 'paste-help', spellcheck: 'false' });
      var out = h('div', { 'aria-live': 'polite' });
      var add = h('section', { class: 'card', 'aria-labelledby': 'h-add' },
        h('h2', { id: 'h-add' }, 'Add pupils'),
        h('label', { for: 'paste' }, 'Paste the names, one on each line'),
        h('p', { id: 'paste-help', class: 'muted small' }, 'Children tap their name, so use what they can read: “Mei”, or “Mei T.” if two children share a name.'),
        area,
        h('div', { class: 'row', style: 'margin-top:12px' }, btn('Preview', 'blue', function () {
          api('POST', '/classes/' + id + '/pupils/preview', { text: area.value }).then(function (p) {
            clear(out);
            if (!p.rows.length) { out.appendChild(h('p', { class: 'muted' }, 'No names found.')); return; }
            var good = p.rows.filter(function (x) { return x.status === 'ok'; });
            out.appendChild(h('ul', { class: 'names' }, p.rows.map(function (x) {
              return h('li', {}, h('span', {}, x.name), x.status === 'ok' ? h('span', { class: 'small muted' }, 'new') : h('span', { class: 'pill-dup small' }, 'already here'));
            })));
            out.appendChild(h('div', { class: 'row', style: 'margin-top:12px' }, btn('Add ' + good.length + (good.length === 1 ? ' pupil' : ' pupils'), 'primary', function () {
              api('POST', '/classes/' + id + '/pupils', { names: good.map(function (x) { return x.name; }) }).then(function (d) {
                reload('ok', d.added + (d.added === 1 ? ' pupil added.' : ' pupils added.') + (d.skipped.length ? ' Left out: ' + d.skipped.map(function (s) { return s.name + ' (' + s.reason + ')'; }).join(', ') + '.' : ''));
              }, fail);
            }, good.length ? {} : { disabled: true })));
          }, fail);
        })), out);

      var pupils = h('section', { class: 'card', 'aria-labelledby': 'h-pupils' }, h('h2', { id: 'h-pupils' }, 'Pupils (' + table.rows.length + ')'),
        table.rows.length ? h('ul', { class: 'names' }, table.rows.map(function (r) {
          return h('li', {}, h('span', {}, r.name), btn('Remove', 'link', function () {
            if (!window.confirm('Remove ' + r.name + ' and their progress? This cannot be undone.')) return;
            api('DELETE', '/pupils/' + r.id).then(function () { reload('ok', r.name + ' removed.'); }, fail);
          }, { 'aria-label': 'Remove ' + r.name }));
        })) : h('p', { class: 'muted' }, 'Nobody here yet.'));

      frame(cls.name, [h('p', {}, btn('← All classes', 'link', classesView)), head, progress, add, pupils]);
      if (kind) flash(kind, text);
    }, fail);
  }

  /* ---------- the class code card (this is what gets printed) ---------- */
  function cardView(cls) {
    frame('Class code card', [
      h('p', { class: 'noprint' }, btn('← Back to ' + cls.name, 'link', function () { classView(cls.id); })),
      h('section', { class: 'print-card', 'aria-label': 'Class code card' },
        h('h1', {}, h('span', { style: 'color:#C2410C' }, '“'), 'Dialogue Dash Junior', h('span', { style: 'color:#C2410C' }, '”')),
        h('p', { style: 'font-size:26px;font-weight:700;margin:0' }, cls.name),
        h('p', { class: 'muted', style: 'margin:12px 0 0' }, 'Class code'),
        h('div', { class: 'big', 'aria-label': 'Class code ' + cls.code.split('').join(' ') }, cls.code),
        h('ol', {}, h('li', {}, 'Open ', h('span', { class: 'url' }, location.origin + '/')), h('li', {}, 'Tap My class.'), h('li', {}, 'Type the code above once.'), h('li', {}, 'Each child taps their own name.'))),
      h('div', { class: 'noprint row center' }, btn('Print', 'primary', function () { window.print(); }))
    ]);
  }

  /* ---------- teacher accounts (admin) ---------- */
  function secretBox(who, password, what) {
    return h('div', { class: 'msg ok', role: 'alert' }, h('p', { style: 'margin:0 0 8px' }, what + ' for ' + who + '. It is shown only once, so write it down or copy it now:'), h('span', { class: 'secret' }, password));
  }
  function teachersView(secret) {
    Promise.all([api('GET', '/teachers'), api('GET', '/classes')]).then(function (res) {
      var teachers = res[0].teachers, classes = res[1].classes;
      var name = h('input', { id: 'tname', type: 'text', maxlength: '60', autocomplete: 'off' });
      var user = h('input', { id: 'tuser', type: 'text', maxlength: '30', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' });
      var create = h('form', { class: 'card', onsubmit: function (e) {
        e.preventDefault();
        api('POST', '/teachers', { name: name.value, username: user.value }).then(function (d) { teachersView(secretBox(d.teacher.name, d.password, 'Password')); }, fail);
      } }, h('h2', {}, 'Make a teacher account'),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('label', { for: 'tname' }, 'Name'), name), h('div', { class: 'grow' }, h('label', { for: 'tuser' }, 'Username (lowercase)'), user), h('button', { type: 'submit', class: 'primary' }, 'Create')));
      var cards = teachers.map(function (t) {
        var boxes = classes.map(function (c) {
          var cb = h('input', { type: 'checkbox', id: 'c-' + t.id + '-' + c.id, 'data-class': c.id });
          cb.checked = t.classes.indexOf(c.id) >= 0;
          return h('label', { class: 'check', for: cb.id }, cb, c.name + ' (' + c.code + ')');
        });
        return h('article', { class: 'card', 'aria-label': t.name },
          h('h2', {}, t.name, ' ', h('span', { class: 'badge' }, t.active ? 'On' : 'Switched off')),
          h('p', { class: 'muted small' }, 'Username: ' + t.username + '. Last sign-in: ' + ago(t.last_login) + '.'),
          h('fieldset', { style: 'border:0;padding:0;margin:0 0 12px' }, h('legend', { class: 'small muted' }, 'Classes this teacher can run'), boxes.length ? boxes : h('p', { class: 'muted small' }, 'No classes yet.')),
          h('div', { class: 'row' },
            btn('Save classes', 'blue', function (ev) {
              var ids = [].slice.call(ev.target.closest('article').querySelectorAll('input[data-class]')).filter(function (b) { return b.checked; }).map(function (b) { return +b.getAttribute('data-class'); });
              api('PATCH', '/teachers/' + t.id, { classes: ids }).then(function () { teachersView(); flashLater('ok', 'Classes saved.'); }, fail);
            }),
            btn('New password', '', function () {
              if (!window.confirm('Make a new password for ' + t.name + '? Their old password stops working.')) return;
              api('POST', '/teachers/' + t.id + '/reset-password').then(function (d) { teachersView(secretBox(t.name, d.password, 'New password')); }, fail);
            }),
            btn(t.active ? 'Switch off' : 'Switch on', '', function () { api('PATCH', '/teachers/' + t.id, { active: !t.active }).then(function () { teachersView(); }, fail); }),
            btn('Delete', 'danger', function () {
              if (!window.confirm('Delete ' + t.name + '’s account? Their classes stay, but only you can then delete them.')) return;
              api('DELETE', '/teachers/' + t.id).then(function () { teachersView(); }, fail);
            })));
      });
      frame('Teachers', [h('h1', {}, 'Teacher accounts'), secret || null, create, cards.length ? cards : h('p', { class: 'muted' }, 'No teacher accounts yet.')]);
    }, fail);
  }
  function flashLater(kind, text) { setTimeout(function () { flash(kind, text); }, 150); }

  /* ---------- my password ---------- */
  function passwordView() {
    var f = function (id) { return h('input', { id: id, type: 'password', autocomplete: id === 'cur' ? 'current-password' : 'new-password' }); };
    var cur = f('cur'), n1 = f('n1'), n2 = f('n2');
    frame('Password', [h('h1', {}, 'Change my password'),
      S.me && S.me.admin ? h('p', { class: 'muted' }, 'The admin password is set in Cloudflare (the teacher_password secret).') :
        h('form', { class: 'card', onsubmit: function (e) {
          e.preventDefault();
          if (n1.value !== n2.value) { flash('bad', 'The two new passwords are different.'); return; }
          api('POST', '/me/password', { current: cur.value, next: n1.value }).then(function () { cur.value = n1.value = n2.value = ''; flash('ok', 'Password changed.'); }, fail);
        } },
        h('div', { class: 'row' }, h('div', { class: 'grow' }, h('label', { for: 'cur' }, 'Current password'), cur), h('div', { class: 'grow' }, h('label', { for: 'n1' }, 'New password (8 or more characters)'), n1), h('div', { class: 'grow' }, h('label', { for: 'n2' }, 'New password again'), n2),
          h('button', { type: 'submit', class: 'primary' }, 'Change password')))]);
  }

  /* ---------- start ---------- */
  if (S.token) {
    api('GET', '/me').then(function (me) { S.me = { admin: !!me.admin, name: me.name }; classesView(); }, function () { /* signOut already showed the sign-in page */ });
  } else loginView();
})();
