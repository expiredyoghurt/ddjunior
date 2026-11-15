// Draws the home screen icon from the duck shapes and renders PNGs. Needs sharp (npm i -D sharp) only when you re-run it.
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const require = createRequire(import.meta.url);
const sharp = require('sharp');

const duck = (t) => `<g transform="${t}">
<path d="M46 14 Q50 4 56 14" fill="none" stroke="#FFD23F" stroke-width="5" stroke-linecap="round"/>
<circle cx="50" cy="56" r="36" fill="#FFD23F" stroke="#1F2A44" stroke-width="3"/>
<ellipse cx="50" cy="74" rx="20" ry="13" fill="#FFE98A"/>
<circle cx="36" cy="48" r="4.5" fill="#1F2A44"/><circle cx="64" cy="48" r="4.5" fill="#1F2A44"/>
<circle cx="28" cy="60" r="6" fill="#FF9DB5"/><circle cx="72" cy="60" r="6" fill="#FF9DB5"/>
<ellipse cx="50" cy="58" rx="10" ry="6" fill="#FF9F43"/>
<path d="M42 70 Q50 78 58 70" fill="none" stroke="#1F2A44" stroke-width="3" stroke-linecap="round"/></g>`;

const svg = (t, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#FFF8E7"${bg ? '' : ' rx="96"'}/>${duck(t)}</svg>`;
writeFileSync(join(root, 'icon.svg'), svg('translate(56 56) scale(4)', false));
const any = Buffer.from(svg('translate(56 56) scale(4)', false));
const mask = Buffer.from(svg('translate(102 102) scale(3.08)', true));
await sharp(any).resize(512, 512).png().toFile(join(root, 'icon-512.png'));
await sharp(any).resize(192, 192).png().toFile(join(root, 'icon-192.png'));
await sharp(mask).resize(512, 512).png().toFile(join(root, 'icon-maskable-512.png'));
console.log('icons written');
