# Changelog

## 0.3.0 - 2026-11-15

Three additions from the 0.3.0 stretch list. Nothing from 0.2.0 changed for a class that is already running, and there is no new database migration.

- **Level 6, Split speech.** The speaker comes in the middle: “I am,” said Mia, “so hungry.” Build it with word tiles. Each spoken part has its own speech marks, and the second part starts small.
- **Level 7, Speaking words.** whispered, called, replied and cried join said, asked and shouted. Half of the items ask the child to tap the speaking word; the rest are Build it.
- **Write it.** A new button on Home (it appears once Level 4 is done). The child gets a plain sentence with no marks and puts them in, using six big mark buttons or the keyboard. Straight quote marks are accepted. The checker is gentle: it gives one short hint at a time (“Add speech marks.”, “Add a capital.”, “Add a comma.”), and after a second miss it shows the answer and brings the item back once, like every other activity. Write it gives a sticker but no stars.
- 70 items: Levels 6 and 7 add 20. Home has seven stones.
- Teacher table: Levels 6 and 7 columns, and two new rules for “misses most”. First-try misses in Write it count towards the rule they belong to; Write it rounds count for “last played” but not for stars.
- Content check now covers split speech and the new speaker words, proves that every Build it item has exactly one right order (which caught four ambiguous Level 6 items before release), and checks that Write it hints are 4 words or fewer.

## 0.2.0 - 2026-11-15

Classes. The game still works alone for "Just try it"; a class adds saved progress and a teacher table.

- Pupil sign-in with no typing for children: a grown-up enters the class code once on the device, then each child taps their name tile. No passwords, no usernames.
- Progress is saved to the server and merged with what is on the device, so nothing is lost on bad wifi. Rounds that could not be sent wait on the device and are sent later, once.
- Cloudflare Worker and D1 database (`src/`, `migrations/`, `wrangler.jsonc`).
- Teacher console at `/teacher.html`: each teacher has their own login and several classes; the admin makes teacher accounts. Teachers create a class, paste a list of names, print a class code card, and see one table per class: pupil by level, stars, last played and the rule they miss most.
- Service worker never touches `/api/` or the teacher console, and falls back to its saved copy only when the network is slow.
- Tests: Worker and database tests run the real server code against SQLite, UI tests run the game against that Worker in-process, and the visual suite covers the new screens.

## 0.1.0 - 2026-11-14

First release. Plays alone in the browser, no server.

- Five levels, ten items each (50 in all), one rule per level: who is talking, speech marks, little marks, build it, new line.
- Four tap-only activities: Tap the words, Tap the gap, Pick one, Build it.
- Learn card for each level, "Watch first" demo the first time an activity appears, read-aloud button on every screen (hidden when the device has no British English voice).
- Rounds of five items, one to three stars, a sticker every round, twenty stickers drawn in code.
- Practise round that favours items missed before and shows no score.
- Four animal friends drawn in code. Light theme only. Andika font, self-hosted, with its licence.
- Progress kept in localStorage under one key. Reset is behind a three-second hold.
- Offline service worker, web app manifest, home screen icon.
- Tests: content check (50 items, independent rules), jsdom UI tests, Playwright visual suite with 56 px touch target audit.
