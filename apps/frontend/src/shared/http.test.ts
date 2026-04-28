import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { httpRequest, HttpApiError } from './http.js';

describe('httpRequest', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns parsed body on 200', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: '1', description: 'hello' }),
    } as Response);

    const result = await httpRequest<{ id: string; description: string }>('/api/todos');
    expect(result).toEqual({ id: '1', description: 'hello' });
  });

  it('throws HttpApiError with parsed envelope on 4xx', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: { code: 'VALIDATION_FAILED', message: 'description required' },
      }),
    } as Response);

    await expect(httpRequest('/api/todos')).rejects.toMatchObject({
      apiError: {
        code: 'VALIDATION_FAILED',
        message: 'description required',
      },
      status: 400,
    });
  });

  it('throws HttpApiError with INTERNAL_ERROR on network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

    let caught: unknown;
    try {
      await httpRequest('/api/todos');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(HttpApiError);
    expect(caught).toMatchObject({
      apiError: { code: 'INTERNAL_ERROR' },
    });
  });

  it('returns undefined for 204 responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => {
        throw new Error('should not be called');
      },
    } as Response);

    const result = await httpRequest('/api/todos/abc');
    expect(result).toBeUndefined();
  });
});
