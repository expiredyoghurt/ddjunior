# Dialogue Dash Junior 0.3.0

Tap-only dialogue practice for Primary 2. "Just try it" plays alone in the browser with no network calls. With a ## Play it

- Quick look, no server: open `public/index.html` or run `npm run serve`. "My class" needs the Worker (below).
- Add `?seed=7` to the address to make the shuffles repeatable (used by the tests).

## Put it online (classes)

Needs a Cloudflare account. From this folder:

```
npx wrangler d1 create dialogue-dash-junior          # paste the database_id into wrangler.jsonc
npx wrangler d1 migrations apply dialogue-dash-junior --remote
npx wrangler secret put teacher_user                 # the admin sign-in
npx wrangler secret put teacher_password             # use a long one
npx wrangler secret put session_secret               # optional: any long random text
npx wrangler deploy
```

- Teachers sign in at `/teacher.html`. The admin (the two secrets) makes teacher accounts there; each teacher sees only their own classes.
- A teacher makes a class, pastes the names, prints the class code card. On each tablet a grown-up types the code once; children then tap their name.
- Pupils have no passwords. Anyone with a class code can see that class's first names, so treat the card like a key to the room.

 (no build step). `_headers` is included.
- Add `?seed=7` to the address to make the shuffles repeatable (used by the tests).

## Upgrading from 0.2.0

Run `npx wrangler deploy`. There is no new migration and nothing to change in the database: Levels 6 and 7 and Write it use the tables 0.2.0 made. Pupils keep their progress; Levels 6 and 7 simply unlock after Level 5.

## Change the questions

Edit `content/items.json` (one correct sentence per item; Level 7 items also say `"activity": "words"` or `"build"`), then:

```
npm run build:items     # writes public/js/items-data.js
npm run check:content   # must pass before you ship
```

## Tests

```
npm install
npm run check:content   # 70 items, independent rules check, one right answer per Build it, Write it hints
npm run test:server     # Worker + real SQLite: accounts, ownership, merging, repeats
npm run test:ui         # jsdom: seven levels, Write it, class sign-in, offline, teacher console, a11y
npm run test:visual     # Playwright: 6 sizes, baselines, 56 px targets, reduced motion
```

The visual baselines were drawn on Linux with Chromium. On another machine the text may render slightly differently,
so run `npm run test:visual:update` once there to make your own baselines. You need `npx playwright install chromium` first.

## Release checklist

1. Add the CHANGELOG.md entry first.
2. Make the version the same in `package.json`, `public/sw.js` (`VERSION`), `src/version.js` and the top of `CHANGELOG.md`. A test checks this.
3. `npm test`, then zip without `node_modules`.

## Licences

Andika font: SIL Open Font Licence, in `public/fonts/OFL.txt`.
