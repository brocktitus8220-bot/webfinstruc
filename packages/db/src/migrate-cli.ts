import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "./client";
import { MIGRATIONS_FOLDER } from "./migrate";

/** Apply pending migrations to DATABASE_URL. Run with `pnpm db:migrate`. */
const { db, close } = createDb();
try {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  console.log("Migrations applied.");
} finally {
  await close();
}
