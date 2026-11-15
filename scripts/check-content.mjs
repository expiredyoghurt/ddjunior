// Content check. The "independent checker" below applies the five rules straight from the sentence text
// (regex only, no shared code with engine.js) and must agree with what engine.js derives.
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const engine = require(join(root, 'public/js/engine.js'));
const items = JSON.parse(readFileSync(join(root, 'content/items.json'), 'utf8'));

const errors = [];
const bad = (id, msg) => errors.push(`${id}: ${msg}`);

const OLD_VERBS = ['said', 'asked', 'shouted'];
const NEW_VERBS = ['whispered', 'called', 'replied', 'cried'];
const ALL = OLD_VERBS.concat(NEW_VERBS).join('|');
const QUESTION_WORDS = ['Where', 'What', 'Can', 'Do'];
const COMMANDS = ['Wow', 'Stop', 'Run', 'Look', 'Come', 'Watch', 'Help', 'Wait', 'Hurry'];
const US_SPELLINGS = ['color', 'mom', 'center', 'favorite', 'neighbor', 'realize', 'organize', 'recognize', 'gray', 'theater', 'defense'];
const wc = (s) => s.split(' ').length;

// ---- independent rules, written from the handoff, not from engine.js ----
const SPEAKER_LAST = new RegExp(`^“([A-Z][^”]*?)([,.!?])” (${ALL}) ([A-Z][a-z]+)\\.$`);
const SPEAKER_FIRST = new RegExp(`^([A-Z][a-z]+) (${ALL}), “([A-Z][^”]*?)([.!?])”$`);
// Split speech: the first part ends with a comma, the second part starts small and ends the sentence.
const SPLIT = new RegExp(`^“([A-Z][^”]*?),” (${ALL}) ([A-Z][a-z]+), “([a-z][^”]*?)([.!?])”$`);

function parse(sentence) {
  let m = SPLIT.exec(sentence);
  if (m) return { order: 'split', quote: m[1], mark: m[5], verb: m[2], name: m[3] };
  m = SPEAKER_LAST.exec(sentence);
  if (m) return { order: 'last', quote: m[1], mark: m[2], verb: m[3], name: m[4] };
  m = SPEAKER_FIRST.exec(sentence);
  if (m) return { order: 'first', quote: m[3], mark: m[4], verb: m[2], name: m[1] };
  return null;
}

function markOk(p) {
  if (p.verb === 'asked') return p.mark === '?';
  if (p.verb === 'shouted') return p.mark === '!';
  return p.mark !== '?';
}

function ruleMark(p) { // Level 3 rule, from the quote alone
  const first = p.quote.split(' ')[0].replace(/[^A-Za-z]/g, '');
  if (QUESTION_WORDS.includes(first)) return '?';
  if (COMMANDS.includes(first)) return '!';
  return ',';
}

function validArrangement(str) {
  return SPEAKER_LAST.test(str) || SPEAKER_FIRST.test(str) || SPLIT.test(str);
}

function* perms(a) {
  if (a.length <= 1) { yield a; return; }
  for (let i = 0; i < a.length; i++) {
    const rest = a.slice(0, i).concat(a.slice(i + 1));
    for (const p of perms(rest)) yield [a[i], ...p];
  }
}

function speakerOfLine(line) {
  const p = parse(line);
  return p ? p.name : null;
}

