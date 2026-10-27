"use client";
import * as React from "react";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { isClerkEnabled } from "@/lib/auth";
import { ApiProvider } from "@/lib/api";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (!isClerkEnabled) return <>{children}</>;
  return (
    <ClerkProvider signInUrl="/login" signUpUrl="/signup" afterSignOutUrl="/">
      {children}
    </ClerkProvider>
  );
}

function ClerkApiProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  return <ApiProvider getToken={() => getToken()}>{children}</ApiProvider>;
}

const noToken = () => null;

/** API client whose token comes from Clerk, or no token in demo mode. */
export function AuthedApiProvider({ children }: { children: React.ReactNode }) {
  return isClerkEnabled ? <ClerkApiProvider>{children}</ClerkApiProvider> : <ApiProvider getToken={noToken}>{children}</ApiProvider>;
}
