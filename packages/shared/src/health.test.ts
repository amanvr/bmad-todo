import { describe, expect, it } from 'vitest';
import { HealthResponseSchema } from './health.js';

describe('HealthResponseSchema', () => {
  it('accepts healthy with persistence up', () => {
    expect(() =>
      HealthResponseSchema.parse({ status: 'healthy', persistence: 'up' }),
    ).not.toThrow();
  });

  it('accepts unhealthy with persistence down', () => {
    expect(() =>
      HealthResponseSchema.parse({ status: 'unhealthy', persistence: 'down' }),
    ).not.toThrow();
  });

  it('accepts status only (persistence optional)', () => {
    expect(() => HealthResponseSchema.parse({ status: 'healthy' })).not.toThrow();
  });

  it('rejects unknown status', () => {
    expect(() => HealthResponseSchema.parse({ status: 'rotting' })).toThrow();
  });
});
