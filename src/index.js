// Dialogue Dash Junior: Cloudflare Worker entry. The game and teacher pages come from /public; only /api runs here.

import { HttpError, json } from './util.js';
import { verifyToken, teacherConfigured } from './auth.js';
import * as pupil from './pupil.js';
import { teacherLogin, teacherRoute } from './classes.js';
import { loadWho } from './accounts.js';
import { VERSION } from './version.js';

const bearer = (request) => {
  const h = request.headers.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
};

async function route(request, env, url) {
  const path = url.pathname;
  const m = request.method;

  if (path === '/api/meta' && m === 'GET') return json({ version: VERSION });
  if (!env.DB) throw new HttpError(500, 'The database is not connected. Check the D1 binding.');
  if (!teacherConfigured(env)) throw new HttpError(503, 'This app is not set up yet. Ask your teacher.');

  if (path === '/api/class' && m === 'POST') return pupil.lookup(request, env);
  if (path === '/api/login' && m === 'POST') return pupil.login(request, env);
  if (path === '/api/teacher/login' && m === 'POST') return teacherLogin(request, env);

  if (path === '/api/t' || path.startsWith('/api/t/')) {
    const who = await loadWho(env, await verifyToken(env, bearer(request)));
    if (!who) throw new HttpError(401, 'Please sign in again.');
    const res = await teacherRoute(request, env, url, who);
    if (res) return res;
    throw new HttpError(404, 'Not found.');
  }

  const p = await pupil.authPupil(env, await verifyToken(env, bearer(request)));
  if (!p) throw new HttpError(401, 'Please sign in again.');
  if (path === '/api/progress' && m === 'GET') return pupil.getProgress(env, p);
  if (path === '/api/progress' && m === 'PUT') return pupil.putProgress(request, env, p);
  if (path === '/api/round' && m === 'POST') return pupil.postRound(request, env, p);
  throw new HttpError(404, 'Not found.');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return await route(request, env, url);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, ...(e.extra || {}) }, e.status);
      console.error('API error', e?.stack || e);
      return json({ error: 'Something went wrong on the server. Please try again.' }, 500);
    }
  },
};
