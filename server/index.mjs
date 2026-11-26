// Entry point: node server/index.mjs  (see README / docs/ARCHITECTURE.md for deployment)
import { createServer } from 'node:http';
import { loadConfig, assertProductionConfig } from './config.mjs';
import { openDb } from './db.mjs';
import { createApp } from './app.mjs';
import { createTransports, processOutbox } from './outbox.mjs';

export function start(env = process.env) {
  const config = loadConfig(env);
  const problems = assertProductionConfig(config, env);
  if (problems.length) {
    console.error('Refusing to start. Fix the configuration:\n - ' + problems.join('\n - '));
    process.exit(2);
  }
  const db = openDb(config.dbFile);
  const transports = createTransports({ dataDir: config.dataDir, telegram: config.telegram, smtp: config.smtp });
  const app = createApp({ config, db, transports });
  const server = createServer((req, res) => { app(req, res); });
  // Slow-client protection (slowloris) and bounded connections
  server.headersTimeout = 15000;
  server.requestTimeout = 30000;
  server.keepAliveTimeout = 5000;
  server.maxHeadersCount = 50;
  server.listen(config.port, () => console.log(`AINA Évidence listening on :${config.port} (payments ${config.paymentsEnabled ? 'on' : 'off'})`));
  let timer = null;
  if (config.runWorker) {
    timer = setInterval(() => {
      processOutbox(db, transports, config).catch(() => console.error('outbox_worker_error'));
    }, config.workerIntervalMs);
    timer.unref();
  }
  const close = () => { if (timer) clearInterval(timer); server.close(() => { try { db.close(); } catch { /* already closed */ } }); };
  process.once('SIGTERM', () => { console.log('SIGTERM: shutting down'); close(); });
  process.once('SIGINT', close);
  return { server, db, close };
}

if (import.meta.url === `file://${process.argv[1]}`) start();
