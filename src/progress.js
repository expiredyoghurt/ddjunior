// Saved progress: what a pupil has done, merged so that nothing is ever lost when two devices or a bad connection
// are involved. The same rules run in public/js/net.js on the device (test/server/progress.test.mjs checks they agree).

export const LEVELS = [1, 2, 3, 4, 5, 6, 7];
export const STICKER_COUNT = 20;
const ACTIVITIES = ['words', 'gap', 'pick', 'build', 'write'];
const FRIENDS = ['duck', 'bunny', 'frog', 'cat'];
const ITEM_ID = /^L[1-7]-\d{2}$/;
const cap = (n, max) => Math.max(0, Math.min(max, Number.isFinite(+n) ? Math.floor(+n) : 0));

export function fresh() {
  return { v: 1, friend: 'duck', levels: {}, stickers: {}, missed: {}, seen: {}, rounds: 0 };
}

// Keeps only what the game itself can make, and clamps it. Anything else (and the mute setting, which stays on the device) is dropped.
export function sanitize(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const out = fresh();
  out.friend = FRIENDS.includes(d.friend) ? d.friend : 'duck';
  for (const l of LEVELS) {
    const v = d.levels && d.levels[l];
    if (v && v.done) out.levels[l] = { done: true, stars: Math.max(1, cap(v.stars, 3)) };
  }
  for (let i = 0; i < STICKER_COUNT; i++) {
    const n = cap(d.stickers && d.stickers[i], 999);
    if (n) out.stickers[i] = n;
  }
  for (const [k, n] of Object.entries((d.missed && typeof d.missed === 'object') ? d.missed : {})) {
    if (ITEM_ID.test(k) && cap(n, 999)) out.missed[k] = cap(n, 999);
  }
  for (const a of ACTIVITIES) if (d.seen && d.seen[a]) out.seen[a] = true;
  out.rounds = cap(d.rounds, 99999);
  return out;
}

// merge(old, incoming): done is kept once earned, stars and counts only go up, the friend follows the newer copy.
export function merge(a, b) {
  const x = sanitize(a), y = sanitize(b), out = fresh();
  out.friend = b && b.friend ? y.friend : x.friend;
  for (const l of LEVELS) {
    const p = x.levels[l], q = y.levels[l];
    if (p || q) out.levels[l] = { done: true, stars: Math.max(p ? p.stars : 0, q ? q.stars : 0) };
  }
  for (const k of new Set([...Object.keys(x.stickers), ...Object.keys(y.stickers)])) out.stickers[k] = Math.max(x.stickers[k] || 0, y.stickers[k] || 0);
  for (const k of new Set([...Object.keys(x.missed), ...Object.keys(y.missed)])) out.missed[k] = Math.max(x.missed[k] || 0, y.missed[k] || 0);
  for (const a of ACTIVITIES) if (x.seen[a] || y.seen[a]) out.seen[a] = true;
  out.rounds = Math.max(x.rounds, y.rounds);
  return out;
}
