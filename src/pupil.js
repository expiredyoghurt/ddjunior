// What a child's device talks to: find the class by its code, tap a name, save progress, report a round.
// Pupils have no passwords. The class code is the only secret, and a teacher can change it at any time.

import { signToken, cleanCode } from './auth.js';
import { HttpError, json, readJson, clientIp, rateLimited, clip, int } from './util.js';
import { merge, sanitize } from './progress.js';

const NO_CLASS = 'We couldn’t find that class code.';

async function classByCode(env, code) {
  const c = cleanCode(code);
  if (c.length < 4) throw new HttpError(404, NO_CLASS);
  const cls = await env.DB.prepare('SELECT id, name, sess_ver FROM classes WHERE code = ?1 AND archived = 0').bind(c).first();
  if (!cls) throw new HttpError(404, NO_CLASS);
  return cls;
}

// The name tiles for a class. Names only: no ids beyond what is needed to sign in, nothing about progress.
export async function lookup(request, env) {
  if (await rateLimited(env, 'RL_LOGIN', clientIp(request))) throw new HttpError(429, 'Too many tries. Wait a minute and try again.');
  const body = await readJson(request);
  const cls = await classByCode(env, body.code);
  const rows = (await env.DB.prepare('SELECT id, name FROM pupils WHERE class_id = ?1 ORDER BY name COLLATE NOCASE').bind(cls.id).all()).results || [];
  return json({ className: cls.name, pupils: rows });
}

export async function login(request, env) {
  if (await rateLimited(env, 'RL_LOGIN', clientIp(request))) throw new HttpError(429, 'Too many tries. Wait a minute and try again.');
  const body = await readJson(request);
  const cls = await classByCode(env, body.code);
  const p = await env.DB.prepare('SELECT id, name FROM pupils WHERE id = ?1 AND class_id = ?2').bind(int(body.pupilId, 0), cls.id).first();
  if (!p) throw new HttpError(404, 'We couldn’t find that name.');
  await env.DB.prepare('UPDATE pupils SET last_seen = ?1 WHERE id = ?2').bind(Date.now(), p.id).run();
  const token = await signToken(env, { r: 'p', pid: p.id, cid: cls.id, sv: cls.sess_ver }, 12 * 3600);
  return json({ token, pupil: { id: p.id, name: p.name, className: cls.name } });
}

// Loads and checks the pupil behind a token.
export async function authPupil(env, payload) {
  if (!payload || payload.r !== 'p') return null;
  const row = await env.DB
    .prepare('SELECT p.id, p.name, p.class_id, c.sess_ver, c.archived FROM pupils p JOIN classes c ON c.id = p.class_id WHERE p.id = ?1')
    .bind(payload.pid)
    .first();
  if (!row || row.archived || row.sess_ver !== payload.sv) return null;
  return { id: row.id, name: row.name, classId: row.class_id };
}

export async function getProgress(env, p) {
  const row = await env.DB.prepare('SELECT data FROM progress WHERE pupil_id = ?1').bind(p.id).first();
  let data = null;
  try { data = row ? JSON.parse(row.data) : null; } catch { data = null; }
  return json({ progress: sanitize(data) });
}

export async function putProgress(request, env, p) {
  const body = await readJson(request);
  const row = await env.DB.prepare('SELECT data FROM progress WHERE pupil_id = ?1').bind(p.id).first();
  let old = null;
  try { old = row ? JSON.parse(row.data) : null; } catch { old = null; }
  const merged = merge(old, body.progress);
  await env.DB
    .prepare('INSERT INTO progress (pupil_id, data, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(pupil_id) DO UPDATE SET data = ?2, updated_at = ?3')
    .bind(p.id, JSON.stringify(merged), Date.now())
    .run();
  return json({ progress: merged });
}

// One finished round. The device makes the rid, so sending it twice (bad wifi, a retry) counts once.
export async function postRound(request, env, p) {
  const b = await readJson(request);
  const rid = clip(b.rid, 64);
  if (!/^[A-Za-z0-9-]{8,64}$/.test(rid)) throw new HttpError(400, 'Bad round.');
  const mode = b.mode === 'practise' || b.mode === 'write' ? b.mode : 'level';
  const level = mode === 'level' ? Math.max(1, Math.min(7, int(b.level, 1))) : 0;
  const stars = mode === 'level' ? Math.max(1, Math.min(3, int(b.stars, 1))) : 0;
  const results = (Array.isArray(b.results) ? b.results : []).slice(0, 12)
    .map((r) => ({ id: clip(r && r.id, 12), level: int(r && r.level, 0), first: !!(r && r.first), revealed: !!(r && r.revealed) }))
    .filter((r) => /^L[1-7]-\d{2}$/.test(r.id) && r.level >= 1 && r.level <= 7);
  const now = Date.now();
  const first = results.filter((r) => r.first).length;
  const made = await env.DB
    .prepare('INSERT OR IGNORE INTO rounds (rid, pupil_id, class_id, mode, level, stars, first_right, items, ts) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) RETURNING id')
    .bind(rid, p.id, p.classId, mode, level, stars, first, results.length, now)
    .first();
  if (made) {
    const stmts = results.map((r) =>
      env.DB.prepare('INSERT INTO answers (rid, pupil_id, class_id, item_id, level, first_ok, revealed, ts) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)')
        .bind(rid, p.id, p.classId, r.id, r.level, r.first ? 1 : 0, r.revealed ? 1 : 0, now));
    if (stmts.length) await env.DB.batch(stmts);
  }
  return json({ ok: true, counted: !!made });
}
