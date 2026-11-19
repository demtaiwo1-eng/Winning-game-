#!/usr/bin/env node
/**
 * EPHINTA complete readiness runner.
 * Runs existing non-production checks and writes JSON + Markdown evidence.
 * Never deploys, charges, refunds, pays out, mutates production data, or prints secrets.
 *
 * Usage from eventsss123/eventsss-main:
 *   npm run qa:readiness
 *   npm run qa:readiness -- --quick
 *   npm run qa:readiness -- --skip-mobile
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REPORT_DIR = path.join(ROOT, 'artifacts', 'readiness');
const args = new Set(process.argv.slice(2));
const quick = args.has('--quick');
const skipMobile = args.has('--skip-mobile');
const startedAt = new Date();
const results = [];

function exists(p) { return fs.existsSync(path.join(ROOT, p)); }
function add(name, area, status, detail, command = '') {
  results.push({ name, area, status, detail, command });
  const mark = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '–';
  console.log(mark + ' [' + status + '] ' + area + ': ' + name + (detail ? ' — ' + detail : ''));
}
function run(name, area, command, commandArgs, timeout = 1800000) {
  const r = spawnSync(command, commandArgs, {
    cwd: ROOT, encoding: 'utf8', env: process.env, timeout,
    maxBuffer: 20 * 1024 * 1024, shell: false
  });
  const ok = r.status === 0;
  const output = [r.stdout, r.stderr].filter(Boolean).join('\n');
  const diagnostic = output.split('\n').filter(Boolean).slice(-8).join(' | ').slice(-1200);
  add(name, area, ok ? 'PASS' : 'FAIL',
    ok ? 'Command completed.' : 'Exit ' + (r.status ?? 'unknown') + (r.error ? ': ' + r.error.message : '') +
      (diagnostic ? '. Tail: ' + diagnostic : '. No command output captured.'),
    [command].concat(commandArgs).join(' '));
  return ok;
}
function skip(name, area, detail) { add(name, area, 'SKIP', detail); }
function scripts(p) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')).scripts || {}; }
  catch { return {}; }
}

console.log('EPHINTA complete readiness run');
console.log('Workspace: ' + ROOT);
console.log('Mode: ' + (quick ? 'quick' : 'full') + '\n');

if (!exists('package.json')) {
  console.error('Run from eventsss123/eventsss-main using npm run qa:readiness.');
  process.exit(2);
}
const root = scripts('package.json');
const api = scripts('apps/api/package.json');
const web = scripts('apps/web/package.json');
const mobile = scripts('apps/mobile/package.json');

// 1. Authentication, registration and general application regression.
// API integration tests require the disposable database provisioned by the dedicated
// API CI workflow. Do not rerun them in this lightweight runner without that service.
skip('API validation, typecheck and database-backed tests', 'authentication / API',
  'Executed by the provisioned API CI workflow, which supplies the disposable database.');
if (web.test) run('Web component test suite', 'authentication / registration', 'npm', ['run', 'test', '-w', 'apps/web']);

// 2. Workspace consistency, themes and navigation.
if (web['design:audit:strict']) run('Strict design and global theme contract audit', 'workspaces / accessibility', 'npm', ['run', 'design:audit:strict', '-w', 'apps/web']);
else skip('Strict design audit', 'workspaces', 'No strict audit script is configured.');
if (web['test:e2e'] && !quick) run('Browser end-to-end journeys', 'workspaces / navigation', 'npm', ['run', 'test:e2e', '-w', 'apps/web'], 2700000);
else skip('Browser end-to-end journeys', 'workspaces', quick ? 'Omitted in quick mode.' : 'No E2E script is configured.');

// 3. Payments. Only repository tests are run; no provider API calls or money movement.
if (web['test:payment-personas'] && !quick) skip('Payment persona regression suite', 'payments / wallet',
  'Run only in its provisioned payment-persona CI workflow; this runner has no isolated persona backend.');
else skip('Payment persona regression suite', 'payments / wallet', 'Omitted in quick mode or no dedicated script exists.');
const paymentNames = Object.keys(process.env).filter(k => /OPAY|CLEVA|EVERSEND|PAYMENT/i.test(k));
add('Payment environment variable inventory', 'payments / wallet', paymentNames.length ? 'PASS' : 'SKIP',
  paymentNames.length ? paymentNames.length + ' matching variable name(s) found; values were not read.' : 'No payment-related variable names detected in this runner.');

// 4. Event workflow and messaging test discovery.
const groups = [
  ['event / deposit / vendor settlement', ['event', 'deposit', 'settlement']],
  ['individual and group messaging', ['message', 'notification']],
  ['notification delivery and preferences', ['notification', 'delivery', 'preference']]
];
for (const item of groups) {
  const found = [];
  for (const base of ['apps/api', 'apps/web']) {
    if (!exists(base)) continue;
    const visit = dir => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (['node_modules', 'dist', 'build', 'coverage'].includes(ent.name)) continue;
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) visit(full);
        else if (/\.(test|spec)\.(ts|tsx|js|jsx|mjs)$/.test(ent.name) &&
          item[1].some(term => ent.name.toLowerCase().includes(term))) found.push(path.relative(ROOT, full));
      }
    };
    visit(path.join(ROOT, base));
  }
  add('Dedicated test discovery: ' + item[0], 'event workflows / messaging', 'SKIP',
    found.length ? found.length + ' matching test file(s) found; discovery is not execution. Execute them through the API/web CI suites.' :
      'No dedicated test filename found; general suites may still cover this area.');
}

// 5. Android build gates and signing inventory.
if (skipMobile || quick) skip('Android lint/unit tests/debug APK', 'Android', 'Omitted by command-line option.');
else if (mobile['verify:android'] && exists('apps/mobile/android/gradlew'))
  skip('Android lint, unit tests and debug APK build', 'Android',
    'Executed by the Android CI workflow, which provisions the Android SDK and Java toolchain.');
else skip('Android lint/unit tests/debug APK', 'Android', 'Android project or executable Gradle wrapper is missing.');
const signingNames = Object.keys(process.env).filter(k => /ANDROID.*(KEY|SIGN)|KEYSTORE/i.test(k));
const keyFiles = ['apps/mobile/android/app/release.keystore', 'apps/mobile/android/app/keystore.jks'].filter(exists);
add('Android signing material inventory', 'Android release',
  signingNames.length || keyFiles.length ? 'PASS' : 'SKIP',
  signingNames.length + ' signing-related environment name(s), ' + keyFiles.length +
  ' conventional keystore file(s) detected. Inventory only; no values or key contents read.');
skip('Physical-device install and launch acceptance', 'Android release',
  'Requires a real Android device or device farm; CI APK assembly is not proof of installation or launch.');

// 6. Security, database and scale gates.
if (root['device-security:verify']) run('Device security verification', 'security', 'npm', ['run', 'device-security:verify']);
else skip('Device security verification', 'security', 'No device security script is configured.');
if (root['qa:scale:plan']) run('Scale QA safe preflight', 'reliability / performance', 'npm', ['run', 'qa:scale:plan']);
else skip('Scale QA preflight', 'reliability / performance', 'No scale QA plan script is configured.');
skip('Database integration and backup restore rehearsal', 'security / reliability',
  'Requires a disposable test database and explicit restore target; never run automatically against production.');
skip('Render secret, permissions and provider dashboard review', 'security',
  'Manual review required. This runner does not read, print or modify deployment secrets.');
skip('Production load test', 'reliability / performance',
  'Requires an approved staging environment and traffic profile; no load is sent to production.');

// Build gates; no deployment.
if (root.build) run('API production build', 'build', 'npm', ['run', 'build']);
if (root['build:web']) run('Web production build', 'build', 'npm', ['run', 'build:web']);

const finishedAt = new Date();
const summary = {
  name: 'EPHINTA Complete Readiness',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  mode: quick ? 'quick' : 'full',
  totals: {
    pass: results.filter(x => x.status === 'PASS').length,
    fail: results.filter(x => x.status === 'FAIL').length,
    skip: results.filter(x => x.status === 'SKIP').length
  },
  releaseReady: results.every(x => x.status === 'PASS'),
  results,
  safety: [
    'No production deployment was performed.',
    'No real or sandbox payment was initiated.',
    'No payout, refund or production database mutation was performed.',
    'No secret values or keystore contents were read or printed.',
    'Physical-device acceptance, provider sandbox transactions and production load testing remain external gates.'
  ]
};
fs.mkdirSync(REPORT_DIR, { recursive: true });
fs.writeFileSync(path.join(REPORT_DIR, 'ephinta-readiness.json'), JSON.stringify(summary, null, 2) + '\n');
const lines = [
  '# EPHINTA Complete Readiness Report', '',
  '- Started: ' + summary.startedAt,
  '- Finished: ' + summary.finishedAt,
  '- Mode: ' + summary.mode,
  '- Totals: ' + summary.totals.pass + ' passed, ' + summary.totals.fail + ' failed, ' + summary.totals.skip + ' skipped',
  '- Fully release-ready: ' + (summary.releaseReady ? 'YES' : 'NO'), '',
  '| Area | Check | Status | Detail |',
  '|---|---|---|---|'
];
for (const x of results) lines.push('| ' + x.area + ' | ' + x.name + ' | ' + x.status + ' | ' + x.detail.replaceAll('|', '\\|') + ' |');
lines.push('', '## Safety boundaries');
for (const s of summary.safety) lines.push('- ' + s);
lines.push('', 'A skipped check is not a pass. Complete every external gate before release.');
fs.writeFileSync(path.join(REPORT_DIR, 'ephinta-readiness.md'), lines.join('\n') + '\n');

console.log('\nReports: artifacts/readiness/ephinta-readiness.md and ephinta-readiness.json');
console.log('Totals: ' + summary.totals.pass + ' passed, ' + summary.totals.fail + ' failed, ' + summary.totals.skip + ' skipped.');
if (summary.totals.fail) process.exitCode = 1;
else if (summary.totals.skip) process.exitCode = 2;
