import pg from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll } from 'vitest';
import * as schema from '../../src/db/schema.js';
import { runMigrations } from '../../src/db/migrate.js';

const { Pool } = pg;

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgres://bmad_todo:changeme_in_real_env@postgres:5432/bmad_todo';

/**
 * Postgres-required integration tests skip by default.
 * Opt in via `RUN_POSTGRES_TESTS=true npm run test:integration`.
 */
export const POSTGRES_TESTS_ENABLED = process.env.RUN_POSTGRES_TESTS === 'true';

let pool: pg.Pool | null = null;
export let testDb: NodePgDatabase<typeof schema> | null = null;

export function setupPostgresTestDb(): void {
  beforeAll(async () => {
    if (!POSTGRES_TESTS_ENABLED) return;
    pool = new Pool({ connectionString: TEST_DATABASE_URL });
    testDb = drizzle(pool, { schema });
    await runMigrations(TEST_DATABASE_URL);
  });

  afterEach(async () => {
    if (!POSTGRES_TESTS_ENABLED || !testDb) return;
    await testDb.execute(sql`TRUNCATE TABLE ${schema.todos} RESTART IDENTITY CASCADE`);
  });

  afterAll(async () => {
    if (!POSTGRES_TESTS_ENABLED || !pool) return;
    await pool.end();
    pool = null;
    testDb = null;
  });
}
