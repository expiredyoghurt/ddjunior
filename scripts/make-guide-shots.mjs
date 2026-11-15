// Takes the screenshots used in the two guides, from the real game and the real teacher console.
// The Worker runs in-process on an in-memory SQLite database, so every screen shows real behaviour. Usage: NODE_PATH=... node scripts/make-guide-shots.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../src/index.js';
import { makeEnv, call, adminToken, makeTeacher, makeClass, pupilLogin } from '../test/helpers/d1.mjs';
import { serve } from './serve.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'shots');
mkdirSync(OUT, { recursive: true });

/* ---- a believable class ---- */
const { db, env } = makeEnv();
const admin = await adminToken(env);
const tan = await makeTeacher(env, admin, 'mrs.tan', 'Mrs Tan');
const NAMES = ['Aisha', 'Arun', 'Chloe', 'Mei T.', 'Mei L.', 'Raj', 'Siti', 'Wei Jie', 'Zara'];
const cls = await makeClass(env, tan.token, 'P2 Kindness', NAMES);
await makeClass(env, tan.token, 'P2 Courage', ['Ben', 'Hana']);
const ids = (l) => Array.from({ length: 10 }, (_, i) => `L${l}-${String(i + 1).padStart(2, '0')}`);
let n = 0;
async function play(name, level, stars, missRule = 0, mode = 'level') {
  const p = await pupilLogin(env, cls.code, name);
  const pool = ids(level);
  const results = pool.slice(0, 5).map((id, i) => ({ id, level, first: !(i < missRule), revealed: false }));
  const r = await call(env, 'POST', '/api/round', { token: p.token, body: { rid: `guide-${++n}-0000`, mode, level: mode === 'level' ? level : 0, stars, results } });
  if (r.status !== 200) throw new Error(JSON.stringify(r.body));
}
const plan = {
  Aisha: [[1, 3], [2, 3], [3, 2, 2], [4, 3], [5, 2]], Arun: [[1, 3], [2, 2, 3], [3, 1, 3]], Chloe: [[1, 3], [2, 3], [3, 3], [4, 2, 2], [5, 1], [6, 2]],
  'Mei T.': [[1, 2]], 'Mei L.': [[1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3]], Raj: [[1, 2], [2, 1, 4]], Siti: [[1, 3], [2, 2], [3, 3]], 'Wei Jie': [[1, 3], [2, 3], [3, 2, 2], [4, 2, 3]]
};
for (const [name, rounds] of Object.entries(plan)) for (const [l, s, m] of rounds) await play(name, l, s, m || 0);
// Some pupils played days ago; Zara has not started.
const day = 86400000, now = Date.now(), ts = { Arun: 1, Siti: 3, Raj: 9, 'Mei T.': 0 };
for (const [name, d] of Object.entries(ts)) { const pid = db.prepare('SELECT id FROM pupils WHERE name = ?').get(name).id; db.prepare('UPDATE rounds SET ts = ? WHERE pupil_id = ?').run(now - d * day, pid); }

