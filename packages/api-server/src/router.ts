import { ZodError } from "zod";
import { WorkspaceScope } from "@repo/core";
import { contract, type EndpointDef, type EndpointName, type HttpMethod, WORKSPACE_HEADER } from "@repo/api-client";
import type { Database } from "@repo/db";
import { HttpError } from "./errors";
import { type HandlerContext, handlers } from "./handlers";

export interface ApiHttpRequest {
  method: string;
  /** Path below the API base, for example `/transactions/tx_1`. */
  path: string;
  searchParams: URLSearchParams;
  headers: Headers;
  /** Parsed JSON body, or undefined when there is none. */
  body: unknown;
}

export interface ApiHttpResponse {
  status: number;
  body: unknown;
}

interface Route {
  name: EndpointName;
  def: EndpointDef;
  pattern: RegExp;
  keys: string[];
}

const routes: Route[] = (Object.keys(contract) as EndpointName[]).map((name) => {
  const def: EndpointDef = contract[name];
  const keys: string[] = [];
  const source = def.path.replace(/:([A-Za-z_]+)/g, (_, key: string) => {
    keys.push(key);
    return "([^/]+)";
  });
  return { name, def, keys, pattern: new RegExp(`^${source}/?$`) };
});

/** Repeated keys become arrays; single keys stay strings. */
export function searchParamsToObject(search: URLSearchParams): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(search.keys())) {
    const values = search.getAll(key);
    out[key] = values.length > 1 ? values : values[0]!;
  }
  return out;
}

function match(method: string, path: string) {
  let pathMatched = false;
  for (const route of routes) {
    const m = route.pattern.exec(path);
    if (!m) continue;
    pathMatched = true;
    if (route.def.method !== (method.toUpperCase() as HttpMethod)) continue;
    const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1]!)]));
    return { route, params };
  }
  throw pathMatched ? new HttpError(405, "Method not allowed") : new HttpError(404, "Not found");
}

export interface DispatchOptions {
  db: Database;
  userId: string;
  now?: Date;
}

/**
 * Run one API call: match the route from the contract, validate params,
 * query, and body with the same Zod schemas the client uses, call the
 * handler, and validate the response before it leaves the server.
 */
export async function dispatch(req: ApiHttpRequest, { db, userId, now = new Date() }: DispatchOptions): Promise<ApiHttpResponse> {
  try {
    const { route, params } = match(req.method, req.path);
    const { def } = route;
    const workspace = WorkspaceScope.catch("all").parse(req.headers.get(WORKSPACE_HEADER) ?? "all");
    const parsed = {
      params: def.params ? def.params.parse(params) : undefined,
      query: def.query ? def.query.parse(searchParamsToObject(req.searchParams)) : undefined,
      body: def.body ? def.body.parse(req.body) : undefined,
    };
    const ctx: HandlerContext = { db, userId, workspace, now };
    const handler = handlers[route.name] as (r: typeof parsed, c: HandlerContext) => Promise<unknown>;
    const result = await handler(parsed, ctx);
    return { status: def.method === "POST" ? 201 : 200, body: def.response.parse(result) };
  } catch (error) {
    return toErrorResponse(error);
  }
}

export function toErrorResponse(error: unknown): ApiHttpResponse {
  if (error instanceof HttpError) {
    return { status: error.status, body: { message: error.message, details: error.details } };
  }
  if (error instanceof ZodError) {
    return { status: 400, body: { message: "Invalid request", details: error.flatten() } };
  }
  console.error("[api] unhandled error", error);
  return { status: 500, body: { message: "Internal server error" } };
}
