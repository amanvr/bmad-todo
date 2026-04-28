import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { runMigrations } from './db/migrate.js';

const config = loadConfig();

// Apply pending migrations before binding the port (architecture line 92).
await runMigrations(config.DATABASE_URL);

const app = await buildApp(config);

try {
  await app.listen({ port: config.BACKEND_PORT, host: '0.0.0.0' });
} catch (err) {
  app.log.error({ err }, 'failed to start');
  process.exit(1);
}
