import { describe, expect, it, vi } from 'vitest';
import { probePersistence, type Database } from './client.js';

describe('probePersistence', () => {
  it('returns up when SELECT 1 succeeds', async () => {
    const db = {
      execute: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as Database;

    const result = await probePersistence(db);

    expect(result).toEqual({ status: 'up' });
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  it('returns down and error message when query fails', async () => {
    const db = {
      execute: vi.fn().mockRejectedValue(new Error('connection refused')),
    } as unknown as Database;

    const result = await probePersistence(db);

    expect(result).toEqual({ status: 'down', error: 'connection refused' });
    expect(db.execute).toHaveBeenCalledTimes(1);
  });
});
