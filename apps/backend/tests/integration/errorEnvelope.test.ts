import { describe, it, expect } from 'vitest';
import { buildApp } from '../../src/app.js';
import type { Config } from '../../src/config.js';
import {
  AppError,
  NotFoundError,
  PersistenceUnavailableError,
  ValidationError,
} from '../../src/errors.js';

const validConfig: Config = {
  NODE_ENV: 'test',
  BACKEND_PORT: 3000,
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  CORS_ORIGINS: 'http://localhost:8080',
  LOG_LEVEL: 'silent' as Config['LOG_LEVEL'],
};

interface ErrorEnvelopeBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

function isErrorEnvelope(body: unknown): body is ErrorEnvelopeBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as { error: unknown }).error === 'object'
  );
}

describe('Error envelope shape (integration)', () => {
  it.each<[string, AppError, number, string]>([
    ['ValidationError', new ValidationError('bad'), 400, 'VALIDATION_FAILED'],
    ['NotFoundError', new NotFoundError('missing'), 404, 'NOT_FOUND'],
    [
      'PersistenceUnavailableError',
      new PersistenceUnavailableError('down'),
      503,
      'PERSISTENCE_UNAVAILABLE',
    ],
  ])('%s maps to envelope { code, message }', async (_name, errInstance, expectedStatus, code) => {
    const app = await buildApp(validConfig);
    app.get('/_test_throw', async () => {
      throw errInstance;
    });
    const res = await app.inject({ method: 'GET', url: '/_test_throw' });
    expect(res.statusCode).toBe(expectedStatus);
    const body: unknown = res.json();
    expect(isErrorEnvelope(body)).toBe(true);
    if (isErrorEnvelope(body)) {
      expect(body.error.code).toBe(code);
      expect(body.error.message).toBe(errInstance.message);
    }
    await app.close();
  });
});
