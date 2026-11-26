// SQLite storage (node:sqlite, built into Node 22). Schema is created on start; no ORM, no dependencies.
// Personal data kept to the minimum: contact details of leads and buyers. IPs are stored only as salted hashes.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDb(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      locale TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      topic TEXT NOT NULL,
      message TEXT,
      consent_at TEXT NOT NULL,
      ip_hash TEXT,
      status TEXT NOT NULL DEFAULT 'new'
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      locale TEXT NOT NULL,
      email TEXT NOT NULL,
      items_json TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL,
      provider TEXT,
      provider_session_id TEXT UNIQUE,
      customer_country TEXT,
      terms_accepted_at TEXT NOT NULL,
      digital_waiver_at TEXT NOT NULL,
      paid_at TEXT
    );
    CREATE TABLE IF NOT EXISTS downloads (
      token_hash TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id),
      sku TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      max_downloads INTEGER NOT NULL,
      download_count INTEGER NOT NULL DEFAULT 0,
      revoked INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS processed_events (
      event_id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      received_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      kind TEXT NOT NULL,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      related_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      sent_at TEXT
    );
    CREATE INDEX IF NOT EXISTS outbox_status ON outbox(status, id);
    -- Accounting ledger. Amounts in minor units of the order currency. One row per provider payment / refund.
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL REFERENCES orders(id),
      provider TEXT NOT NULL,
      provider_payment_id TEXT NOT NULL UNIQUE,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL,
      fee_cents INTEGER,               -- NULL until the provider reports the fee (reconcile before closing books)
      net_cents INTEGER,
      fee_currency TEXT,               -- settlement currency of fee/net (may differ from the order currency)
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS refunds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL REFERENCES orders(id),
      provider TEXT NOT NULL,
      provider_refund_id TEXT NOT NULL UNIQUE,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS payments_created ON payments(created_at);
    CREATE INDEX IF NOT EXISTS refunds_created ON refunds(created_at);
  `);
  return db;
}

export const nowIso = () => new Date().toISOString();
