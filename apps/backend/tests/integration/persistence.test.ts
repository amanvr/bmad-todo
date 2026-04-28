import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../../src/db/schema.js';
import { runMigrations } from '../../src/db/migrate.js';
import { PostgresTodoRepository } from '../../src/repositories/postgresTodoRepository.js';
import { POSTGRES_TESTS_ENABLED, TEST_DATABASE_URL } from './setup.js';

const { Pool } = pg;

describe.skipIf(!POSTGRES_TESTS_ENABLED)('persistence - pool teardown survival', () => {
  beforeAll(async () => {
    await runMigrations(TEST_DATABASE_URL);
    const pool = new Pool({ connectionString: TEST_DATABASE_URL });
    const db = drizzle(pool, { schema });
    await db.execute(sql`TRUNCATE TABLE ${schema.todos} RESTART IDENTITY CASCADE`);
    await pool.end();
  });

  beforeEach(async () => {
    const pool = new Pool({ connectionString: TEST_DATABASE_URL });
    const db = drizzle(pool, { schema });
    await db.execute(sql`TRUNCATE TABLE ${schema.todos} RESTART IDENTITY CASCADE`);
    await pool.end();
  });

  it('rows survive pool teardown + recreation', async () => {
    const pool1 = new Pool({ connectionString: TEST_DATABASE_URL });
    const db1 = drizzle(pool1, { schema });
    const repo1 = new PostgresTodoRepository(db1);
    const created = await repo1.create({ description: 'survives restart' }, 'default-user');
    await pool1.end();

    const pool2 = new Pool({ connectionString: TEST_DATABASE_URL });
    const db2 = drizzle(pool2, { schema });
    const repo2 = new PostgresTodoRepository(db2);
    const list = await repo2.list('default-user');
    await pool2.end();

    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(created.id);
    expect(list[0]?.description).toBe('survives restart');
  });

  it('multiple rows persist across pool recreation', async () => {
    const pool1 = new Pool({ connectionString: TEST_DATABASE_URL });
    const db1 = drizzle(pool1, { schema });
    const repo1 = new PostgresTodoRepository(db1);
    await db1.execute(sql`TRUNCATE TABLE ${schema.todos} RESTART IDENTITY CASCADE`);
    await repo1.create({ description: 'one' }, 'default-user');
    await repo1.create({ description: 'two' }, 'default-user');
    await repo1.create({ description: 'three' }, 'default-user');
    await pool1.end();

    const pool2 = new Pool({ connectionString: TEST_DATABASE_URL });
    const db2 = drizzle(pool2, { schema });
    const repo2 = new PostgresTodoRepository(db2);
    const list = await repo2.list('default-user');
    await pool2.end();

    expect(list).toHaveLength(3);
    expect(list.map((todo) => todo.description).sort()).toEqual(['one', 'three', 'two']);
  });
});
