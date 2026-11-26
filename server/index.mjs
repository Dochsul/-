// Entry point: node server/index.mjs  (see README / docs/ARCHITECTURE.md for deployment)
import { createServer } from 'node:http';
import { loadConfig } from './config.mjs';
import { openDb } from './db.mjs';
import { createApp } from './app.mjs';
import { createTransports, processOutbox } from './outbox.mjs';

export function start(env = process.env) {
  const config = loadConfig(env);
  const db = openDb(config.dbFile);
  const transports = createTransports({ dataDir: config.dataDir, telegram: config.telegram });
  const app = createApp({ config, db, transports });
  const server = createServer((req, res) => { app(req, res); });
  server.listen(config.port, () => console.log(`AINA Évidence listening on :${config.port} (payments ${config.paymentsEnabled ? 'on' : 'off'})`));
  let timer = null;
  if (config.runWorker) {
    timer = setInterval(() => {
      processOutbox(db, transports, config).catch(() => console.error('outbox_worker_error'));
    }, config.workerIntervalMs);
    timer.unref();
  }
  return { server, db, close() { if (timer) clearInterval(timer); server.close(); db.close(); } };
}

if (import.meta.url === `file://${process.argv[1]}`) start();
