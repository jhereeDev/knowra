import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

export * from './schema';

let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb(connectionString?: string) {
  if (_db) return _db;
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required to initialize the database client');
  const client = postgres(url, { prepare: false });
  _db = drizzle(client, { schema });
  return _db;
}

export type Database = ReturnType<typeof getDb>;
