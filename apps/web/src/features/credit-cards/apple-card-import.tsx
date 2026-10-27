"use client";
import * as React from "react";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import { type CreditCard, parseAppleCardCsv, type StatementRow, type WorkspaceKind } from "@repo/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { useApiMutation } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useWorkspace } from "@/lib/workspace-context";

interface Parsed {
  files: string[];
  rows: StatementRow[];
  errors: string[];
}

/**
 * Apple Card has no web API: Apple only shares card data with iPhone apps
 * (FinanceKit), and Plaid's Apple Card support runs through that iPhone path.
 * Apple does let you export each monthly statement as CSV from card.apple.com,
 * so that is the web route. Files are read in the browser; only the parsed
 * rows are sent.
 */
export function AppleCardImport({ cards }: { cards: CreditCard[] }) {
  const { workspace } = useWorkspace();
  const appleCards = cards.filter((c) => c.institution === "Apple" || /apple/i.test(c.name));
  const [parsed, setParsed] = React.useState<Parsed | null>(null);
  const [target, setTarget] = React.useState<string>(appleCards[0]?.accountId ?? "new");
  const [kind, setKind] = React.useState<WorkspaceKind>(workspace === "business" ? "business" : "personal");
  const [mask, setMask] = React.useState("");
  const [error, setError] = React.useState<string>();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const importRows = useApiMutation((api, body: Parameters<typeof api.importStatement>[0]["body"]) => api.importStatement({ body }));

  const readFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(undefined);
    const byId = new Map<string, StatementRow>();
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      const result = parseAppleCardCsv(await file.text());
      result.rows.forEach((r) => byId.set(r.externalId, r));
      errors.push(...result.errors.map((e) => `${file.name}, line ${e.line}: ${e.message}`));
    }
    setParsed({ files: Array.from(files).map((f) => f.name), rows: [...byId.values()].sort((a, b) => a.date.localeCompare(b.date)), errors });
  };

  const submit = () => {
    if (!parsed?.rows.length) return;
    if (target === "new" && !/^\d{4}$/.test(mask)) return setError("Enter the last 4 digits of your Apple Card");
    const body =
      target === "new"
        ? { format: "apple_card" as const, newAccount: { workspaceKind: kind, name: "Apple Card", mask }, rows: parsed.rows }
        : { format: "apple_card" as const, accountId: target, rows: parsed.rows };
    importRows.mutate(body, {
      onSuccess: (r) => {
        toast.success(`Imported ${r.inserted} transaction${r.inserted === 1 ? "" : "s"}`, { description: r.skipped ? `${r.skipped} already imported, skipped` : undefined });
        setParsed(null);
        setTarget(r.accountId);
        if (inputRef.current) inputRef.current.value = "";
      },
      onError: (e) => setError(e.message),
    });
  };

  const spend = parsed?.rows.filter((r) => r.kind === "expense").length ?? 0;
  return (
    <Card id="import">
      <CardHeader>
        <div>
          <CardTitle className="text-sm normal-case tracking-normal text-foreground">Import Apple Card statements</CardTitle>
          <CardDescription>
            On the web, sign in at card.apple.com, open Statements, and choose Export Transactions as CSV. On iPhone: Wallet, Apple Card, Card Balance, a statement, Export Transactions. Add one file per month; re-importing a month skips what is already here.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <input ref={inputRef} type="file" accept=".csv,text/csv" multiple className="sr-only" id="apple-csv" onChange={(e) => readFiles(e.target.files)} />
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}><FileUp /> Choose CSV files</Button>

        {parsed && (
          <div className="space-y-3 rounded-md border bg-subtle p-3 text-sm">
            <div>
              <span className="font-medium">{parsed.rows.length} transactions</span> from {parsed.files.length} file{parsed.files.length === 1 ? "" : "s"}
              {parsed.rows.length > 0 && <> · {formatDate(parsed.rows[0]!.date)} to {formatDate(parsed.rows.at(-1)!.date)} · {spend} purchases</>}
            </div>
            {parsed.errors.length > 0 && (
              <ul className="list-disc pl-5 text-xs text-warning">
                {parsed.errors.slice(0, 5).map((e) => <li key={e}>{e}</li>)}
                {parsed.errors.length > 5 && <li>{parsed.errors.length - 5} more</li>}
              </ul>
            )}
            {parsed.rows.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Field id="apple-target" label="Import into">
                  <NativeSelect id="apple-target" value={target} onChange={(e) => setTarget(e.target.value)}>
                    {cards.map((c) => <option key={c.accountId} value={c.accountId}>{c.name} ···{c.mask}</option>)}
                    <option value="new">New Apple Card account</option>
                  </NativeSelect>
                </Field>
                {target === "new" && (
                  <>
                    <Field id="apple-kind" label="Workspace">
                      <NativeSelect id="apple-kind" value={kind} onChange={(e) => setKind(e.target.value as WorkspaceKind)}>
                        <option value="personal">Personal</option>
                        <option value="business">Business</option>
                      </NativeSelect>
                    </Field>
                    <Field id="apple-mask" label="Last 4 digits">
                      <Input id="apple-mask" inputMode="numeric" maxLength={4} value={mask} onChange={(e) => setMask(e.target.value.replace(/\D/g, ""))} />
                    </Field>
                  </>
                )}
              </div>
            )}
            {error && <p className="text-xs text-negative">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setParsed(null)}>Cancel</Button>
              <Button onClick={submit} disabled={!parsed.rows.length || importRows.isPending}>{importRows.isPending ? "Importing" : "Import"}</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
