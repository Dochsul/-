// Runtime configuration from environment variables. Payments and external channels are OFF by default.
// Secrets live only in the environment (or a secrets manager), never in the repository. See .env.example.

import { products, fileSkus } from '../src/config/catalog.mjs';
import { business } from '../src/config/business.mjs';

export function loadConfig(env = process.env) {
  const bool = (v) => String(v || '').toLowerCase() === 'true';
  return {
    downloadValidityDays: 7,                // proposal, confirm in docs/ANKETA.md
    downloadMaxCount: 5,
    // Payment provider. Revolut is the primary provider; Stripe is kept as a disabled fallback module.
    paymentProvider: env.PAYMENT_PROVIDER || 'revolut',
    revolut: {
      env: env.REVOLUT_ENV || 'sandbox',           // sandbox | production
      apiKey: env.REVOLUT_API_KEY || null,           // Merchant API secret key: server environment only
      webhookSecret: env.REVOLUT_WEBHOOK_SECRET || null, // wsk_… signing secret of the webhook
      version: env.REVOLUT_API_VERSION || '2024-05-01',
    },
    catalog: products,                      // overridden in tests only
    fileSkus: fileSkus(),
    // Currencies in which checkout is allowed. RUB prices are stored, but RUB payments stay OFF until a lawyer and the
    // payment provider confirm they are permitted (sanctions, provider support).
    enabledCurrencies: (env.ENABLED_CURRENCIES || 'EUR').split(',').map((x) => x.trim()).filter(Boolean),
    // Origins allowed to call the API from the browser (the Tilda site domain). Empty = same-origin only.
    allowedOrigins: (env.ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean),
    // Where Stripe sends the buyer back. {locale} is replaced. Defaults to the static site.
    checkoutSuccessUrl: env.CHECKOUT_SUCCESS_URL || null,
    checkoutCancelUrl: env.CHECKOUT_CANCEL_URL || null,
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
    // SMTP relay for customer and owner emails (set OWNER_CHANNEL / CLIENT_CHANNEL to 'smtp' to use it)
    smtp: {
      host: env.SMTP_HOST || null,
      port: Number(env.SMTP_PORT) || (env.SMTP_SECURE === 'tls' ? 465 : 587),
      secure: env.SMTP_SECURE || 'starttls',        // tls | starttls
      user: env.SMTP_USER || null,
      pass: env.SMTP_PASS || null,
      fromAddress: env.MAIL_FROM || null,            // e.g. orders@your-domain (must be allowed by the relay)
      fromName: env.MAIL_FROM_NAME || 'AINA Évidence',
      replyTo: env.MAIL_REPLY_TO || env.OWNER_EMAIL || null,
    },
    paymentsEnabled: bool(env.PAYMENTS_ENABLED),
    stripeSecretKey: env.STRIPE_SECRET_KEY || null,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET || null,
    workerIntervalMs: Number(env.WORKER_INTERVAL_MS) || 20000,
    runWorker: env.WORKER !== 'off',
  };
}

// Startup guard. In production the server refuses to start with settings that would silently lose data,
// leak money-moving credentials or switch on live payments by accident.
//   - live Stripe keys need a second, explicit switch: LIVE_PAYMENTS_APPROVED=owner-approved
//   - notifications must go through a real channel (not 'file'), and delivery emails through SMTP when payments are on
export function assertProductionConfig(config, env = process.env) {
  if (env.NODE_ENV !== 'production') return [];
  const errors = [];
  if (!config.ipSalt || config.ipSalt.length < 16 || config.ipSalt === 'dev-only-salt-change-me') errors.push('IP_SALT must be a random string of at least 16 characters');
  if (!/^https:\/\//.test(config.siteUrl)) errors.push('SITE_URL must be an https:// address');
  for (const o of config.allowedOrigins) if (!/^https:\/\/[^/*]+$/.test(o)) errors.push(`ALLOWED_ORIGINS entry must be an exact https origin: ${o}`);
  if (!config.trustProxy) errors.push('TRUST_PROXY=true is required behind the reverse proxy (otherwise every visitor shares one rate-limit bucket)');
  if (config.ownerChannel === 'file') errors.push("OWNER_CHANNEL must not be 'file' in production: the owner would never be notified");
  if (config.ownerChannel === 'smtp' || config.clientChannel === 'smtp') {
    for (const k of ['host', 'fromAddress']) if (!config.smtp[k]) errors.push(`SMTP_${k === 'host' ? 'HOST' : 'MAIL_FROM'} is required for the smtp channel`);
    if (config.smtp.user && !['tls', 'starttls'].includes(config.smtp.secure)) errors.push('SMTP_SECURE must be tls or starttls');
  }
  if (config.ownerChannel === 'telegram' && !(config.telegram.token && config.telegram.chatId)) errors.push('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required for the telegram channel');
  if (config.paymentsEnabled && config.paymentProvider === 'revolut') {
    const r = config.revolut || {};
    if (!r.apiKey) errors.push('REVOLUT_API_KEY is required when payments are enabled');
    if (!/^wsk_[A-Za-z0-9_-]{10,}$/.test(r.webhookSecret || '')) errors.push('REVOLUT_WEBHOOK_SECRET (wsk_…) is missing or malformed');
    if (!['sandbox', 'production'].includes(r.env)) errors.push('REVOLUT_ENV must be sandbox or production');
    if (r.env === 'production' && env.LIVE_PAYMENTS_APPROVED !== 'owner-approved') errors.push('REVOLUT_ENV=production requires LIVE_PAYMENTS_APPROVED=owner-approved (explicit owner decision)');
    if (config.clientChannel !== 'smtp') errors.push("CLIENT_CHANNEL must be 'smtp' when payments are enabled: buyers receive their links by email");
  }
  if (config.paymentsEnabled && config.paymentProvider === 'stripe') {
    const key = config.stripeSecretKey || '';
    if (!/^(sk|rk)_(test|live)_[A-Za-z0-9]{10,}$/.test(key)) errors.push('STRIPE_SECRET_KEY is missing or malformed');
    if (!/^whsec_[A-Za-z0-9]{10,}$/.test(config.stripeWebhookSecret || '')) errors.push('STRIPE_WEBHOOK_SECRET is missing or malformed');
    if (/_live_/.test(key) && env.LIVE_PAYMENTS_APPROVED !== 'owner-approved') errors.push('a live Stripe key requires LIVE_PAYMENTS_APPROVED=owner-approved (explicit owner decision)');
    if (config.clientChannel !== 'smtp') errors.push("CLIENT_CHANNEL must be 'smtp' when payments are enabled: buyers receive their links by email");
  }
  if (!['revolut', 'stripe'].includes(config.paymentProvider)) errors.push('PAYMENT_PROVIDER must be revolut or stripe');
  if (config.enabledCurrencies.includes('RUB') && env.RUB_PAYMENTS_APPROVED !== 'owner-approved') errors.push('RUB payments require RUB_PAYMENTS_APPROVED=owner-approved (lawful working payment channel confirmed)');
  return errors;
}
