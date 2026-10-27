import { WorkspaceScope } from "@repo/core";

export const WORKSPACE_COOKIE = "workspace";
export const SIDEBAR_COOKIE = "sidebar_collapsed";

export const WORKSPACE_OPTIONS: { value: WorkspaceScope; label: string; description: string }[] = [
  { value: "business", label: "Business", description: "Business accounts only" },
  { value: "personal", label: "Personal", description: "Personal accounts only" },
  { value: "all", label: "All", description: "Everything combined" },
];

export function parseWorkspace(value: string | undefined | null): WorkspaceScope {
  const parsed = WorkspaceScope.safeParse(value);
  return parsed.success ? parsed.data : "all";
}
