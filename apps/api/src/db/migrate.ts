import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb, createPool } from './database.js';

export const MIGRATIONS_FOLDER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle');

export async function runMigrations(databaseUrl: string): Promise<void> {
  const pool = createPool(databaseUrl);
  try {
    await migrate(createDb(pool), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  runMigrations(url)
    .then(() => console.log('Migrations applied'))
    .catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    });
}