// ---- checks ----
const seen = new Map();
const perLevel = {};
for (const it of items) {
  perLevel[it.level] = (perLevel[it.level] || 0) + 1;
  const sentences = it.lines || [it.sentence];
  for (const s of sentences) {
    if (!s) { bad(it.id, 'missing sentence'); continue; }
    if (wc(s) > 8) bad(it.id, `more than 8 words: ${s}`);
    if (/["']/.test(s)) bad(it.id, `straight quote mark: ${s}`);
    if (/[“”]/.test(s.replace(/[“”]/g, '')) ) bad(it.id, 'odd mark');
    const pairs = it.level === 6 ? 2 : 1;
    if ((s.match(/“/g) || []).length !== pairs || (s.match(/”/g) || []).length !== pairs) bad(it.id, `needs exactly ${pairs} pair(s) of marks: ${s}`);
    const key = s.toLowerCase();
    if (seen.has(key)) bad(it.id, `duplicate of ${seen.get(key)}: ${s}`); else seen.set(key, it.id);
    for (const w of US_SPELLINGS) if (new RegExp(`\\b${w}s?\\b`, 'i').test(s)) bad(it.id, `American spelling "${w}"`);
    if (/\b\w+ize[sd]?\b/i.test(s)) bad(it.id, 'check -ize spelling');
    const p = parse(s);
    if (!p) { bad(it.id, `does not match a speaker pattern: ${s}`); continue; }
    if (it.level < 7 && !OLD_VERBS.includes(p.verb)) bad(it.id, `speaker word ${p.verb} belongs in Level 7`);
    if (it.level === 6 && p.order !== 'split') bad(it.id, 'Level 6 needs split speech');
    if (it.level !== 6 && p.order === 'split') bad(it.id, 'only Level 6 splits speech');
    if (it.level === 7 && !NEW_VERBS.includes(p.verb)) bad(it.id, 'Level 7 needs one of the new speaker words');
    if (!markOk(p)) bad(it.id, `speaker word and mark do not fit: ${s}`);
    if (it.level === 3 && p.order !== 'last') bad(it.id, 'Level 3 needs the speaker after');
  }
  const rnd = engine.mulberry32(7);
  const m = engine.derive(it, rnd);

  if (it.level === 1) {
    const quote = /“[^”]*”/.exec(it.sentence)[0];
    const got = m.answer.map((i) => m.tokens[i]).join(' ');
    if (got !== quote) bad(it.id, `L1 answer "${got}" disagrees with "${quote}"`);
  }
  if (it.level === 2) {
    const q = it.sentence.indexOf('“'), c = it.sentence.indexOf('”');
    const before = it.sentence.slice(0, q).trim();
    const upto = it.sentence.slice(0, c + 1).replace(/[“”]/g, '').trim();
    const open = before ? before.split(' ').length : 0;
    const close = upto.split(' ').length;
    if (m.answer[0] !== open || m.answer[1] !== close) bad(it.id, `L2 gaps ${m.answer} disagree with ${open},${close}`);
  }
  if (it.level === 3) {
    const p = parse(it.sentence);
    const expect = ruleMark(p);
    const cueMark = { question: '?', exclamation: '!', statement: ',' }[it.cue];
    if (!cueMark) bad(it.id, 'cue must be question, exclamation or statement');
    if (cueMark !== p.mark) bad(it.id, `cue ${it.cue} does not match mark ${p.mark}`);
    if (expect !== p.mark) bad(it.id, `rule says ${expect}, sentence has ${p.mark}`);
    if (m.answer !== expect) bad(it.id, `engine answer ${m.answer} disagrees with rule ${expect}`);
    if (m.options.length !== 3 || new Set(m.options).size !== 3 || !m.options.includes(m.answer)) bad(it.id, 'bad options');
    if (p.mark === ',' && !m.options.includes('.')) bad(it.id, 'comma items must offer a full stop');
  }
  if (it.level === 4 || it.level === 6 || (it.level === 7 && it.activity === 'build')) {
    const tiles = it.sentence.split(' ');
    if (new Set(tiles).size !== tiles.length) bad(it.id, 'tiles are not all different');
    const p = parse(it.sentence);
    if (p && p.quote.split(' ').length > 3) bad(it.id, 'quote longer than 3 words (order would not be unique)');
    if (it.level === 6 && p && p.mark === ',') bad(it.id, 'split speech must end with . ! or ?');
    let valid = 0;
    for (const a of perms(tiles)) if (validArrangement(a.join(' '))) valid++;
    if (valid !== 1) bad(it.id, `${valid} valid orders for the tiles (need exactly 1)`);
    if (m.tray.every((v, i) => v === i)) bad(it.id, 'tray is not shuffled');
  }
  if (it.level === 7) {
    if (!['words', 'build'].includes(it.activity)) bad(it.id, 'Level 7 items need activity words or build');
    if (it.activity === 'words') {
      const p = parse(it.sentence), tok = it.sentence.split(' ');
      const idx = tok.map((w) => w.replace(/[“”,.!?]/g, '')).indexOf(p.verb);
      if (m.kind !== 'words' || m.answer.length !== 1 || m.answer[0] !== idx) bad(it.id, `L7 speaker word ${m.answer} disagrees with ${idx}`);
    }
  }
  if (it.level === 5) {
    if (it.lines.length !== 3) bad(it.id, 'needs 3 lines');
    const sp = it.lines.map(speakerOfLine);
    if (!(sp[0] !== sp[1] && sp[1] !== sp[2] && sp[0] === sp[2])) bad(it.id, `lines do not alternate: ${sp}`);
    const l1 = it.lines[0].split(' ').length, l2 = it.lines[1].split(' ').length;
    if (m.answer[0] !== l1 || m.answer[1] !== l1 + l2) bad(it.id, 'L5 line breaks disagree');
    if (m.tokens.length > 12) bad(it.id, 'chat is longer than 12 words');
  }
}
for (let l = 1; l <= 7; l++) if (perLevel[l] !== 10) errors.push(`Level ${l} has ${perLevel[l]} items, needs 10`);
if (items.length !== 70) errors.push(`Expected 70 items, found ${items.length}`);
// Level 7 mixes the two activities.
for (const a of ['words', 'build']) if (items.filter((i) => i.level === 7 && i.activity === a).length < 4) errors.push(`Level 7 needs at least 4 ${a} items`);

// ---- words children must not meet, and verbs that must stay the same ----
const NEVER = [/\bpunctuation\b/i, /\bquotation\b/i, /\bspeaker tag\b/i, /\brules?\b/i, /\bclauses?\b/i,
  /\bselect(ed|ing)?\b/i, /\bchoose\b/i, /(^|[^.\w])click(s|ed|ing)?\b/i, /\bscore\b/i, /\bred\b/i];
function scan(dir) {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, f.name);
    if (f.isDirectory()) { if (f.name !== 'fonts') scan(p); continue; }
    if (!/\.(js|html|css|webmanifest)$/.test(f.name) || f.name === 'items-data.js') continue;
    if (/^teacher\./.test(f.name)) continue; // the teacher console is for adults and says "rule" on purpose
    const text = readFileSync(p, 'utf8');
    for (const re of NEVER) {
      const m = re.exec(text);
      if (m) errors.push(`${p.replace(root + '/', '')}: contains "${m[0]}"`);
    }
  }
}
scan(join(root, 'public'));

