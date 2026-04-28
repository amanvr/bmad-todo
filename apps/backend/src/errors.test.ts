import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  NotFoundError,
  InternalError,
  PersistenceUnavailableError,
} from './errors.js';

describe('error classes', () => {
  it('ValidationError carries VALIDATION_FAILED + 400', () => {
    const err = new ValidationError('bad input', { field: 'description' });
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('VALIDATION_FAILED');
    expect(err.httpStatus).toBe(400);
    expect(err.message).toBe('bad input');
    expect(err.details).toEqual({ field: 'description' });
  });

  it('NotFoundError carries NOT_FOUND + 404', () => {
    const err = new NotFoundError('Todo 123 not found');
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.httpStatus).toBe(404);
    expect(err.message).toBe('Todo 123 not found');
  });

  it('InternalError carries INTERNAL_ERROR + 500', () => {
    const err = new InternalError();
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.httpStatus).toBe(500);
    expect(err.message).toBe('Internal server error');
  });

  it('PersistenceUnavailableError carries PERSISTENCE_UNAVAILABLE + 503', () => {
    const err = new PersistenceUnavailableError();
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('PERSISTENCE_UNAVAILABLE');
    expect(err.httpStatus).toBe(503);
    expect(err.message).toBe('Persistence is unavailable');
  });
});
