// Builds docs/Teacher_Guide.pdf and docs/Pupil_Guide.pdf (and one-file HTML copies with the pictures and fonts inside).
// Run scripts/make-guide-shots.mjs first when the screens have changed. Usage: NODE_PATH=... node scripts/make-guides.mjs
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const DOCS = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const b64 = (f, type) => `data:${type};base64,` + readFileSync(join(DOCS, f)).toString('base64');
const browser = await chromium.launch();
for (const name of ['Teacher_Guide', 'Pupil_Guide']) {
  let html = readFileSync(join(DOCS, name + '.html'), 'utf8');
  let css = readFileSync(join(DOCS, 'guide.css'), 'utf8').replace(/url\('\.\.\/public\/fonts\/([^']+)'\)/g, (m, f) => `url('${b64('../public/fonts/' + f, 'font/woff2')}')`);
  html = html.replace('<link rel="stylesheet" href="guide.css">', `<style>${css}</style>`).replace(/src="(shots\/[^"]+\.png)"/g, (m, f) => `src="${b64(f, 'image/png')}"`);
  const out = join(DOCS, name + '.single.html'); writeFileSync(out, html);
  const page = await browser.newPage();
  await page.goto(pathToFileURL(out).href); await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: join(DOCS, name + '.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
  const pages = await page.evaluate(() => document.querySelectorAll('.page').length);
  console.log(name, 'sections', pages);
  await page.close();
}
await browser.close();
