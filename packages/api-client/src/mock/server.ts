import {
  type Account,
  type AllocationRules,
  DEFAULT_ALLOCATION_RULES,
  type Invoice,
  isCashAccount,
  type OnboardingState,
  type TaxSettings,
  type Transaction,
  type WorkspaceScope,
} from "@repo/core";
import type { EndpointName } from "../contract";
import { ApiError } from "../errors";
import type { ApiRequest, EndpointResponse, ParsedRequest, Transport } from "../types";
import { addDays, monthStart, startOfUtcDay, toIsoDate, toIsoMonth } from "./dates";
import { buildMockTransactions, MOCK_ACCOUNTS, MOCK_HOLDINGS, MOCK_USER, MOCK_WORKSPACES } from "./fixtures";

/** Matches the subset of the Web Storage API the mock needs. */
export interface MockStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface MockTransportOptions {
  /** Persist user-entered mock state (onboarding, new transactions). */
  storage?: MockStorage;
  storageKey?: string;
  /** Fake network delay, in ms. */
  latencyMs?: number;
  now?: () => Date;
}

/** State the user can change. Everything else is generated. */
interface MutableState {
  onboarding: OnboardingState;
  allocationRules: AllocationRules;
  createdTransactions: Transaction[];
  invoices: Invoice[];
}

const initialState = (): MutableState => ({
  onboarding: { completedAt: null },
  allocationRules: DEFAULT_ALLOCATION_RULES,
  createdTransactions: [],
  invoices: [
    { id: "inv_1001", workspaceId: "ws_business", number: "INV-1001", client: "Northwind Studio", issueDate: "2026-09-02", dueDate: "2026-10-02", amountCents: 480_000, status: "paid", paidDate: "2026-09-28" },
    { id: "inv_1002", workspaceId: "ws_business", number: "INV-1002", client: "Juniper Labs", issueDate: "2026-09-20", dueDate: "2026-10-20", amountCents: 315_000, status: "overdue", paidDate: null },
    { id: "inv_1003", workspaceId: "ws_business", number: "INV-1003", client: "Atlas & Co.", issueDate: "2026-10-10", dueDate: "2026-11-09", amountCents: 620_000, status: "sent", paidDate: null },
  ],
});

type Handlers = {
  [N in EndpointName]: (req: ParsedRequest<N> & { workspace: WorkspaceScope }) => EndpointResponse<N> | Promise<EndpointResponse<N>>;
};

const inScope = (scope: WorkspaceScope, kind: "business" | "personal") => scope === "all" || scope === kind;

