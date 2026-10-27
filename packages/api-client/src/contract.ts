import { z } from "zod";
import {
  Account,
  AllocationRules,
  BalancePoint,
  CreateInvoiceInput,
  CreateTransactionInput,
  Holding,
  Id,
  Invoice,
  IsoDate,
  MonthlyTotal,
  OnboardingState,
  TaxSettings,
  Transaction,
  TransactionKind,
  User,
  Workspace,
} from "@repo/core";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface EndpointDef {
  method: HttpMethod;
  /** Path with `:name` placeholders filled from `params`. */
  path: string;
  params?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  body?: z.ZodTypeAny;
  response: z.ZodTypeAny;
}

const define = <const E extends EndpointDef>(e: E) => e;

/** A list of ids that also accepts a single value (as a repeated query param would). */
const IdList = z.preprocess((v) => (typeof v === "string" ? [v] : v), z.array(Id));

/** A boolean that survives a query string: "false" must parse as false. */
const QueryBoolean = z.preprocess((v) => (v === "true" ? true : v === "false" ? false : v), z.boolean());

/**
 * The API contract. Every request and response shape comes from the Zod
 * schemas in @repo/core; the client and the mock server are derived from it.
 */
export const contract = {
  getMe: define({ method: "GET", path: "/me", response: User }),
  listWorkspaces: define({ method: "GET", path: "/workspaces", response: z.array(Workspace) }),
  listAccounts: define({ method: "GET", path: "/accounts", response: z.array(Account) }),

  listTransactions: define({
    method: "GET",
    path: "/transactions",
    query: z.object({
      kind: TransactionKind.optional(),
      accountIds: IdList.optional(),
      from: IsoDate.optional(),
      to: IsoDate.optional(),
    }),
    response: z.array(Transaction),
  }),
  getTransaction: define({
    method: "GET",
    path: "/transactions/:id",
    params: z.object({ id: Id }),
    response: Transaction,
  }),
  createTransaction: define({
    method: "POST",
    path: "/transactions",
    body: CreateTransactionInput,
    response: Transaction,
  }),

  listInvoices: define({ method: "GET", path: "/invoices", response: z.array(Invoice) }),
  createInvoice: define({ method: "POST", path: "/invoices", body: CreateInvoiceInput, response: Invoice }),

  getBalanceHistory: define({
    method: "GET",
    path: "/balances/history",
    query: z.object({
      days: z.coerce.number().int().min(1).max(366).default(30),
      accountIds: IdList.optional(),
    }),
    response: z.array(BalancePoint),
  }),
  getMonthlyTotals: define({
    method: "GET",
    path: "/reports/monthly",
    query: z.object({
      kind: z.enum(["income", "expense"]),
      months: z.coerce.number().int().min(1).max(36).default(12),
      accountIds: IdList.optional(),
    }),
    response: z.array(MonthlyTotal),
  }),

  listHoldings: define({
    method: "GET",
    path: "/holdings",
    query: z.object({ custodial: QueryBoolean.optional() }),
    response: z.array(Holding),
  }),
  getHolding: define({
    method: "GET",
    path: "/holdings/:id",
    params: z.object({ id: Id }),
    response: Holding,
  }),

  getOnboarding: define({ method: "GET", path: "/onboarding", response: OnboardingState }),
  saveOnboarding: define({
    method: "PATCH",
    path: "/onboarding",
    body: OnboardingState.partial(),
    response: OnboardingState,
  }),

  getAllocationRules: define({ method: "GET", path: "/allocation-rules", response: AllocationRules }),
  saveAllocationRules: define({
    method: "PUT",
    path: "/allocation-rules",
    body: AllocationRules,
    response: AllocationRules,
  }),

  getTaxSettings: define({ method: "GET", path: "/tax-settings", response: TaxSettings }),
} as const satisfies Record<string, EndpointDef>;

export type Contract = typeof contract;
export type EndpointName = keyof Contract;