/* ---- the browser: every /api request goes to the Worker ---- */
const server = await serve(0), url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
async function open(vp, { progress = null, route = true } = {}) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, locale: 'en-GB', reducedMotion: 'reduce', colorScheme: 'light' });
  if (progress) await ctx.addInitScript((p) => { if (!localStorage.getItem('ddj.progress')) localStorage.setItem('ddj.progress', JSON.stringify(p)); }, progress);
  await ctx.addInitScript(() => {
    window.confirm = () => true;
    // Pretend the tablet has a British voice, so the read-aloud button shows in the pictures. Nothing is spoken.
    try { Object.defineProperty(window, 'speechSynthesis', { value: { getVoices: () => [{ lang: 'en-GB', name: 'Guide voice', default: true, localService: true }], speak() {}, cancel() {}, addEventListener() {}, removeEventListener() {}, onvoiceschanged: null, speaking: false }, configurable: true }); } catch (e) { /* ignore */ }
  });
  if (route) await ctx.route('**/api/**', async (r) => {
    const q = r.request(), u = new URL(q.url());
    const res = await worker.fetch(new Request('http://localhost' + u.pathname + u.search, { method: q.method(), headers: q.headers(), body: q.postData() || undefined }), env);
    await r.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) });
  });
  const page = await ctx.newPage();
  await page.goto(url + '/index.html?seed=11'); await page.evaluate(() => document.fonts.ready);
  return { page, ctx };
}
/* Numbered blue badges on the things the guide talks about. */
async function badge(page, list) {
  const boxes = [];
  for (const [sel, num, where] of list) {
    const loc = page.locator(sel).first();
    const r = await loc.boundingBox(); if (!r) throw new Error('no box for ' + sel);
    boxes.push([r, num, where]);
  }
  await page.evaluate((boxes) => {
    document.querySelectorAll('.guide-badge').forEach((e) => e.remove());
    boxes.forEach(([r, num, where]) => {
      const o = document.createElement('div'); o.className = 'guide-badge';
      o.style.cssText = `position:fixed;left:${r.x - 4}px;top:${r.y - 4}px;width:${r.width + 8}px;height:${r.height + 8}px;border:4px solid #1D6FD8;border-radius:16px;pointer-events:none;z-index:9998;`;
      const b = document.createElement('div'); b.className = 'guide-badge'; b.textContent = num;
      const bx = where === 'right' ? r.x + r.width - 18 : r.x - 18, by = r.y - 18;
      b.style.cssText = `position:fixed;left:${Math.max(2, bx)}px;top:${Math.max(2, by)}px;width:36px;height:36px;border-radius:50%;background:#1D6FD8;color:#fff;font:700 22px/36px sans-serif;text-align:center;z-index:9999;pointer-events:none;box-shadow:0 2px 0 rgba(0,0,0,.25)`;
      document.body.append(o, b);
    });
  }, boxes);
}
const shot = async (page, name) => { await page.waitForTimeout(150); await page.screenshot({ path: join(OUT, name + '.png') }); };
const hideBadges = (page) => page.evaluate(() => document.querySelectorAll('.guide-badge').forEach((e) => e.remove()));

const TAB = { width: 640, height: 900 };
const DONE = Object.fromEntries([1, 2, 3, 4, 5, 6].map((l) => [l, { done: true, stars: l % 2 ? 3 : 2 }]));
const PROG = { v: 1, friend: 'duck', mute: false, levels: DONE, stickers: { 0: 1, 3: 2, 7: 1, 12: 1, 19: 1 }, missed: {}, seen: { words: true, gap: true, pick: true, build: true, write: true }, rounds: 6 };

