import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  const validEnv = {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
    CORS_ORIGINS: 'http://localhost:8080',
    BACKEND_PORT: '3000',
    LOG_LEVEL: 'info',
  } as NodeJS.ProcessEnv;

  it('accepts a valid env', () => {
    const config = loadConfig(validEnv);
    expect(config.NODE_ENV).toBe('test');
    expect(config.DATABASE_URL).toBe('postgres://user:pass@localhost:5432/db');
    expect(config.CORS_ORIGINS).toBe('http://localhost:8080');
    expect(config.BACKEND_PORT).toBe(3000);
    expect(config.LOG_LEVEL).toBe('info');
  });

  it('rejects missing DATABASE_URL', () => {
    const env = { ...validEnv } as NodeJS.ProcessEnv;
    delete env.DATABASE_URL;
    expect(() => loadConfig(env)).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('rejects malformed BACKEND_PORT (non-numeric)', () => {
    const env = { ...validEnv, BACKEND_PORT: 'not-a-number' } as NodeJS.ProcessEnv;
    expect(() => loadConfig(env)).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('coerces BACKEND_PORT from string to number', () => {
    const config = loadConfig({ ...validEnv, BACKEND_PORT: '4000' } as NodeJS.ProcessEnv);
    expect(config.BACKEND_PORT).toBe(4000);
  });

  it('uses default values for optional fields', () => {
    const env = {
      DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
      CORS_ORIGINS: 'http://localhost:8080',
    } as NodeJS.ProcessEnv;
    const config = loadConfig(env);
    expect(config.NODE_ENV).toBe('development');
    expect(config.BACKEND_PORT).toBe(3000);
    expect(config.LOG_LEVEL).toBe('info');
  });
});
