import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { DemoAuthCard } from "@/components/auth/demo-auth-card";
import { isClerkEnabled } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  if (!isClerkEnabled) return <DemoAuthCard mode="sign-in" />;
  return <SignIn routing="path" path="/login" signUpUrl="/signup" fallbackRedirectUrl="/app/overview" />;
}
