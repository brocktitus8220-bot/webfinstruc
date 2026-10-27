import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

/**
 * Create a Drizzle connection. Nothing in the app calls this yet; the web
 * app runs on mock data behind the API client.
 */
export function createDb(url = process.env.DATABASE_URL): { db: Database; close: () => Promise<void> } {
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 10, prepare: false });
  return { db: drizzle(sql, { schema }), close: () => sql.end() };
}
