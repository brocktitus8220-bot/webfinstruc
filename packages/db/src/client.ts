import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import postgres from "postgres";
import * as schema from "./schema";

export type Schema = typeof schema;

/** Any Drizzle Postgres database with our schema (postgres-js in the app, PGlite in tests). */
export type Database = PgDatabase<PgQueryResultHKT, Schema>;
export type PostgresDatabase = PostgresJsDatabase<Schema>;

/** Create a Drizzle connection over postgres-js. */
export function createDb(url = process.env.DATABASE_URL): { db: PostgresDatabase; close: () => Promise<void> } {
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 10, prepare: false });
  return { db: drizzle(sql, { schema }), close: () => sql.end() };
}
