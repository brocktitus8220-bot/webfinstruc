import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";
import { DemoAuthCard } from "@/components/auth/demo-auth-card";
import { isClerkEnabled } from "@/lib/auth";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  if (!isClerkEnabled) return <DemoAuthCard mode="sign-up" />;
  return <SignUp routing="path" path="/signup" signInUrl="/login" fallbackRedirectUrl="/onboarding/1" />;
}
