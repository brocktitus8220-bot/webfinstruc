"use client";
import { isCashAccount, type TransactionKind } from "@repo/core";
import { useShellState } from "@/components/shell/shell-state";
import { useApiQuery } from "./api";
import type { DateRange } from "./date-range";

export const useAccounts = () => useApiQuery(["accounts"], (api) => api.listAccounts());

/**
 * Cash accounts in the current workspace, plus the header selection
 * narrowed to those accounts. An empty or stale selection means all.
 */
export function useAccountScope() {
  const { accountSelection } = useShellState();
  const accounts = useAccounts();
  const cash = (accounts.data ?? []).filter(isCashAccount);
  const selected = accountSelection ? cash.filter((a) => accountSelection.includes(a.id)) : [];
  const effective = selected.length > 0 ? selected : cash;
  return {
    isLoading: accounts.isLoading,
    cashAccounts: cash,
    selectedAccounts: effective,
    isAll: effective.length === cash.length,
    /** Pass to API calls. Undefined means no account filter. */
    accountIds: effective.length === cash.length ? undefined : effective.map((a) => a.id),
  };
}

export function useTransactions(kind: TransactionKind, range?: DateRange) {
  const { accountIds, isLoading } = useAccountScope();
  const query = { kind, accountIds, from: range?.from, to: range?.to };
  return useApiQuery(["transactions", query], (api) => api.listTransactions({ query }), { enabled: !isLoading });
}

export function useMonthlyTotals(kind: "income" | "expense", months = 12) {
  const { accountIds, isLoading } = useAccountScope();
  const query = { kind, months, accountIds };
  return useApiQuery(["monthly", query], (api) => api.getMonthlyTotals({ query }), { enabled: !isLoading });
}

export function useBalanceHistory(days = 30) {
  const { accountIds, isLoading } = useAccountScope();
  const query = { days, accountIds };
  return useApiQuery(["balance-history", query], (api) => api.getBalanceHistory({ query }), { enabled: !isLoading });
}

export const useHoldings = (custodial: boolean) =>
  useApiQuery(["holdings", custodial], (api) => api.listHoldings({ query: { custodial } }));
export const useAllocationRules = () => useApiQuery(["allocation-rules"], (api) => api.getAllocationRules());
export const useTaxSettings = () => useApiQuery(["tax-settings"], (api) => api.getTaxSettings());
export const useOnboarding = () => useApiQuery(["onboarding"], (api) => api.getOnboarding());
export const useInvoices = () => useApiQuery(["invoices"], (api) => api.listInvoices());
export const useMe = () => useApiQuery(["me"], (api) => api.getMe());
export const useCreditCards = () => useApiQuery(["credit-cards"], (api) => api.listCreditCards());
