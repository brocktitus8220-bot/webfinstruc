"use client";
import * as React from "react";
import { toast } from "sonner";
import {
  CreateInvoiceInput, CreateTransactionInput, formatCurrency, InvoiceStatus, parseCurrencyToCents,
} from "@repo/core";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { useApiMutation } from "@/lib/api";
import { toIsoDate } from "@/lib/date-range";
import { fieldErrors } from "@/lib/forms";
import { useAccountScope } from "@/lib/queries";
import { useShellState } from "./shell-state";

const INCOME_CATEGORIES = ["Client services", "Sponsorship", "Platform payout", "Product sales", "Other income"];
const EXPENSE_CATEGORIES = ["Software", "Contractors", "Rent", "Meals", "Marketing", "Insurance", "Travel", "Equipment", "Other"];

export function QuickActionDialogs() {
  const { quickAction, openQuickAction } = useShellState();
  const close = () => openQuickAction(null);
  return (
    <>
      <Dialog open={quickAction === "income" || quickAction === "expense"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          {(quickAction === "income" || quickAction === "expense") && <TransactionForm kind={quickAction} onDone={close} />}
        </DialogContent>
      </Dialog>
      <Dialog open={quickAction === "invoice"} onOpenChange={(o) => !o && close()}>
        <DialogContent>{quickAction === "invoice" && <InvoiceForm onDone={close} />}</DialogContent>
      </Dialog>
    </>
  );
}

function TransactionForm({ kind, onDone }: { kind: "income" | "expense"; onDone: () => void }) {
  const { cashAccounts } = useAccountScope();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const mutation = useApiMutation((api, body: CreateTransactionInput) => api.createTransaction({ body }));
  const isIncome = kind === "income";

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) ?? "");
    const optional = (k: string) => str(k).trim() || undefined;
    const amountCents = parseCurrencyToCents(str("amount"));
    const parsed = CreateTransactionInput.safeParse({
      kind,
      accountId: str("accountId"),
      date: str("date"),
      amountCents: amountCents ?? Number.NaN,
      description: str("description"),
      counterparty: optional("counterparty"),
      category: str("category"),
      notes: optional("notes"),
    });
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      if (amountCents === null) errs.amountCents = "Enter an amount like 1250.00";
      setErrors(errs);
      return;
    }
    setErrors({});
    mutation.mutate(parsed.data, {
      onSuccess: (tx) => {
        toast.success(`${isIncome ? "Income" : "Expense"} added`, { description: `${tx.description}, ${formatCurrency(Math.abs(tx.amountCents))}` });
        onDone();
      },
      onError: (err) => toast.error("Could not save", { description: err.message }),
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogHeader>
        <DialogTitle>{isIncome ? "Add income" : "Add expense"}</DialogTitle>
        <DialogDescription>Saved as a manual entry in sample data. Nothing is written to a database yet.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <Field id="qa-amount" label="Amount" error={errors.amountCents}>
          <Input id="qa-amount" name="amount" inputMode="decimal" placeholder="0.00" autoFocus aria-invalid={!!errors.amountCents} />
        </Field>
        <Field id="qa-date" label="Date" error={errors.date}>
          <Input id="qa-date" name="date" type="date" defaultValue={toIsoDate(new Date())} aria-invalid={!!errors.date} />
        </Field>
        <div className="col-span-2">
          <Field id="qa-description" label="Description" error={errors.description}>
            <Input id="qa-description" name="description" placeholder={isIncome ? "Payment from client" : "Software subscription"} aria-invalid={!!errors.description} />
          </Field>
        </div>
        <Field id="qa-counterparty" label={isIncome ? "From" : "Paid to"} error={errors.counterparty}>
          <Input id="qa-counterparty" name="counterparty" placeholder="Optional" />
        </Field>
        <Field id="qa-category" label="Category" error={errors.category}>
          <NativeSelect id="qa-category" name="category" defaultValue={isIncome ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]}>
            {(isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => <option key={c}>{c}</option>)}
          </NativeSelect>
        </Field>
        <div className="col-span-2">
          <Field id="qa-account" label="Account" error={errors.accountId}>
            <NativeSelect id="qa-account" name="accountId" defaultValue={cashAccounts[0]?.id} aria-invalid={!!errors.accountId}>
              {cashAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} ···{a.mask}</option>)}
            </NativeSelect>
          </Field>
        </div>
        <div className="col-span-2">
          <Field id="qa-notes" label="Notes" error={errors.notes}>
            <Textarea id="qa-notes" name="notes" rows={2} placeholder="Optional" />
          </Field>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving" : isIncome ? "Add income" : "Add expense"}</Button>
      </DialogFooter>
    </form>
  );
}

function InvoiceForm({ onDone }: { onDone: () => void }) {
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const mutation = useApiMutation((api, body: CreateInvoiceInput) => api.createInvoice({ body }));
  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + 30);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) ?? "");
    const amountCents = parseCurrencyToCents(str("amount"));
    const parsed = CreateInvoiceInput.safeParse({
      client: str("client"),
      number: str("number"),
      issueDate: str("issueDate"),
      dueDate: str("dueDate"),
      amountCents: amountCents ?? Number.NaN,
      status: str("status"),
    });
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      if (amountCents === null) errs.amountCents = "Enter an amount like 1250.00";
      setErrors(errs);
      return;
    }
    setErrors({});
    mutation.mutate(parsed.data, {
      onSuccess: (inv) => {
        toast.success("Invoice logged", { description: `${inv.number} for ${inv.client}, ${formatCurrency(inv.amountCents)}` });
        onDone();
      },
      onError: (err) => toast.error("Could not save", { description: err.message }),
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogHeader>
        <DialogTitle>Log invoice</DialogTitle>
        <DialogDescription>Track an invoice you sent so expected income shows up in forecasts.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field id="inv-client" label="Client" error={errors.client}>
            <Input id="inv-client" name="client" autoFocus placeholder="Client name" aria-invalid={!!errors.client} />
          </Field>
        </div>
        <Field id="inv-number" label="Invoice number" error={errors.number}>
          <Input id="inv-number" name="number" defaultValue={`INV-${1000 + Math.floor((Date.now() / 1000) % 9000)}`} aria-invalid={!!errors.number} />
        </Field>
        <Field id="inv-amount" label="Amount" error={errors.amountCents}>
          <Input id="inv-amount" name="amount" inputMode="decimal" placeholder="0.00" aria-invalid={!!errors.amountCents} />
        </Field>
        <Field id="inv-issue" label="Issue date" error={errors.issueDate}>
          <Input id="inv-issue" name="issueDate" type="date" defaultValue={toIsoDate(today)} />
        </Field>
        <Field id="inv-due" label="Due date" error={errors.dueDate}>
          <Input id="inv-due" name="dueDate" type="date" defaultValue={toIsoDate(due)} aria-invalid={!!errors.dueDate} />
        </Field>
        <Field id="inv-status" label="Status" error={errors.status}>
          <NativeSelect id="inv-status" name="status" defaultValue="sent">
            {InvoiceStatus.options.map((s) => <option key={s} value={s}>{s[0]!.toUpperCase() + s.slice(1)}</option>)}
          </NativeSelect>
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving" : "Log invoice"}</Button>
      </DialogFooter>
    </form>
  );
}
