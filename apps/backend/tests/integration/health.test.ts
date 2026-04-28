import { Writable } from 'node:stream';
import pino from 'pino';
import { describe, it, expect } from 'vitest';
import type { Config } from '../../src/config.js';
import { buildApp } from '../../src/app.js';
import { POSTGRES_TESTS_ENABLED, TEST_DATABASE_URL } from './setup.js';

const validConfig: Config = {
  NODE_ENV: 'test',
  BACKEND_PORT: 3000,
  DATABASE_URL: TEST_DATABASE_URL,
  CORS_ORIGINS: 'http://localhost:8080',
  LOG_LEVEL: 'info',
};

describe.skipIf(!POSTGRES_TESTS_ENABLED)('GET /api/health', () => {
  it('returns 200 with status healthy and persistence up', async () => {
    const app = await buildApp(validConfig);
    const res = await app.inject({ method: 'GET', url: '/api/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'healthy', persistence: 'up' });
    await app.close();
  });

  it('returns 503 with status unhealthy and persistence down when db is unreachable', async () => {
    const app = await buildApp({
      ...validConfig,
      DATABASE_URL: 'postgres://bmad_todo:wrong@nonexistent-host:5432/bmad_todo',
    });
    const res = await app.inject({ method: 'GET', url: '/api/health' });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'unhealthy', persistence: 'down' });
    await app.close();
  });

  it('emits persistence transition log only once on repeated down probes', async () => {
    const logBuffer: string[] = [];
    const sink = new Writable({
      write(chunk, _enc, callback) {
        logBuffer.push(chunk.toString());
        callback();
      },
    });
    const logger = pino({ level: 'info' }, sink);

    const app = await buildApp(
      {
        ...validConfig,
        DATABASE_URL: 'postgres://bmad_todo:wrong@nonexistent-host:5432/bmad_todo',
      },
      { loggerInstance: logger },
    );

    const first = await app.inject({ method: 'GET', url: '/api/health' });
    const second = await app.inject({ method: 'GET', url: '/api/health' });

    expect(first.statusCode).toBe(503);
    expect(second.statusCode).toBe(503);

    const healthPersistenceLines = logBuffer.filter((line) =>
      line.includes('health.persistence.down'),
    );
    expect(healthPersistenceLines).toHaveLength(1);

    await app.close();
  }, 15_000);
});