/* ================= pupil ================= */
{
  let { page, ctx } = await open(TAB);
  await shot(page, 'p01-welcome');
  await page.getByRole('button', { name: 'My class' }).click();
  await page.waitForSelector('.code-input');
  await badge(page, [['.code-input', 1, 'left']]); await shot(page, 'p02-code');
  await hideBadges(page);
  await page.fill('.code-input', cls.code);
  await page.click('button[type="submit"]'); await page.waitForSelector('.btn.name');
  await badge(page, [['.btn.name >> nth=3', 1, 'left']]); await shot(page, 'p03-names');
  await hideBadges(page);
  await page.locator('.btn.name').nth(3).click(); await page.waitForSelector('[data-level="1"]');
  await badge(page, [['.chip', 1, 'left'], ['[data-level="1"]', 2, 'left']]); await shot(page, 'p04-home-new');
  await hideBadges(page);
  await page.click('[data-level="1"]'); await shot(page, 'p05-learn');
  await page.click('button.primary'); await page.waitForSelector('.round, [data-screen="round"]');
  await badge(page, [['.itext', 1, 'right'], ['.tile >> nth=0', 2, 'left'], ['#primary', 3, 'left'], ['[data-speak]', 4, 'right']]); await shot(page, 'p06-activity-words');
  await hideBadges(page);
  await ctx.close();
}
{
  const { page, ctx } = await open(TAB, { progress: PROG, route: false });
  await page.click('button.primary');
  await badge(page, [['[data-level="6"]', 1, 'left'], ['[data-level="7"]', 2, 'left'], ['button:has-text("Practise")', 3, 'left'], ['button:has-text("Write it")', 4, 'left'], ['button:has-text("Sticker book")', 5, 'left']]);
  await shot(page, 'p07-home-played'); await hideBadges(page);
  const ANSWER = (right) => {
    const D = window.DDJ, { model: m, attempts } = D.app.current(), q = (s) => document.querySelector(s);
    if (attempts > 0) { let e, k = 0; while ((e = document.querySelector('.tile.on, .slot.on, .line .tile')) && k++ < 30) e.click(); }
    if (m.kind === 'pick') { q(`.choice[data-mark="${right ? m.answer : m.options.find((o) => o !== m.answer)}"]`).click(); return; }
    if (m.kind === 'words') (right ? m.answer : [m.tokens.findIndex((_, i) => !m.answer.includes(i))]).forEach((i) => q(`.tile[data-i="${i}"]`).click());
    else if (m.kind === 'build') (right ? m.answer : m.answer.slice().reverse()).forEach((t) => q(`.tray [data-token="${t}"]`).click());
    else { const lo = m.kind === 'gap-marks' ? 0 : 1, hi = m.kind === 'gap-marks' ? m.tokens.length : m.tokens.length - 1; (right ? m.answer : [lo, lo + 1].filter((i) => i <= hi && !m.answer.includes(i))).forEach((i) => q(`.slot[data-i="${i}"]`).click()); }
    q('#primary').click();
  };
  const level = async (l, name, then) => {
    await page.click(`[data-level="${l}"]`); await page.click('button.primary'); await page.waitForTimeout(100);
    await shot(page, name); if (then) await then(); await page.click('.home');
  };
  await level(2, 'p08-activity-gap');
  await level(3, 'p09-activity-pick');
  await level(4, 'p10-activity-build', async () => { await page.evaluate(ANSWER, false); await shot(page, 'p11-nearly'); await page.evaluate(ANSWER, false); await shot(page, 'p12-look'); });
  await level(5, 'p13-activity-lines');
  await page.click('[data-level="6"]'); await shot(page, 'p14-learn-6'); await page.click('button.primary'); await shot(page, 'p15-activity-split'); await page.click('.home');
  await page.click('[data-level="7"]'); await page.click('button.primary'); await shot(page, 'p16-activity-speaking'); await page.click('.home');
  await page.getByRole('button', { name: 'Write it' }).click(); await page.waitForSelector('.writebox');
  await badge(page, [['.writebox', 1, 'left'], ['.markbar', 2, 'left'], ['#primary', 3, 'left']]); await shot(page, 'p17-write-it'); await hideBadges(page);
  await page.click('#primary'); await shot(page, 'p18-write-hint');
  await page.click('.home');
  await page.click('[data-level="1"]'); await page.click('button.primary');
  for (let i = 0; i < 5; i++) { await page.evaluate(ANSWER, true); await page.click('#primary'); }
  await shot(page, 'p19-round-end');
  await page.getByRole('button', { name: /Home|Sticker/ }).first().click().catch(() => {});
  await page.goto(url + '/index.html'); await page.click('button.primary');
  await page.getByRole('button', { name: 'Sticker book' }).click(); await shot(page, 'p20-sticker-book');
  await ctx.close();
}

