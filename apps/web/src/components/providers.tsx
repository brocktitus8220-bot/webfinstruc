"use client";
import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthedApiProvider } from "@/components/auth/auth-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } } }),
  );
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={300}>
          <AuthedApiProvider>{children}</AuthedApiProvider>
        </TooltipProvider>
        <Toaster position="bottom-right" theme="system" toastOptions={{ className: "text-sm" }} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
