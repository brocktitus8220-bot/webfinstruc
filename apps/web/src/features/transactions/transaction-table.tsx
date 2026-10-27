"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { createColumnHelper } from "@tanstack/react-table";
import type { Account, Transaction } from "@repo/core";
import { DataTable } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import { formatDate, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { sourceLabel, SourceBadge } from "./source-badge";

type Row = Transaction & { accountName: string; sourceLabel: string; status: string };
const col = createColumnHelper<Row>();

export function TransactionTable({ kind, transactions, accounts, isLoading }: { kind: "income" | "expense"; transactions: Transaction[]; accounts: Account[]; isLoading: boolean }) {
  const router = useRouter();
  const accountNames = React.useMemo(() => new Map(accounts.map((a) => [a.id, `${a.name} ···${a.mask}`])), [accounts]);
  const rows = React.useMemo<Row[]>(
    () =>
      transactions.map((t) => ({
        ...t,
        accountName: accountNames.get(t.accountId) ?? t.accountId,
        sourceLabel: sourceLabel(t.source),
        status: t.pending ? "Pending" : "Cleared",
      })),
    [transactions, accountNames],
  );

  const columns = React.useMemo(
    () => [
      col.accessor("date", { header: "Date", meta: { label: "Date" }, cell: (c) => <span className="text-muted-foreground">{formatDate(c.getValue())}</span> }),
      col.accessor("description", {
        header: "Description",
        meta: { label: "Description" },
        enableHiding: false,
        cell: (c) => <span className="font-medium">{c.getValue()}</span>,
      }),
      col.accessor((r) => r.counterparty ?? "", { id: "counterparty", header: kind === "income" ? "Payer" : "Payee", meta: { label: kind === "income" ? "Payer" : "Payee" }, cell: (c) => c.getValue() || <span className="text-muted-foreground">None</span> }),
      col.accessor("category", { header: "Category", meta: { label: "Category", facet: true }, filterFn: "arrIncludesSome" }),
      col.accessor("accountName", { header: "Account", meta: { label: "Account", facet: true }, filterFn: "arrIncludesSome", cell: (c) => <span className="text-muted-foreground">{c.getValue()}</span> }),
      col.accessor("sourceLabel", { header: "Source", meta: { label: "Source", facet: true }, filterFn: "arrIncludesSome", cell: (c) => <SourceBadge source={c.row.original.source} /> }),
      col.accessor("status", {
        header: "Status",
        meta: { label: "Status", facet: true },
        filterFn: "arrIncludesSome",
        cell: (c) => <Badge variant={c.getValue() === "Pending" ? "warning" : "default"}>{c.getValue()}</Badge>,
      }),
      col.accessor("amountCents", {
        header: "Amount",
        meta: { label: "Amount", align: "right" },
        enableHiding: false,
        cell: (c) => (
          <span className={cn("font-medium tabular", c.getValue() > 0 ? "text-positive" : "text-foreground")}>
            {c.getValue() > 0 ? "+" : ""}{money(c.getValue())}
          </span>
        ),
      }),
    ],
    [kind],
  );

  return (
    <DataTable
      tableId={kind}
      columns={columns}
      data={rows}
      isLoading={isLoading}
      onRowClick={(r) => router.push(`/app/${kind === "income" ? "income" : "expenses"}/${r.id}`)}
      searchPlaceholder={kind === "income" ? "Search income" : "Search expenses"}
      defaultSorting={[{ id: "date", desc: true }]}
      defaultVisibility={{ status: false }}
      emptyMessage={`No ${kind} in this range.`}
    />
  );
}
