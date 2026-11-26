#!/usr/bin/env node
// Makes the ADMIN_PASSWORD_HASH value for the server's .env. Run it on YOUR computer; never paste the password into chat.
// Usage (the password is read from stdin, not from the command line, so it stays out of shell history):
//   read -rs ADMIN_PW && printf '%s' "$ADMIN_PW" | node scripts/admin-password.mjs; unset ADMIN_PW
import { hashPassword } from '../server/admin.mjs';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', async () => {
  const password = input.replace(/\r?\n$/, '');
  try {
    const hash = await hashPassword(password);
    console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  } catch (e) {
    console.error(`Не получилось: ${e.message}`);
    process.exit(1);
  }
});