export function createMockTransport(options: MockTransportOptions = {}): Transport {
  const { storage, storageKey = "mock-api:v1", latencyMs = 0, now = () => new Date() } = options;

  let state: MutableState = initialState();
  if (storage) {
    try {
      const saved = storage.getItem(storageKey);
      if (saved) state = { ...state, ...(JSON.parse(saved) as Partial<MutableState>) };
    } catch {
      // Ignore corrupt or unavailable storage and start fresh.
    }
  }
  const persist = () => {
    try {
      storage?.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Storage can be full or blocked. Mock state stays in memory.
    }
  };

  let generated: { day: string; transactions: Transaction[] } | null = null;
  const allTransactions = () => {
    const day = toIsoDate(now());
    if (generated?.day !== day) generated = { day, transactions: buildMockTransactions(now()) };
    return [...state.createdTransactions, ...generated.transactions];
  };

  const accountsFor = (scope: WorkspaceScope) => MOCK_ACCOUNTS.filter((a) => inScope(scope, a.workspaceKind));

  const accountWithBalance = (a: Account): Account => {
    if (isCashAccount(a)) {
      const created = state.createdTransactions.filter((t) => t.accountId === a.id).reduce((s, t) => s + t.amountCents, 0);
      return { ...a, balanceCents: a.balanceCents + created };
    }
    const value = MOCK_HOLDINGS.filter((h) => h.accountId === a.id).reduce((s, h) => s + h.marketValueCents, 0);
    return { ...a, balanceCents: value };
  };

  const selectedCashAccounts = (scope: WorkspaceScope, ids: string[] | undefined) =>
    accountsFor(scope).filter((a) => isCashAccount(a) && (!ids || ids.includes(a.id)));

  const notFound = (endpoint: string, what: string): never => {
    throw new ApiError(`${what} not found`, 404, endpoint);
  };

  const handlers: Handlers = {
    getMe: () => ({ ...MOCK_USER, userType: state.onboarding.userType ?? null }),
    listWorkspaces: () => MOCK_WORKSPACES,
    listAccounts: ({ workspace }) => accountsFor(workspace).map(accountWithBalance),

    listTransactions: ({ workspace, query }) =>
      allTransactions().filter(
        (t) =>
          inScope(workspace, t.workspaceKind) &&
          (!query.kind || t.kind === query.kind) &&
          (!query.accountIds || query.accountIds.includes(t.accountId)) &&
          (!query.from || t.date >= query.from) &&
          (!query.to || t.date <= query.to),
      ),
    getTransaction: ({ params, workspace }) => {
      const tx = allTransactions().find((t) => t.id === params.id);
      return tx && inScope(workspace, tx.workspaceKind) ? tx : notFound("getTransaction", "Transaction");
    },
    createTransaction: ({ body }) => {
      const account = MOCK_ACCOUNTS.find((a) => a.id === body.accountId) ?? notFound("createTransaction", "Account");
      const tx: Transaction = {
        id: `tx_m${Date.now().toString(36)}${state.createdTransactions.length}`,
        workspaceId: account.workspaceId,
        workspaceKind: account.workspaceKind,
        accountId: account.id,
        date: body.date,
        amountCents: body.kind === "income" ? body.amountCents : -body.amountCents,
        kind: body.kind,
        description: body.description,
        counterparty: body.counterparty ?? null,
        category: body.category,
        source: "manual",
        pending: false,
        notes: body.notes ?? null,
      };
      state.createdTransactions = [tx, ...state.createdTransactions];
      persist();
      return tx;
    },

    listInvoices: ({ workspace }) => (inScope(workspace, "business") ? state.invoices : []),
    createInvoice: ({ body }) => {
      const invoice: Invoice = {
        id: `inv_m${Date.now().toString(36)}`,
        workspaceId: "ws_business",
        ...body,
        paidDate: body.status === "paid" ? body.issueDate : null,
      };
      state.invoices = [invoice, ...state.invoices];
      persist();
      return invoice;
    },

    getBalanceHistory: ({ workspace, query }) => {
      const accounts = selectedCashAccounts(workspace, query.accountIds);
      const ids = new Set(accounts.map((a) => a.id));
      const current = accounts.map(accountWithBalance).reduce((s, a) => s + a.balanceCents, 0);
      const txs = allTransactions().filter((t) => ids.has(t.accountId));
      const today = startOfUtcDay(now());
      const points = [];
      // Walk backwards: balance at end of day D = current minus everything after D.
      let after = 0;
      const byDate = new Map<string, number>();
      for (const t of txs) byDate.set(t.date, (byDate.get(t.date) ?? 0) + t.amountCents);
      for (const [date, amount] of byDate) if (date > toIsoDate(today)) after += amount;
      for (let i = 0; i < query.days; i++) {
        const date = toIsoDate(addDays(today, -i));
        points.push({ date, balanceCents: current - after });
        after += byDate.get(date) ?? 0;
      }
      return points.reverse();
    },

    getMonthlyTotals: ({ workspace, query }) => {
      const today = startOfUtcDay(now());
      const ids = query.accountIds ? new Set(query.accountIds) : null;
      const totals = new Map<string, number>();
      // Complete months only, oldest first.
      for (let i = query.months; i >= 1; i--) totals.set(toIsoMonth(monthStart(today, -i)), 0);
      for (const t of allTransactions()) {
        if (t.kind !== query.kind || !inScope(workspace, t.workspaceKind)) continue;
        if (ids && !ids.has(t.accountId)) continue;
        const month = t.date.slice(0, 7);
        if (totals.has(month)) totals.set(month, totals.get(month)! + Math.abs(t.amountCents));
      }
      return [...totals].map(([month, amountCents]) => ({ month, amountCents }));
    },

    listHoldings: ({ workspace, query }) => {
      const accounts = accountsFor(workspace).filter((a) => query.custodial === undefined || (a.custodian !== null) === query.custodial);
      const ids = new Set(accounts.map((a) => a.id));
      return MOCK_HOLDINGS.filter((h) => ids.has(h.accountId));
    },
    getHolding: ({ params, workspace }) => {
      const h = MOCK_HOLDINGS.find((x) => x.id === params.id);
      const account = h && MOCK_ACCOUNTS.find((a) => a.id === h.accountId);
      return h && account && inScope(workspace, account.workspaceKind) ? h : notFound("getHolding", "Holding");
    },

    getOnboarding: () => state.onboarding,
    saveOnboarding: ({ body }) => {
      state.onboarding = { ...state.onboarding, ...body };
      if (body.allocationRules) state.allocationRules = body.allocationRules;
      persist();
      return state.onboarding;
    },

    getAllocationRules: () => state.allocationRules,
    saveAllocationRules: ({ body }) => {
      state.allocationRules = body;
      persist();
      return body;
    },

    getTaxSettings: (): TaxSettings => ({
      taxYear: now().getUTCFullYear(),
      filingStatus: state.onboarding.filingStatus ?? "single",
      state: state.onboarding.state ?? "CA",
      estimatedEffectiveRatePercent: 28,
      priorYearTotalTaxCents: 3_120_000,
      priorYearAgiCents: 11_850_000,
      safeHarborMethod: "prior_year_110",
    }),
  };

  return async (request: ApiRequest) => {
    if (latencyMs > 0) await new Promise((r) => setTimeout(r, latencyMs));
    if (request.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const handler = handlers[request.endpoint] as (req: unknown) => unknown;
    // Round-trip through JSON so callers never share references with mock state.
    const result = await handler({ ...request, workspace: request.workspace });
    return JSON.parse(JSON.stringify(result)) as unknown;
  };
}

/** Clear persisted mock state (used by Settings > Data). */
export function resetMockStorage(storage: MockStorage, storageKey = "mock-api:v1") {
  storage.removeItem?.(storageKey);
}
