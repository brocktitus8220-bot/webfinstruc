import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { OnboardingProgress } from "@/features/onboarding/onboarding-progress";

export const metadata: Metadata = { title: "Get started", robots: { index: false } };

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-14 items-center justify-between border-b bg-surface px-4 lg:px-6">
        <Link href="/"><Logo /></Link>
        <div className="flex items-center gap-2">
          <Link href="/app/overview" className="text-xs text-muted-foreground hover:text-foreground">Skip to dashboard</Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-10">
        <OnboardingProgress />
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}
