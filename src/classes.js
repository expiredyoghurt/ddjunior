// Teacher API (everything under /api/t/*): sign-in, classes, pupils (paste a list of names), and the progress table.

import { signToken, safeEqual, teacherConfigured, newClassCode } from './auth.js';
import {
  ADMIN, canClass, needClass, needAdmin, teacherSignIn, whoAmI, listTeachers, createTeacher, updateTeacher, resetTeacherPassword, deleteTeacher, changeOwnPassword,
} from './accounts.js';
import { HttpError, json, readJson, clientIp, rateLimited, clip } from './util.js';

export const MAX_CLASSES_PER_TEACHER = 30;
export const MAX_PUPILS_PER_CLASS = 80;

// The rules, in the words a teacher would use. Level number = rule number.
export const RULES = {
  1: { name: 'Who is talking?', rule: 'Spoken words are what someone says out loud.' },
  2: { name: 'Speech marks', rule: 'Speech marks go round the spoken words, and only those.' },
  3: { name: 'Little marks', rule: 'A comma goes inside when the speaker comes after. ! and ? go inside too.' },
  4: { name: 'Build it', rule: 'Spoken words start with a capital letter. The speaker word starts small after speech.' },
  5: { name: 'New line', rule: 'A new speaker starts a new line.' },
  6: { name: 'Split speech', rule: 'When the speaker comes in the middle, each spoken part has its own speech marks. The second part starts with a small letter.' },
  7: { name: 'Speaking words', rule: 'Words like whispered, called, replied and cried tell how someone speaks. They work like said.' },
};
const MISS_MIN = 2; // fewer first-try misses than this is not a pattern yet

export async function teacherLogin(request, env) {
  if (!teacherConfigured(env)) throw new HttpError(503, 'Teacher sign-in is not set up yet. Set the teacher_user and teacher_password secrets in Cloudflare.');
  if (await rateLimited(env, 'RL_LOGIN', clientIp(request))) throw new HttpError(429, 'Too many tries. Wait a minute and try again.');
  const body = await readJson(request);
  const user = clip(body.username, 100);
  const pass = clip(body.password, 200);
  const [u, p] = await Promise.all([safeEqual(user, env.teacher_user), safeEqual(pass, env.teacher_password)]);
  if (u && p) return json({ token: await signToken(env, { r: 't' }, 8 * 3600), admin: true, name: 'Admin' });
  const t = await teacherSignIn(env, user, pass);
  if (!t) throw new HttpError(401, 'Wrong username or password.');
  return json({ token: await signToken(env, { r: 't', tid: t.id, sv: t.sess_ver }, 8 * 3600), admin: false, name: t.name });
}

// ---------- classes ----------

async function listClasses(env, who) {
  const rows = ((await env.DB.prepare(
    `SELECT c.id, c.name, c.code, c.archived, c.created_at, (SELECT COUNT(*) FROM pupils p WHERE p.class_id = c.id) AS pupils
       FROM classes c ORDER BY c.archived, c.name COLLATE NOCASE`).all()).results || []).filter((c) => canClass(who, c.id));
  let owned = new Set();
  if (!who.admin) owned = new Set(((await env.DB.prepare('SELECT class_id FROM class_owners WHERE teacher_id = ?1').bind(who.id).all()).results || []).map((r) => r.class_id));
  return json({ classes: rows.map((c) => ({ ...c, archived: !!c.archived, owned: who.admin || owned.has(c.id) })) });
}

async function createClass(request, env, who) {
  const body = await readJson(request);
  const name = clip(body.name, 60).trim();
  if (!name) throw new HttpError(400, 'Give the class a name.');
  if (!who.admin) {
    const made = (await env.DB.prepare('SELECT COUNT(*) AS n FROM class_owners WHERE teacher_id = ?1').bind(who.id).first()).n;
    if (made >= MAX_CLASSES_PER_TEACHER) throw new HttpError(403, `You can create up to ${MAX_CLASSES_PER_TEACHER} classes. Delete one you no longer need, or ask the admin.`);
  }
  for (let i = 0; i < 12; i++) {
    let row;
    try {
      row = await env.DB.prepare('INSERT INTO classes (name, code, created_at) VALUES (?1, ?2, ?3) RETURNING id, name, code').bind(name, newClassCode(), Date.now()).first();
    } catch (e) {
      if (!/UNIQUE/i.test(String(e?.message))) throw e;
      continue;
    }
    if (!who.admin) {
      await env.DB.batch([
        env.DB.prepare('INSERT OR IGNORE INTO teacher_classes (teacher_id, class_id) VALUES (?1, ?2)').bind(who.id, row.id),
        env.DB.prepare('INSERT OR REPLACE INTO class_owners (class_id, teacher_id) VALUES (?1, ?2)').bind(row.id, who.id),
      ]);
    }
    return json({ class: row });
  }
  throw new HttpError(500, 'Could not make a unique class code. Try again.');
}

