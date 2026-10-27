import { MOCK_USER } from "@repo/api-client/mock";
import { createDb } from "@repo/db";
import { ensureUser } from "./provision";
import { seedSampleData } from "./seed";

/**
 * Load sample data for one user. Defaults to the demo-mode user.
 * Usage: pnpm db:seed [userId]
 */
const userId = process.argv[2] ?? MOCK_USER.id;
const { db, close } = createDb();
try {
  await ensureUser(db, userId === MOCK_USER.id ? MOCK_USER : { id: userId, email: `${userId}@example.com`, name: "Sample user" });
  const seeded = await seedSampleData(db, userId);
  console.log(seeded ? `Seeded sample data for ${userId}.` : `${userId} already has accounts; nothing to do.`);
} finally {
  await close();
}
