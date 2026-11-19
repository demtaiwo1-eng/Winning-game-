import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const main = read('src/main.tsx');
const globalCss = read('src/styles/ephinta-global.css');
const themeContract = read('src/styles/ephinta-global-theme-contract.css');
const checks = [
  ['global stylesheet is imported once by the app entry', (main.match(/\.\/styles\/ephinta-global\.css/g) ?? []).length === 1],
  ['global stylesheet imports the theme contract', /@import\s+["']\.\/ephinta-global-theme-contract\.css["']/.test(globalCss)],
  ['theme contract defines all three palettes', ['light', 'dark', 'colorful'].every((theme) => themeContract.includes('data-ephinta-theme="' + theme + '"'))],
  ['startup screens use semantic classes, not inline styles', /className="eph-startup-screen/.test(main) && !/<main[\s\S]{0,300}?style=\{\{/.test(main)],
  ['startup surfaces consume global theme tokens', /\.eph-startup-screen[\s\S]*?var\(--epg-ink\)[\s\S]*?var\(--epg-page\)/.test(globalCss)],
  ['audio overlays override legacy palette with theme tokens', /\.eph-audio__prompt, \.eph-audio__player[\s\S]*?var\(--epg-surface-raised\)[\s\S]*?var\(--epg-border\)/.test(globalCss)],
  ['responsive styles include phone/tablet breakpoints', /@media\s*\(max-width:\s*(?:600|768)px\)/.test(globalCss) || fs.readdirSync(path.join(root, 'src/styles')).some((f) => /responsive|scale/i.test(f) && /@media\s*\(max-width:\s*(?:600|768)px\)/.test(read('src/styles/' + f)))],
];
let failed = false;
for (const [label, passed] of checks) { process.stdout.write((passed ? 'PASS ' : 'FAIL ') + label + '\n'); failed ||= !passed; }
if (failed) process.exitCode = 1;