async function needOwner(env, who, classId) {
  if (who.admin) return;
  const row = await env.DB.prepare('SELECT teacher_id FROM class_owners WHERE class_id = ?1').bind(classId).first();
  if (!row || row.teacher_id !== who.id) throw new HttpError(403, 'Only the teacher who made a class (or the admin) can delete it. You can archive it instead.');
}

async function updateClass(request, env, id) {
  const body = await readJson(request);
  if (body.name !== undefined) {
    const name = clip(body.name, 60).trim();
    if (!name) throw new HttpError(400, 'Give the class a name.');
    await env.DB.prepare('UPDATE classes SET name = ?1 WHERE id = ?2').bind(name, id).run();
  }
  if (body.archived !== undefined) await env.DB.prepare('UPDATE classes SET archived = ?1, sess_ver = sess_ver + 1 WHERE id = ?2').bind(body.archived ? 1 : 0, id).run();
  return json({ ok: true });
}

// A new code stops the old one working on every device. signOut also ends sessions that are open right now.
async function regenCode(request, env, id) {
  const body = await readJson(request);
  for (let i = 0; i < 12; i++) {
    try {
      const row = await env.DB
        .prepare(`UPDATE classes SET code = ?1${body.signOut === false ? '' : ', sess_ver = sess_ver + 1'} WHERE id = ?2 RETURNING code`)
        .bind(newClassCode(), id).first();
      if (!row) throw new HttpError(404, 'Class not found.');
      return json({ code: row.code });
    } catch (e) {
      if (e instanceof HttpError) throw e;
      if (!/UNIQUE/i.test(String(e?.message))) throw e;
    }
  }
  throw new HttpError(500, 'Could not make a unique class code. Try again.');
}

async function deleteClass(env, id) {
  const inClass = '(SELECT id FROM pupils WHERE class_id = ?1)';
  await env.DB.batch([
    env.DB.prepare('DELETE FROM answers WHERE class_id = ?1').bind(id),
    env.DB.prepare('DELETE FROM rounds WHERE class_id = ?1').bind(id),
    env.DB.prepare(`DELETE FROM progress WHERE pupil_id IN ${inClass}`).bind(id),
    env.DB.prepare('DELETE FROM pupils WHERE class_id = ?1').bind(id),
    env.DB.prepare('DELETE FROM teacher_classes WHERE class_id = ?1').bind(id),
    env.DB.prepare('DELETE FROM class_owners WHERE class_id = ?1').bind(id),
    env.DB.prepare('DELETE FROM classes WHERE id = ?1').bind(id),
  ]);
  return json({ ok: true });
}

// ---------- pupils ----------

export function cleanName(s) {
  return String(s ?? '').split('\t')[0].replace(/^\s*\d+[.)]\s+/, '').replace(/\s+/g, ' ').trim().slice(0, 40);
}

async function existingNames(env, classId) {
  return new Set(((await env.DB.prepare('SELECT name FROM pupils WHERE class_id = ?1').bind(classId).all()).results || []).map((r) => r.name.toLowerCase()));
}

async function listPupils(env, classId) {
  const rows = (await env.DB.prepare('SELECT id, name FROM pupils WHERE class_id = ?1 ORDER BY name COLLATE NOCASE').bind(classId).all()).results || [];
  return json({ pupils: rows });
}

// Pasted lines in, proposed pupils out. Nothing is saved until the teacher confirms.
async function previewPupils(request, env, classId) {
  const body = await readJson(request);
  const lines = String(body.text ?? '').split(/\r?\n/).map(cleanName).filter(Boolean).slice(0, 200);
  const taken = await existingNames(env, classId);
  const rows = lines.map((name) => {
    const key = name.toLowerCase();
    const status = taken.has(key) ? 'duplicate' : 'ok';
    taken.add(key);
    return { name, status };
  });
  return json({ rows });
}

async function addPupils(request, env, classId) {
  const body = await readJson(request);
  const list = (Array.isArray(body.names) ? body.names : []).slice(0, 200).map(cleanName).filter(Boolean);
  const taken = await existingNames(env, classId);
  const room = MAX_PUPILS_PER_CLASS - taken.size;
  const stmts = [], skipped = [];
  for (const name of list) {
    const key = name.toLowerCase();
    if (taken.has(key)) { skipped.push({ name, reason: 'already in this class' }); continue; }
    if (stmts.length >= room) { skipped.push({ name, reason: `a class can have ${MAX_PUPILS_PER_CLASS} pupils` }); continue; }
    taken.add(key);
    stmts.push(env.DB.prepare('INSERT INTO pupils (class_id, name, created_at) VALUES (?1, ?2, ?3)').bind(classId, name, Date.now()));
  }
  if (stmts.length) await env.DB.batch(stmts);
  return json({ added: stmts.length, skipped });
}

async function deletePupil(env, id) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM answers WHERE pupil_id = ?1').bind(id),
    env.DB.prepare('DELETE FROM rounds WHERE pupil_id = ?1').bind(id),
    env.DB.prepare('DELETE FROM progress WHERE pupil_id = ?1').bind(id),
    env.DB.prepare('DELETE FROM pupils WHERE id = ?1').bind(id),
  ]);
  return json({ ok: true });
}

