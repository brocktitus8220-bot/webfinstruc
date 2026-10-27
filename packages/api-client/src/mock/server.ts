import {
  type Account,
  type AllocationRules,
  type CreditCard,
  type CreditCardProfile,
  DEFAULT_ALLOCATION_RULES,
  DEFAULT_CREDIT_CARD_PROFILE,
  type Invoice,
  isCashAccount,
  isInvestmentAccount,
  type OnboardingState,
  type TaxSettings,
  type Transaction,
  type WorkspaceScope,
} from "@repo/core";
import type { EndpointName } from "../contract";
import { ApiError } from "../errors";
import type { ApiRequest, EndpointResponse, ParsedRequest, Transport } from "../types";
import { addDays, monthStart, startOfUtcDay, toIsoDate, toIsoMonth } from "./dates";
import { buildMockTransactions, MOCK_ACCOUNTS, MOCK_CARD_PROFILES, MOCK_HOLDINGS, MOCK_INVOICES, MOCK_TAX_PROFILE, MOCK_USER, MOCK_WORKSPACES } from "./fixtures";

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
  /** Card profiles the user edited, by account id. */
  cardProfiles: Record<string, CreditCardProfile>;
  /** Accounts created by statement imports. */
  importedAccounts: Account[];
  /** Statement row keys already imported, by account id, so re-imports skip them. */
  importedKeys: Record<string, string[]>;
  /** Balance corrections the user typed in, by account id. */
  balanceAdjustments: Record<string, number>;
}

const initialState = (): MutableState => ({
  onboarding: { completedAt: null },
  allocationRules: DEFAULT_ALLOCATION_RULES,
  createdTransactions: [],
  invoices: MOCK_INVOICES.map((i) => ({ ...i })),
  cardProfiles: {},
  importedAccounts: [],
  importedKeys: {},
  balanceAdjustments: {},
});

const plaidUnavailable = (endpoint: string): never => {
  throw new ApiError("Bank connections need the real API with Plaid keys. Sample mode cannot connect banks.", 503, endpoint);
};

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

  const allAccounts = () => [...MOCK_ACCOUNTS, ...state.importedAccounts];
  const accountsFor = (scope: WorkspaceScope) => allAccounts().filter((a) => inScope(scope, a.workspaceKind));

  const accountWithBalance = (a: Account): Account => {
    if (!isInvestmentAccount(a)) {
      const created = state.createdTransactions.filter((t) => t.accountId === a.id).reduce((s, t) => s + t.amountCents, 0);
      return { ...a, balanceCents: a.balanceCents + created + (state.balanceAdjustments[a.id] ?? 0) };
    }
    const value = MOCK_HOLDINGS.filter((h) => h.accountId === a.id).reduce((s, h) => s + h.marketValueCents, 0);
    return { ...a, balanceCents: value };
  };

  const toCreditCard = (a: Account): CreditCard => {
    const withBalance = accountWithBalance(a);
    return {
      accountId: a.id,
      workspaceId: a.workspaceId,
      workspaceKind: a.workspaceKind,
      name: a.name,
      institution: a.institution,
      mask: a.mask,
      connection: a.connection,
      balanceCents: withBalance.balanceCents,
      profile: state.cardProfiles[a.id] ?? MOCK_CARD_PROFILES[a.id] ?? DEFAULT_CREDIT_CARD_PROFILE,
    };
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
      const account = allAccounts().find((a) => a.id === body.accountId) ?? notFound("createTransaction", "Account");
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
      const account = h && allAccounts().find((a) => a.id === h.accountId);
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
      ...MOCK_TAX_PROFILE,
    }),

    listCreditCards: ({ workspace }) => accountsFor(workspace).filter((a) => a.type === "credit").map(toCreditCard),
    saveCreditCard: ({ params, body }) => {
      const account = allAccounts().find((a) => a.id === params.accountId && a.type === "credit") ?? notFound("saveCreditCard", "Credit card");
      const { owedCents, ...profile } = body;
      state.cardProfiles[account.id] = profile;
      if (owedCents !== undefined && account.connection !== "plaid") {
        const current = accountWithBalance(account).balanceCents;
        state.balanceAdjustments[account.id] = (state.balanceAdjustments[account.id] ?? 0) + (-owedCents - current);
      }
      persist();
      return toCreditCard(account);
    },
    importStatement: ({ body }) => {
      let account: Account;
      if (body.newAccount) {
        const kind = body.newAccount.workspaceKind;
        account = {
          id: `acc_m${Date.now().toString(36)}${state.importedAccounts.length}`,
          workspaceId: kind === "business" ? "ws_business" : "ws_personal",
          workspaceKind: kind,
          name: body.newAccount.name,
          institution: body.format === "apple_card" ? "Apple" : "Imported",
          type: "credit",
          connection: "csv",
          mask: body.newAccount.mask,
          balanceCents: 0,
          currency: "USD",
          custodian: null,
        };
        state.importedAccounts = [...state.importedAccounts, account];
        if (body.format === "apple_card") {
          state.cardProfiles[account.id] = { ...DEFAULT_CREDIT_CARD_PROFILE, ...MOCK_CARD_PROFILES.acc_apple_card!, creditLimitCents: null, statementDay: null, dueDay: null, aprBasisPoints: null };
        }
      } else {
        account = allAccounts().find((a) => a.id === body.accountId && a.type === "credit") ?? notFound("importStatement", "Credit card");
      }
      const seen = new Set(state.importedKeys[account.id] ?? []);
      const fresh = body.rows.filter((r) => !seen.has(r.externalId));
      const stamp = Date.now().toString(36);
      const created: Transaction[] = fresh.map((r, i) => ({
        id: `tx_i${stamp}${i}`,
        workspaceId: account.workspaceId,
        workspaceKind: account.workspaceKind,
        accountId: account.id,
        date: r.date,
        amountCents: r.amountCents,
        kind: r.kind,
        description: r.description,
        counterparty: r.counterparty,
        category: r.category,
        source: "csv",
        pending: false,
        notes: null,
      }));
      state.createdTransactions = [...created, ...state.createdTransactions];
      state.importedKeys[account.id] = [...seen, ...fresh.map((r) => r.externalId)];
      persist();
      return { accountId: account.id, inserted: fresh.length, skipped: body.rows.length - fresh.length };
    },

    getPlaidStatus: () => ({ enabled: false, environment: null }),
    createPlaidLinkToken: () => plaidUnavailable("createPlaidLinkToken"),
    exchangePlaidPublicToken: () => plaidUnavailable("exchangePlaidPublicToken"),
    listConnections: () => [],
    syncConnection: () => plaidUnavailable("syncConnection"),
    removeConnection: () => plaidUnavailable("removeConnection"),
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
