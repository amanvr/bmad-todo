import pg from 'pg';
import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

const { Pool } = pg;

export type Database = NodePgDatabase<typeof schema>;
export type PersistenceProbeResult = { status: 'up' } | { status: 'down'; error: string };

let pool: pg.Pool | null = null;
let db: Database | null = null;

export function createDbClient(databaseUrl: string): { pool: pg.Pool; db: Database } {
  if (pool && db) return { pool, db };
  pool = new Pool({ connectionString: databaseUrl });
  // Prevent process crashes when idle pooled clients emit connection errors.
  pool.on('error', (error) => {
    console.warn('[db] pool error observed', error);
  });
  db = drizzle(pool, { schema });
  return { pool, db };
}

export async function closeDbClient(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}

export async function probePersistence(dbClient: Database): Promise<PersistenceProbeResult> {
  try {
    await dbClient.execute(sql`SELECT 1`);
    return { status: 'up' };
  } catch (error) {
    return {
      status: 'down',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
