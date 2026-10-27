"use client";
import * as React from "react";
import type { WorkspaceScope } from "@repo/core";
import { WORKSPACE_COOKIE } from "./workspace";

interface WorkspaceContextValue {
  workspace: WorkspaceScope;
  setWorkspace: (next: WorkspaceScope) => void;
}

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(null);

/**
 * Workspace scope lives in a cookie so the server can read it on first
 * render and the choice survives reloads. Every API call reads it.
 */
export function WorkspaceProvider({ initial, children }: { initial: WorkspaceScope; children: React.ReactNode }) {
  const [workspace, setState] = React.useState<WorkspaceScope>(initial);
  const setWorkspace = React.useCallback((next: WorkspaceScope) => {
    document.cookie = `${WORKSPACE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setState(next);
  }, []);
  const value = React.useMemo(() => ({ workspace, setWorkspace }), [workspace, setWorkspace]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = React.useContext(WorkspaceContext);
  // Outside the app shell (onboarding, marketing) everything is in scope.
  return ctx ?? { workspace: "all", setWorkspace: () => {} };
}
