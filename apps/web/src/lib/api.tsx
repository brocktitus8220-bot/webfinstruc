"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ApiClient, createApiClient, createFetchTransport, type TokenProvider, type Transport } from "@repo/api-client";
import { createMockTransport } from "@repo/api-client/mock";
import { STORAGE_KEYS } from "./storage";
import { useWorkspace } from "./workspace-context";

/**
 * "mock" (default): sample data in the browser, no backend needed.
 * "http": the real API. Defaults to this app's own routes at /api/v1.
 */
export const API_MODE: "mock" | "http" = process.env.NEXT_PUBLIC_API_MODE === "http" ? "http" : "mock";

let sharedTransport: Transport | null = null;

/**
 * One transport per browser tab, so every client (app shell, onboarding)
 * sees the same mock state. On the server a fresh one is made per call.
 */
function getTransport(): Transport {
  if (typeof window === "undefined") return createTransport();
  sharedTransport ??= createTransport();
  return sharedTransport;
}

function createTransport(): Transport {
  if (API_MODE === "http") {
    return createFetchTransport(process.env.NEXT_PUBLIC_API_BASE_URL || "/api/v1");
  }
  return createMockTransport({
    storage: typeof window === "undefined" ? undefined : window.localStorage,
    storageKey: STORAGE_KEYS.mockApi,
    latencyMs: 120,
  });
}

const ApiContext = React.createContext<ApiClient | null>(null);

/**
 * Provides the API client. The client reads the workspace from the nearest
 * WorkspaceProvider, so the app shell mounts its own ApiProvider inside one.
 */
export function ApiProvider({ getToken, children }: { getToken: TokenProvider; children: React.ReactNode }) {
  const { workspace } = useWorkspace();
  const workspaceRef = React.useRef(workspace);
  workspaceRef.current = workspace;
  const tokenRef = React.useRef(getToken);
  tokenRef.current = getToken;

  const [client] = React.useState(() =>
    createApiClient({
      transport: getTransport(),
      getToken: () => tokenRef.current(),
      getWorkspace: () => workspaceRef.current,
    }),
  );
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiClient {
  const client = React.useContext(ApiContext);
  if (!client) throw new Error("useApi must be used inside ApiProvider");
  return client;
}

/** Query scoped to the current workspace, so switching refetches everything. */
export function useApiQuery<T>(key: readonly unknown[], fn: (api: ApiClient) => Promise<T>, options: { enabled?: boolean } = {}) {
  const api = useApi();
  const { workspace } = useWorkspace();
  return useQuery({ queryKey: [workspace, ...key], queryFn: () => fn(api), ...options });
}

export function useApiMutation<TVars, T>(fn: (api: ApiClient, vars: TVars) => Promise<T>) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: TVars) => fn(api, vars),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
