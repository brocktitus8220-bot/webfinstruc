import type { z } from "zod";
import type { WorkspaceScope } from "@repo/core";
import { contract, type EndpointDef, type EndpointName } from "./contract";
import type { ApiClient, ApiRequest, CallOptions, TokenProvider, Transport } from "./types";

export const WORKSPACE_HEADER = "x-workspace";

export interface ApiClientOptions {
  transport: Transport;
  /** Called before every request. Return null when signed out. */
  getToken: TokenProvider;
  /** Current workspace scope, sent with every request. */
  getWorkspace: () => WorkspaceScope;
}

const fillPath = (path: string, params: Record<string, unknown> | undefined) =>
  path.replace(/:([A-Za-z_]+)/g, (_, key: string) => {
    const value = params?.[key];
    if (value === undefined || value === null) throw new Error(`Missing path param: ${key}`);
    return encodeURIComponent(String(value));
  });

const parseOptional = (schema: z.ZodTypeAny | undefined, value: unknown) =>
  schema ? schema.parse(value) : undefined;

/**
 * Build a typed client from the contract. Inputs are validated before
 * sending and responses are validated before they reach the caller.
 */
export function createApiClient({ transport, getToken, getWorkspace }: ApiClientOptions): ApiClient {
  const client = {} as Record<EndpointName, (args?: Record<string, unknown>, options?: CallOptions) => Promise<unknown>>;

  for (const name of Object.keys(contract) as EndpointName[]) {
    const def: EndpointDef = contract[name];
    client[name] = async (args = {}, options = {}) => {
      const params = parseOptional(def.params, args.params) as Record<string, unknown> | undefined;
      const query = def.query ? def.query.parse(args.query ?? {}) : undefined;
      const body = parseOptional(def.body, args.body);
      const token = await getToken();
      const workspace = getWorkspace();
      const headers: Record<string, string> = { [WORKSPACE_HEADER]: workspace };
      if (token) headers.authorization = `Bearer ${token}`;

      const request = {
        endpoint: name,
        method: def.method,
        path: fillPath(def.path, params),
        params,
        query,
        body,
        headers,
        token,
        workspace,
        signal: options.signal,
      } as ApiRequest;

      const raw = await transport(request);
      return def.response.parse(raw);
    };
  }
  return client as unknown as ApiClient;
}
