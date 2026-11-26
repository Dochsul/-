// The sealed copy of registration.json must round-trip and must refuse a wrong passphrase. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'scripts/registration-seal.mjs');
const PASS = 'long enough passphrase 2026';

function run(mode, input, env) {
  return spawnSync(process.execPath, [SCRIPT, ...mode], { input, env: { ...process.env, ...env }, encoding: 'utf8' });
}

test('seal and open round-trip; wrong passphrase is refused; the plain copy is not overwritten silently', () => {
  const dir = mkdtempSync(join(tmpdir(), 'seal-test-'));
  try {
    const plain = join(dir, 'registration.json');
    const content = JSON.stringify({ legal: { siren: 'TEST-SIREN-0001' } }, null, 2);
    writeFileSync(plain, content);
    const env = { REGISTRATION_FILE: plain };

    const sealed = run(['seal'], PASS, env);
    assert.equal(sealed.status, 0, sealed.stderr);
    const enc = plain + '.enc';
    assert.ok(existsSync(enc));
    assert.ok(!readFileSync(enc, 'utf8').includes('TEST-SIREN-0001'), 'the sealed file must not contain the plain value');

    const wrong = run(['open', '--force'], 'a wrong passphrase that is long', env);
    assert.notEqual(wrong.status, 0);
    assert.match(wrong.stderr, /Не удалось открыть/);

    const refused = run(['open'], PASS, env);
    assert.notEqual(refused.status, 0, 'open must not overwrite an existing plain file without --force');

    rmSync(plain);
    const opened = run(['open'], PASS, env);
    assert.equal(opened.status, 0, opened.stderr);
    assert.equal(readFileSync(plain, 'utf8'), content);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a short passphrase is refused before anything is written', () => {
  const dir = mkdtempSync(join(tmpdir(), 'seal-test-'));
  try {
    const plain = join(dir, 'registration.json');
    writeFileSync(plain, '{}');
    const r = run(['seal'], 'short', { REGISTRATION_FILE: plain });
    assert.notEqual(r.status, 0);
    assert.ok(!existsSync(plain + '.enc'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
