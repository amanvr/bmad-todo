import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../db/client.js';
import { buildHealthController } from './healthController.js';

function createDbMock(sequence: Array<'up' | 'down'>): Database {
  let callIndex = 0;
  const execute = vi.fn().mockImplementation(async () => {
    const state = sequence[Math.min(callIndex, sequence.length - 1)];
    callIndex += 1;
    if (state === 'down') {
      throw new Error('db unavailable');
    }
    return [{ '?column?': 1 }];
  });

  return { execute } as unknown as Database;
}

describe('buildHealthController transition logging', () => {
  const getHealthEvents = (calls: unknown[][]): Array<Record<string, unknown>> =>
    calls
      .map((call) => call[0] as Record<string, unknown> | undefined)
      .filter(
        (payload): payload is Record<string, unknown> =>
          Boolean(payload) &&
          typeof payload === 'object' &&
          typeof payload.event === 'string' &&
          payload.event.startsWith('health.persistence.'),
      );

  it('logs initial up state once', async () => {
    const app = Fastify({ logger: false });
    const db = createDbMock(['up']);
    const infoSpy = vi.spyOn(app.log, 'info');
    const warnSpy = vi.spyOn(app.log, 'warn');
    await app.register(buildHealthController({ db }));

    const res = await app.inject({ method: 'GET', url: '/api/health' });

    expect(res.statusCode).toBe(200);
    const infoEvents = getHealthEvents(infoSpy.mock.calls);
    const warnEvents = getHealthEvents(warnSpy.mock.calls);
    expect(infoEvents).toHaveLength(1);
    expect(warnEvents).toHaveLength(0);
    expect(infoEvents[0]).toMatchObject({
      event: 'health.persistence.up',
      previous: null,
    });
    await app.close();
  });

  it('logs initial down state once', async () => {
    const app = Fastify({ logger: false });
    const db = createDbMock(['down']);
    const infoSpy = vi.spyOn(app.log, 'info');
    const warnSpy = vi.spyOn(app.log, 'warn');
    await app.register(buildHealthController({ db }));

    const res = await app.inject({ method: 'GET', url: '/api/health' });

    expect(res.statusCode).toBe(503);
    const infoEvents = getHealthEvents(infoSpy.mock.calls);
    const warnEvents = getHealthEvents(warnSpy.mock.calls);
    expect(infoEvents).toHaveLength(1);
    expect(warnEvents).toHaveLength(0);
    expect(infoEvents[0]).toMatchObject({
      event: 'health.persistence.down',
      previous: null,
    });
    await app.close();
  });

  it('does not log on steady-state up', async () => {
    const app = Fastify({ logger: false });
    const db = createDbMock(['up', 'up']);
    const infoSpy = vi.spyOn(app.log, 'info');
    const warnSpy = vi.spyOn(app.log, 'warn');
    await app.register(buildHealthController({ db }));

    await app.inject({ method: 'GET', url: '/api/health' });
    await app.inject({ method: 'GET', url: '/api/health' });

    const infoEvents = getHealthEvents(infoSpy.mock.calls);
    const warnEvents = getHealthEvents(warnSpy.mock.calls);
    expect(infoEvents).toHaveLength(1);
    expect(warnEvents).toHaveLength(0);
    await app.close();
  });

  it('logs warn on up to down transition', async () => {
    const app = Fastify({ logger: false });
    const db = createDbMock(['up', 'down']);
    const infoSpy = vi.spyOn(app.log, 'info');
    const warnSpy = vi.spyOn(app.log, 'warn');
    await app.register(buildHealthController({ db }));

    await app.inject({ method: 'GET', url: '/api/health' });
    const res = await app.inject({ method: 'GET', url: '/api/health' });

    expect(res.statusCode).toBe(503);
    const infoEvents = getHealthEvents(infoSpy.mock.calls);
    const warnEvents = getHealthEvents(warnSpy.mock.calls);
    expect(infoEvents).toHaveLength(1);
    expect(warnEvents).toHaveLength(1);
    expect(warnEvents[0]).toMatchObject({
      event: 'health.persistence.down',
      previous: 'up',
      error: 'db unavailable',
    });
    await app.close();
  });

  it('does not log on steady-state down', async () => {
    const app = Fastify({ logger: false });
    const db = createDbMock(['down', 'down']);
    const infoSpy = vi.spyOn(app.log, 'info');
    const warnSpy = vi.spyOn(app.log, 'warn');
    await app.register(buildHealthController({ db }));

    await app.inject({ method: 'GET', url: '/api/health' });
    await app.inject({ method: 'GET', url: '/api/health' });

    const infoEvents = getHealthEvents(infoSpy.mock.calls);
    const warnEvents = getHealthEvents(warnSpy.mock.calls);
    expect(infoEvents).toHaveLength(1);
    expect(warnEvents).toHaveLength(0);
    await app.close();
  });

  it('logs info on down to up transition', async () => {
    const app = Fastify({ logger: false });
    const db = createDbMock(['down', 'up']);
    const infoSpy = vi.spyOn(app.log, 'info');
    const warnSpy = vi.spyOn(app.log, 'warn');
    await app.register(buildHealthController({ db }));

    await app.inject({ method: 'GET', url: '/api/health' });
    const res = await app.inject({ method: 'GET', url: '/api/health' });

    expect(res.statusCode).toBe(200);
    const infoEvents = getHealthEvents(infoSpy.mock.calls);
    const warnEvents = getHealthEvents(warnSpy.mock.calls);
    expect(infoEvents).toHaveLength(2);
    expect(warnEvents).toHaveLength(0);
    expect(infoEvents[1]).toMatchObject({
      event: 'health.persistence.up',
      previous: 'down',
    });
    await app.close();
  });
});
