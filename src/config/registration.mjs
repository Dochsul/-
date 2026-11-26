// Registration data of the owner's business. The repository is PUBLIC, so these values are NOT stored in git.
// They live in private/registration.json (ignored by git, see .gitignore) or in the file named by REGISTRATION_FILE.
// REGISTRATION_FILE=off disables the file (used by the automated tests and by CI, which have no private data).
// A missing file means every value stays null, so the build reports the gaps as before.
// Generated Tilda texts never contain these values: they carry a marker telling the owner to copy the value by hand.

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Keys of business.legal that may come from the private file.
export const REGISTRATION_KEYS = [
  'legalName', 'legalForm', 'siren', 'rcsOrRm', 'vatNumber', 'address',
  'publicationDirector', 'hostProvider', 'mediator',
];

// Values that must never appear in tracked files (checked by tests/registration.test.mjs).
export const SENSITIVE_KEYS = ['siren', 'address', 'vatNumber', 'apeCode', 'registrationNumber'];

const DEFAULT_FILE = resolve(dirname(fileURLToPath(import.meta.url)), '../../private/registration.json');

export function registrationFile(env = process.env) {
  return env.REGISTRATION_FILE || DEFAULT_FILE;
}

export function loadRegistration(env = process.env) {
  const file = registrationFile(env);
  if (file === 'off' || !existsSync(file)) return { loaded: false, legal: {}, meta: {} };
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const legal = {};
  for (const k of REGISTRATION_KEYS) {
    const v = data.legal?.[k];
    if (typeof v === 'string' && v.trim()) legal[k] = v.trim();
  }
  // Non-legal facts kept for the owner's records (APE code, registration date, activity nature).
  const meta = {};
  for (const k of ['apeCode', 'activity', 'registeredOn', 'regime', 'entityType']) {
    if (typeof data.meta?.[k] === 'string' && data.meta[k].trim()) meta[k] = data.meta[k].trim();
  }
  return { loaded: true, legal, meta };
}
