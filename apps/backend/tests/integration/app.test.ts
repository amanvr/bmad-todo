import { describe, it, expect } from 'vitest';
import { buildApp } from '../../src/app.js';
import type { Config } from '../../src/config.js';

const validConfig: Config = {
  NODE_ENV: 'test',
  BACKEND_PORT: 3000,
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  CORS_ORIGINS: 'http://localhost:8080',
  LOG_LEVEL: 'silent' as Config['LOG_LEVEL'],
};

describe('buildApp', () => {
  it('boots Fastify without errors given a valid config', async () => {
    const app = await buildApp(validConfig);
    await app.ready();
    expect(app).toBeDefined();
    await app.close();
  });
});
