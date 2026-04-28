import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDbClient } from './client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations(databaseUrl: string): Promise<void> {
  const { db } = createDbClient(databaseUrl);
  // Resolve the drizzle/ folder relative to this file. Works in dev (src/db/migrate.ts)
  // and prod (dist/db/migrate.js) since both are 2 levels deep from the package root.
  const migrationsFolder = path.resolve(__dirname, '../../drizzle');
  await migrate(db, { migrationsFolder });
}

// Allow direct CLI invocation: `npm run db:migrate`
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[migrate] DATABASE_URL must be set to run migrations directly.');
    process.exit(1);
  }
  runMigrations(url)
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error('[migrate]', err);
      process.exit(1);
    });
}
