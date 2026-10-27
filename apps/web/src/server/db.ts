import "server-only";
import { createDb, type PostgresDatabase } from "@repo/db";

const globalForDb = globalThis as unknown as { __db?: PostgresDatabase };

/** One connection pool per server process, reused across hot reloads in dev. */
export function getDb(): PostgresDatabase | null {
  if (!process.env.DATABASE_URL) return null;
  globalForDb.__db ??= createDb(process.env.DATABASE_URL).db;
  return globalForDb.__db;
}
