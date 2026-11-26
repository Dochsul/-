#!/usr/bin/env node
// Keeps a password-protected copy of private/registration.json that is safe to store OUTSIDE GitHub
// (cloud drive, password manager note, USB stick). Uses the same AES-256-GCM format as the database backups.
// The passphrase is read from stdin (never from the command line) and must be at least 20 characters.
//
//   seal:  read -rs PASS && printf '%s' "$PASS" | node scripts/registration-seal.mjs seal; unset PASS
//          -> writes private/registration.json.enc (ignored by git)
//   open:  read -rs PASS && printf '%s' "$PASS" | node scripts/registration-seal.mjs open [--force]; unset PASS
//          -> restores private/registration.json from the .enc file
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encrypt, decrypt } from '../server/backup.mjs';
import { registrationFile } from '../src/config/registration.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const plainPath = registrationFile();
const sealedPath = `${plainPath === 'off' ? resolve(ROOT, 'private/registration.json') : plainPath}.enc`;
const mode = process.argv[2];
const force = process.argv.includes('--force');

async function readStdin() {
  process.stdin.setEncoding('utf8');
  let s = '';
  for await (const chunk of process.stdin) s += chunk;
  return s.replace(/\r?\n$/, '');
}

function fail(msg) { console.error(msg); process.exit(1); }

const passphrase = await readStdin();
if (passphrase.length < 20) fail('Пароль должен быть не короче 20 символов.');

if (mode === 'seal') {
  if (!existsSync(plainPath) || plainPath === 'off') fail('Файл private/registration.json не найден.');
  const plain = readFileSync(plainPath);
  JSON.parse(plain.toString('utf8')); // refuse to seal something that is not valid JSON
  writeFileSync(sealedPath, encrypt(plain, passphrase), { mode: 0o600 });
  console.log(`Зашифрованная копия записана: ${sealedPath}`);
  console.log('Сохраните этот файл вне GitHub и пароль в менеджере паролей. Без пароля файл не открыть.');
} else if (mode === 'open') {
  if (!existsSync(sealedPath)) fail('Зашифрованный файл не найден.');
  if (existsSync(plainPath) && !force) fail('private/registration.json уже есть. Добавьте --force, чтобы перезаписать.');
  let plain;
  try { plain = decrypt(readFileSync(sealedPath), passphrase); }
  catch { fail('Не удалось открыть: неверный пароль или повреждённый файл.'); }
  JSON.parse(plain.toString('utf8'));
  writeFileSync(plainPath, plain, { mode: 0o600 });
  console.log(`Восстановлено: ${plainPath}`);
} else {
  fail('Использование: registration-seal.mjs seal | open [--force]');
}
