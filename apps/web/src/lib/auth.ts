/**
 * Clerk runs when its keys are present. Without them the app runs in demo
 * mode: no sign-in, a mock user, and mock data. This keeps local setup and
 * CI builds working before Clerk is configured.
 */
export const isClerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
