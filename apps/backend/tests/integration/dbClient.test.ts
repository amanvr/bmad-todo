import { describe, expect, it, afterEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { closeDbClient, createDbClient } from '../../src/db/client.js';
import { runMigrations } from '../../src/db/migrate.js';
import { POSTGRES_TESTS_ENABLED, TEST_DATABASE_URL } from './setup.js';

describe.skipIf(!POSTGRES_TESTS_ENABLED)('db/client (integration)', () => {
  afterEach(async () => {
    await closeDbClient();
  });

  it('createDbClient returns a working db that can SELECT 1', async () => {
    const { db } = createDbClient(TEST_DATABASE_URL);
    const result = await db.execute(sql`SELECT 1 as one`);
    // node-postgres returns rows on the result object
    expect(result.rows[0]).toMatchObject({ one: 1 });
  });

  it('runMigrations is idempotent (second call does not reapply)', async () => {
    await runMigrations(TEST_DATABASE_URL);
    // Second call should succeed without error.
    await expect(runMigrations(TEST_DATABASE_URL)).resolves.toBeUndefined();
  });
});
