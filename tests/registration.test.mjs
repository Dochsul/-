// Registration data must never reach tracked files (the repository is public). Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { loadRegistration, REGISTRATION_KEYS, SENSITIVE_KEYS, registrationFile } from '../src/config/registration.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SENTINEL = 'SENTINEL-SIREN-7781';

function tempRegistration(extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'reg-test-'));
  const file = join(dir, 'registration.json');
  writeFileSync(file, JSON.stringify({
    legal: { legalName: 'Test Person', siren: SENTINEL, address: 'SENTINEL-ADDRESS', unknownKey: 'ignored', ...extra },
    meta: { apeCode: '0000Z', other: 'ignored' },
  }));
  return { dir, file };
}

test('loader reads only the known keys and trims values', () => {
  const { dir, file } = tempRegistration({ rcsOrRm: '  Non applicable  ', vatNumber: '   ' });
  try {
    const r = loadRegistration({ REGISTRATION_FILE: file });
    assert.equal(r.loaded, true);
    assert.equal(r.legal.siren, SENTINEL);
    assert.equal(r.legal.rcsOrRm, 'Non applicable');
    assert.ok(!('unknownKey' in r.legal));
    assert.ok(!('vatNumber' in r.legal), 'blank values are ignored');
    assert.equal(r.meta.apeCode, '0000Z');
    assert.ok(!('other' in r.meta));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('REGISTRATION_FILE=off and a missing file give no data, not an error', () => {
  assert.equal(loadRegistration({ REGISTRATION_FILE: 'off' }).loaded, false);
  assert.deepEqual(loadRegistration({ REGISTRATION_FILE: '/nonexistent/x.json' }).legal, {});
});

test('the sensitive keys are a subset of the registration keys', () => {
  for (const k of SENSITIVE_KEYS.filter((k) => k !== 'apeCode' && k !== 'registrationNumber')) {
    assert.ok(REGISTRATION_KEYS.includes(k), `${k} is a registration key`);
  }
  assert.equal(registrationFile({ REGISTRATION_FILE: 'off' }), 'off');
});

test('Tilda export writes a marker instead of registration values', () => {
  const { dir, file } = tempRegistration();
  try {
    execFileSync(process.execPath, [join(ROOT, 'scripts/tilda-export.mjs')], { cwd: ROOT, env: { ...process.env, REGISTRATION_FILE: file }, stdio: 'pipe' });
    const pages = join(ROOT, 'tilda/pages');
    const text = execFileSync('grep', ['-rl', SENTINEL, pages, join(ROOT, 'tilda')], { stdio: 'pipe' }).toString().trim();
    assert.equal(text, '', 'the sentinel SIREN must not appear in tilda/');
  } catch (e) {
    // grep exits 1 when nothing matched: that is the success case
    assert.equal(e.status, 1, 'grep must find nothing');
  } finally {
    rmSync(dir, { recursive: true, force: true });
    // regenerate the committed package without private values
    spawnSync(process.execPath, [join(ROOT, 'scripts/tilda-export.mjs')], { cwd: ROOT, env: { ...process.env, REGISTRATION_FILE: 'off' }, stdio: 'pipe' });
  }
  const mentions = readFileSync(join(ROOT, 'tilda/pages/15-legal-privacy.md'), 'utf8');
  assert.match(mentions, /из личного реестра: legal\.siren/);
});

test('no sensitive registration value is present in tracked files (when the private file exists locally)', () => {
  const file = registrationFile();
  if (file === 'off' || !existsSync(file)) return; // CI and fresh clones have no private data
  const { legal } = loadRegistration();
  const values = SENSITIVE_KEYS.map((k) => legal[k]).filter(Boolean);
  if (!values.length) return;
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT }).toString().split('\0').filter(Boolean)
    .filter((f) => !f.startsWith('dist/') && !f.startsWith('private/') && f !== 'tests/registration.test.mjs');
  const leaks = [];
  for (const f of tracked) {
    let body;
    try { body = readFileSync(join(ROOT, f), 'utf8'); } catch { continue; }
    for (const v of values) if (body.includes(v)) leaks.push(`${f}`);
  }
  assert.deepEqual(leaks, [], 'personal registration values must not be committed');
});