if (errors.length) {
  console.error('CONTENT CHECK FAILED\n' + errors.map((e) => ' - ' + e).join('\n'));
  process.exit(1);
}
// ---- Write it: every one-sentence item must round-trip, and the plain version must be a real edit ----
for (const it of items) {
  if (!it.sentence) continue;
  const plain = engine.plain(it.sentence);
  if (engine.checkWrite(it.sentence, it.sentence).status !== 'ok') errors.push(`${it.id}: Write it rejects the right answer`);
  if (engine.checkWrite(it.sentence, plain).status === 'ok') errors.push(`${it.id}: Write it start already equals the answer`);
  if (/[“”,.!?]/.test(plain)) errors.push(`${it.id}: Write it start still has marks: ${plain}`);
  if (engine.checkWrite(it.sentence, it.sentence.replace(/[“”]/g, '"')).status !== 'ok') errors.push(`${it.id}: Write it should accept straight quotes`);
  // One mistake at a time gets the matching short hint (never more than 4 words).
  const hint = (t) => engine.checkWrite(it.sentence, t).hint;
  const marksOnly = it.sentence.replace(/[,.!?]/g, '');
  if (marksOnly !== it.sentence && !/^(Add a (comma|mark)\.)$/.test(hint(marksOnly))) errors.push(`${it.id}: missing end marks should say add a comma or mark, got "${hint(marksOnly)}"`);
  const noQuotes = it.sentence.replace(/[“”]/g, '');
  if (hint(noQuotes) !== 'Add speech marks.') errors.push(`${it.id}: no speech marks should say "Add speech marks.", got "${hint(noQuotes)}"`);
  const lower = it.sentence.replace(/“([A-Z])/g, (m, c) => '“' + c.toLowerCase());
  if (lower !== it.sentence && hint(lower) !== 'Add a capital.') errors.push(`${it.id}: small first letter should say "Add a capital.", got "${hint(lower)}"`);
  for (const t of [plain, marksOnly, noQuotes, lower]) { const h = hint(t); if (h && h.split(' ').length > 4) errors.push(`${it.id}: hint too long: ${h}`); }
}

console.log(`Content check passed: ${items.length} items, 7 levels, independent rules agree.`);