// ---------- the table: pupil by level, stars, last played, the rule they miss most ----------

async function classTable(env, classId) {
  const [pupils, best, last, miss] = await Promise.all([
    env.DB.prepare('SELECT id, name FROM pupils WHERE class_id = ?1 ORDER BY name COLLATE NOCASE').bind(classId).all(),
    env.DB.prepare("SELECT pupil_id, level, MAX(stars) AS stars FROM rounds WHERE class_id = ?1 AND mode = 'level' GROUP BY pupil_id, level").bind(classId).all(),
    env.DB.prepare('SELECT pupil_id, MAX(ts) AS last, COUNT(*) AS rounds FROM rounds WHERE class_id = ?1 GROUP BY pupil_id').bind(classId).all(),
    env.DB.prepare('SELECT pupil_id, level, SUM(1 - first_ok) AS misses FROM answers WHERE class_id = ?1 GROUP BY pupil_id, level').bind(classId).all(),
  ]);
  const by = (rows) => { const m = new Map(); for (const r of rows.results || []) { const a = m.get(r.pupil_id) || []; a.push(r); m.set(r.pupil_id, a); } return m; };
  const bestBy = by(best), lastBy = new Map((last.results || []).map((r) => [r.pupil_id, r])), missBy = by(miss);
  const rows = (pupils.results || []).map((p) => {
    const levels = {};
    for (const r of bestBy.get(p.id) || []) levels[r.level] = r.stars;
    let top = null;
    for (const r of missBy.get(p.id) || []) if (r.misses >= MISS_MIN && (!top || r.misses > top.misses || (r.misses === top.misses && r.level < top.level))) top = r;
    const l = lastBy.get(p.id);
    return {
      id: p.id, name: p.name, levels, lastPlayed: l ? l.last : null, rounds: l ? l.rounds : 0,
      missesMost: top ? { level: top.level, name: RULES[top.level].name, rule: RULES[top.level].rule, misses: top.misses } : null,
    };
  });
  return json({ rules: RULES, rows });
}

// ---------- routing ----------

export async function teacherRoute(request, env, url, who = ADMIN) {
  const m = request.method;
  const path = url.pathname.replace(/^\/api\/t/, '');
  let x;
  const pupilClass = async (id) => {
    const p = await env.DB.prepare('SELECT class_id FROM pupils WHERE id = ?1').bind(id).first();
    if (!p) throw new HttpError(404, 'No such pupil.');
    needClass(who, p.class_id);
  };
  if (path === '/ping') return json({ ok: true });
  if (path === '/me' && m === 'GET') return whoAmI(env, who);
  if (path === '/me/password' && m === 'POST') return changeOwnPassword(request, env, who);

  if (path === '/teachers') {
    needAdmin(who);
    return m === 'GET' ? listTeachers(env) : m === 'POST' ? createTeacher(request, env) : null;
  }
  if ((x = path.match(/^\/teachers\/(\d+)$/))) {
    needAdmin(who);
    if (m === 'PATCH') return updateTeacher(request, env, +x[1]);
    if (m === 'DELETE') return deleteTeacher(env, +x[1]);
  }
  if ((x = path.match(/^\/teachers\/(\d+)\/reset-password$/)) && m === 'POST') {
    needAdmin(who);
    return resetTeacherPassword(env, +x[1]);
  }

  if (path === '/classes') return m === 'GET' ? listClasses(env, who) : m === 'POST' ? createClass(request, env, who) : null;
  if ((x = path.match(/^\/classes\/(\d+)$/))) {
    if (m === 'PATCH') { needClass(who, +x[1]); return updateClass(request, env, +x[1]); }
    if (m === 'DELETE') { needClass(who, +x[1]); await needOwner(env, who, +x[1]); return deleteClass(env, +x[1]); }
  }
  if ((x = path.match(/^\/classes\/(\d+)\/regen$/)) && m === 'POST') { needClass(who, +x[1]); return regenCode(request, env, +x[1]); }
  if ((x = path.match(/^\/classes\/(\d+)\/pupils$/))) {
    needClass(who, +x[1]);
    if (m === 'GET') return listPupils(env, +x[1]);
    if (m === 'POST') return addPupils(request, env, +x[1]);
  }
  if ((x = path.match(/^\/classes\/(\d+)\/pupils\/preview$/)) && m === 'POST') { needClass(who, +x[1]); return previewPupils(request, env, +x[1]); }
  if ((x = path.match(/^\/classes\/(\d+)\/table$/)) && m === 'GET') { needClass(who, +x[1]); return classTable(env, +x[1]); }
  if ((x = path.match(/^\/pupils\/(\d+)$/)) && m === 'DELETE') { await pupilClass(+x[1]); return deletePupil(env, +x[1]); }
  return null;
}
