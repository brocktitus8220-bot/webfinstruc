"use client";
import { UserButton } from "@clerk/nextjs";
import { isClerkEnabled } from "@/lib/auth";

export function UserMenu() {
  if (isClerkEnabled) return <UserButton appearance={{ elements: { avatarBox: "h-7 w-7" } }} />;
  return (
    <span
      title="Demo mode: add Clerk keys to enable sign-in"
      className="flex size-7 items-center justify-center rounded-full bg-accent text-2xs font-semibold text-accent-foreground"
    >
      AR
    </span>
  );
}
