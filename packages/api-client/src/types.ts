import type { z } from "zod";
import type { WorkspaceScope } from "@repo/core";
import type { Contract, EndpointName, HttpMethod } from "./contract";

type ParamsArg<E> = E extends { params: infer S extends z.ZodTypeAny } ? { params: z.input<S> } : unknown;
type QueryArg<E> = E extends { query: infer S extends z.ZodTypeAny } ? { query?: z.input<S> } : unknown;
type BodyArg<E> = E extends { body: infer S extends z.ZodTypeAny } ? { body: z.input<S> } : unknown;

export type EndpointArgs<N extends EndpointName> = ParamsArg<Contract[N]> & QueryArg<Contract[N]> & BodyArg<Contract[N]>;
export type EndpointResponse<N extends EndpointName> = z.output<Contract[N]["response"]>;

/** Parsed (output) shapes, as the server side of a transport sees them. */
type Parsed<E, K extends string> = E extends { [P in K]: infer S extends z.ZodTypeAny } ? z.output<S> : undefined;
export interface ParsedRequest<N extends EndpointName> {
  params: Parsed<Contract[N], "params">;
  query: Parsed<Contract[N], "query">;
  body: Parsed<Contract[N], "body">;
}

export interface CallOptions {
  signal?: AbortSignal;
}

/** Everything a transport needs to perform one call. */
export interface ApiRequest<N extends EndpointName = EndpointName> extends ParsedRequest<N> {
  endpoint: N;
  method: HttpMethod;
  /** Path with params filled in, for example /transactions/tx_1. */
  path: string;
  headers: Record<string, string>;
  token: string | null;
  workspace: WorkspaceScope;
  signal?: AbortSignal;
}

/** Sends a request and resolves with the raw (unvalidated) response body. */
export type Transport = (request: ApiRequest) => Promise<unknown>;

/** Returns the current auth token. Web uses Clerk; a native app can plug in its own. */
export type TokenProvider = () => string | null | Promise<string | null>;

export type ApiClient = {
  [N in EndpointName]: {} extends EndpointArgs<N>
    ? (args?: EndpointArgs<N>, options?: CallOptions) => Promise<EndpointResponse<N>>
    : (args: EndpointArgs<N>, options?: CallOptions) => Promise<EndpointResponse<N>>;
};
