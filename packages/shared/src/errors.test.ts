import { describe, expect, it } from 'vitest';
import { ApiErrorSchema, ErrorCodeSchema } from './errors.js';

describe('ErrorCodeSchema', () => {
  it.each(['VALIDATION_FAILED', 'NOT_FOUND', 'INTERNAL_ERROR', 'PERSISTENCE_UNAVAILABLE'])(
    'accepts %s',
    (code) => {
      expect(() => ErrorCodeSchema.parse(code)).not.toThrow();
    },
  );

  it('rejects unknown code', () => {
    expect(() => ErrorCodeSchema.parse('FOO')).toThrow();
  });
});

describe('ApiErrorSchema', () => {
  it('accepts a minimal valid envelope inner', () => {
    expect(() =>
      ApiErrorSchema.parse({ code: 'VALIDATION_FAILED', message: 'bad input' }),
    ).not.toThrow();
  });

  it('accepts with optional details', () => {
    expect(() =>
      ApiErrorSchema.parse({
        code: 'NOT_FOUND',
        message: 'missing',
        details: { id: 'abc' },
      }),
    ).not.toThrow();
  });

  it('rejects empty message', () => {
    expect(() => ApiErrorSchema.parse({ code: 'INTERNAL_ERROR', message: '' })).toThrow();
  });

  it('rejects unknown code', () => {
    expect(() => ApiErrorSchema.parse({ code: 'BAD', message: 'x' })).toThrow();
  });
});
