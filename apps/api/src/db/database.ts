import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** Anything that can run queries: the root database or an open transaction. */
export type Executor = Db | Tx;

export const DB = Symbol('DB');
export const PG_POOL = Symbol('PG_POOL');

export function createPool(url: string): pg.Pool {
  return new pg.Pool({ connectionString: url, max: 10 });
}

export function createDb(pool: pg.Pool): Db {
  return drizzle(pool, { schema });
}

export { schema };
