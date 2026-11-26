// Runtime configuration from environment variables. Payments and external channels are OFF by default.
// Secrets live only in the environment (or a secrets manager), never in the repository. See .env.example.

import { products } from '../src/config/catalog.mjs';
import { business } from '../src/config/business.mjs';

export function loadConfig(env = process.env) {
  const bool = (v) => String(v || '').toLowerCase() === 'true';
  return {
    downloadValidityDays: 7,                // proposal, confirm in docs/ANKETA.md
    downloadMaxCount: 5,
    catalog: products,                      // overridden in tests only
    pricesConfirmed: business.pricesConfirmed,
    blockedCountries: business.blockedCountries,
    port: Number(env.PORT) || 8080,
    siteUrl: env.SITE_URL || 'http://localhost:8080',
    dataDir: env.DATA_DIR || 'data',
    dbFile: env.DB_FILE || 'data/app.db',
    privateDir: env.PRIVATE_DIR || 'private/products',
    distDir: env.DIST_DIR || 'dist',
    trustProxy: bool(env.TRUST_PROXY),
    ipSalt: env.IP_SALT || 'dev-only-salt-change-me',
    ownerEmail: env.OWNER_EMAIL || 'globalainanutrition@gmail.com',
    // Channels: 'file' (stores messages on disk, NOT delivered), 'telegram' (owner only, free Bot API)
    ownerChannel: env.OWNER_CHANNEL || 'file',
    // Client email: no provider is connected yet. 'file' keeps messages but does not deliver them.
    clientChannel: env.CLIENT_CHANNEL || 'file',
    telegram: { token: env.TELEGRAM_BOT_TOKEN || null, chatId: env.TELEGRAM_CHAT_ID || null },
    paymentsEnabled: bool(env.PAYMENTS_ENABLED),
    stripeSecretKey: env.STRIPE_SECRET_KEY || null,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET || null,
    workerIntervalMs: Number(env.WORKER_INTERVAL_MS) || 20000,
    runWorker: env.WORKER !== 'off',
  };
}
