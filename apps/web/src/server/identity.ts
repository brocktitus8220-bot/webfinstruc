import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { MOCK_USER } from "@repo/api-client/mock";
import type { Identity } from "@repo/api-server";
import { isClerkEnabled } from "@/lib/auth";

/**
 * Who is calling the API. With Clerk, the signed-in user (from the session
 * cookie or the bearer token the API client sends). In demo mode, the demo user.
 * Returns null when Clerk is on and nobody is signed in.
 */
export async function getUserId(): Promise<string | null> {
  if (!isClerkEnabled) return MOCK_USER.id;
  const { userId } = await auth();
  return userId;
}

/** Profile details used the first time a user reaches the API. */
export async function getIdentity(userId: string): Promise<Identity> {
  if (!isClerkEnabled) return { id: MOCK_USER.id, email: MOCK_USER.email, name: MOCK_USER.name };
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress ?? `${userId}@users.invalid`;
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || email.split("@")[0]!;
  return { id: userId, email, name };
}
