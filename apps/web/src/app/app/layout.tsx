import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AuthedApiProvider } from "@/components/auth/auth-provider";
import { AppShell } from "@/components/shell/app-shell";
import { ShellStateProvider } from "@/components/shell/shell-state";
import { parseWorkspace, SIDEBAR_COOKIE, WORKSPACE_COOKIE } from "@/lib/workspace";
import { WorkspaceProvider } from "@/lib/workspace-context";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const workspace = parseWorkspace(store.get(WORKSPACE_COOKIE)?.value);
  const collapsed = store.get(SIDEBAR_COOKIE)?.value === "true";
  return (
    <WorkspaceProvider initial={workspace}>
      <AuthedApiProvider>
        <ShellStateProvider>
          <AppShell initialCollapsed={collapsed}>{children}</AppShell>
        </ShellStateProvider>
      </AuthedApiProvider>
    </WorkspaceProvider>
  );
}
