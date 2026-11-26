#!/usr/bin/env node
// Validates the environment against the production startup guard WITHOUT starting the server.
// Used by deploy/deploy.sh. Usage: NODE_ENV=production node scripts/check-env.mjs
import { loadConfig, assertProductionConfig } from '../server/config.mjs';
const config = loadConfig(process.env);
const env = { ...process.env, NODE_ENV: 'production' };
const problems = assertProductionConfig(config, env);
if (problems.length) { console.error('Configuration problems:\n - ' + problems.join('\n - ')); process.exit(1); }
console.log(`Configuration OK. Payments: ${config.paymentsEnabled ? 'ENABLED' : 'off'}; currencies: ${config.enabledCurrencies.join(',')}; owner channel: ${config.ownerChannel}; buyer email: ${config.clientChannel}.`);