/* ================= teacher ================= */
const TV = { width: 1180, height: 760 };
{
  const ctx = await browser.newContext({ viewport: TV, deviceScaleFactor: 1, locale: 'en-GB', colorScheme: 'light' });
  await ctx.route('**/api/**', async (r) => {
    const q = r.request(), u = new URL(q.url());
    const res = await worker.fetch(new Request('http://localhost' + u.pathname + u.search, { method: q.method(), headers: q.headers(), body: q.postData() || undefined }), env);
    await r.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) });
  });
  const page = await ctx.newPage();
  await page.goto(url + '/teacher.html'); await page.evaluate(() => document.fonts.ready);
  await page.fill('#user', 'mrs.tan'); await page.fill('#pass', tan.password);
  await badge(page, [['#user', 1, 'left'], ['#pass', 2, 'left']]); await shot(page, 't01-signin'); await hideBadges(page);
  await page.click('button[type="submit"]'); await page.waitForSelector('.class-card');
  await badge(page, [['#newclass', 1, 'left'], ['.class-card:has-text("P2 Kindness") .code', 2, 'left'], ['.class-card:has-text("P2 Kindness") button', 3, 'left']]); await shot(page, 't02-classes'); await hideBadges(page);
  await page.locator('.class-card').filter({ hasText: 'P2 Kindness' }).getByRole('button', { name: /Open/ }).click(); await page.waitForSelector('table');
  await page.setViewportSize({ width: 1180, height: 1350 });
  await badge(page, [['button:has-text("Class code card")', 1, 'left'], ['.card:has(h2:has-text("Progress")) table', 2, 'left'], ['#paste', 3, 'left']]); await shot(page, 't03-class'); await hideBadges(page);
  // table close-up
  await page.setViewportSize({ width: 1180, height: 1500 });
  const tbl = page.locator('.tablewrap'); await tbl.scrollIntoViewIfNeeded();
  await badge(page, [['thead th:nth-child(2)', 1, 'left'], ['thead th:nth-child(9)', 2, 'left'], ['thead th:nth-child(10)', 3, 'left']]);
  const tb = await tbl.boundingBox();
  await page.screenshot({ path: join(OUT, 't04-table.png'), clip: { x: Math.max(0, tb.x - 20), y: Math.max(0, tb.y - 30), width: Math.min(TV.width - Math.max(0, tb.x - 20), tb.width + 40), height: Math.min(tb.height + 50, 520) } }); await hideBadges(page);
  await page.setViewportSize(TV);
  // paste names
  await page.fill('#paste', 'Hana\nBen\nMei T.\nKamal\nLily');
  await page.getByRole('button', { name: 'Preview' }).click(); await page.waitForSelector('.names li');
  await page.locator('#h-add').scrollIntoViewIfNeeded();
  await page.locator('section.card:has(#h-add)').screenshot({ path: join(OUT, 't05-paste.png') });
  // class code card
  await page.getByRole('button', { name: /All classes/ }).click(); await page.waitForSelector('.class-card');
  await page.locator('.class-card').filter({ hasText: 'P2 Kindness' }).getByRole('button', { name: /Open/ }).click(); await page.waitForSelector('table');
  await page.getByRole('button', { name: 'Class code card' }).click(); await page.waitForSelector('.print-card');
  await page.evaluate(() => { document.querySelector('.print-card .url').textContent = 'your-school-game-address'; });
  await shot(page, 't06-card');
  // password
  await page.getByRole('button', { name: 'Password', exact: true }).click(); await page.waitForSelector('#cur');
  await shot(page, 't07-password');
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 1, locale: 'en-GB', colorScheme: 'light' });
  await ctx.route('**/api/**', async (r) => {
    const q = r.request(), u = new URL(q.url());
    const res = await worker.fetch(new Request('http://localhost' + u.pathname + u.search, { method: q.method(), headers: q.headers(), body: q.postData() || undefined }), env);
    await r.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) });
  });
  const page = await ctx.newPage();
  await page.goto(url + '/teacher.html'); await page.evaluate(() => document.fonts.ready);
  await page.fill('#user', 'admin'); await page.fill('#pass', 'admin-pass-123'); await page.click('button[type="submit"]');
  await page.waitForSelector('.class-card');
  await page.getByRole('button', { name: 'Teachers' }).click(); await page.waitForSelector('#tname');
  await page.fill('#tname', 'Mr Lim'); await page.fill('#tuser', 'mr.lim'); await page.click('form.card button[type="submit"]'); await page.waitForSelector('.secret');
  await badge(page, [['.secret', 1, 'left'], ['#tname', 2, 'left']]);
  await shot(page, 't08-admin-teachers'); await ctx.close();
}
await browser.close(); server.close();
console.log('Shots written to', OUT, 'class code', cls.code);
