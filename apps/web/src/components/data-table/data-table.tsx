"use client";
import * as React from "react";
import {
  type ColumnDef, type ColumnFiltersState, flexRender, getCoreRowModel, getFacetedUniqueValues, getFilteredRowModel,
  getPaginationRowModel, getSortedRowModel, type RowData, type SortingState, useReactTable, type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Bookmark, ChevronLeft, ChevronRight, Columns3, ListFilter, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { type SavedView, type TableViewState, useSavedViews } from "./saved-views";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    label?: string;
    align?: "left" | "right";
    /** Show a multi-select filter for this column in the toolbar. */
    facet?: boolean;
  }
}

export interface DataTableProps<T> {
  /** Stable id; saved views are stored per table. */
  tableId: string;
  columns: ColumnDef<T, any>[];
  data: T[];
  isLoading?: boolean;
  onRowClick?: (row: T) => void;
  searchPlaceholder?: string;
  defaultSorting?: SortingState;
  defaultVisibility?: VisibilityState;
  pageSize?: number;
  emptyMessage?: string;
}

export function DataTable<T>({
  tableId, columns, data, isLoading, onRowClick, searchPlaceholder = "Search", defaultSorting = [], defaultVisibility = {},
  pageSize = 25, emptyMessage = "No rows match.",
}: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>(defaultSorting);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(defaultVisibility);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [activeViewId, setActiveViewId] = React.useState<string | null>(null);
  const views = useSavedViews(tableId);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    autoResetPageIndex: true,
  });

  const currentState: TableViewState = { sorting, columnVisibility, columnFilters, globalFilter };
  const applyView = (view: SavedView | null) => {
    const s = view?.state ?? { sorting: defaultSorting, columnVisibility: defaultVisibility, columnFilters: [], globalFilter: "" };
    setSorting(s.sorting);
    setColumnVisibility(s.columnVisibility);
    setColumnFilters(s.columnFilters);
    setGlobalFilter(s.globalFilter);
    setActiveViewId(view?.id ?? null);
  };
  const activeView = views.list.find((v) => v.id === activeViewId) ?? null;
  const isDirty = activeView ? JSON.stringify(activeView.state) !== JSON.stringify(currentState) : false;
  const hasFilters = globalFilter !== "" || columnFilters.length > 0;

  const facetColumns = table.getAllLeafColumns().filter((c) => c.columnDef.meta?.facet);
  const rows = table.getRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const { pageIndex } = table.getState().pagination;

  return (
    <div className="rounded-lg border bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b p-2">
        <div className="relative w-full max-w-60">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder={searchPlaceholder} className="h-7 pl-7 text-xs" aria-label="Search rows" />
        </div>

        {facetColumns.map((column) => {
          const selected = (column.getFilterValue() as string[] | undefined) ?? [];
          const options = [...column.getFacetedUniqueValues().keys()].map(String).sort();
          return (
            <DropdownMenu key={column.id}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-7 border-dashed font-normal", selected.length > 0 && "border-solid")}>
                  <ListFilter className="!size-3.5" />
                  {column.columnDef.meta?.label ?? column.id}
                  {selected.length > 0 && <span className="rounded bg-accent px-1 text-2xs text-accent-foreground">{selected.length}</span>}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
                {options.map((opt) => (
                  <DropdownMenuCheckboxItem
                    key={opt}
                    checked={selected.includes(opt)}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(checked) => {
                      const next = checked ? [...selected, opt] : selected.filter((s) => s !== opt);
                      column.setFilterValue(next.length ? next : undefined);
                    }}
                  >
                    {opt}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-7" onClick={() => { setGlobalFilter(""); setColumnFilters([]); }}>
            Clear <X className="!size-3.5" />
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <SavedViewsMenu
            views={views.list}
            active={activeView}
            isDirty={isDirty}
            onApply={applyView}
            onSave={(name) => setActiveViewId(views.save(name, currentState).id)}
            onUpdate={() => activeView && views.update(activeView.id, currentState)}
            onDelete={(id) => {
              views.remove(id);
              if (id === activeViewId) setActiveViewId(null);
            }}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 font-normal"><Columns3 className="!size-3.5" /> Columns</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
              {table.getAllLeafColumns().filter((c) => c.getCanHide()).map((c) => (
                <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onSelect={(e) => e.preventDefault()} onCheckedChange={(v) => c.toggleVisibility(v)}>
                  {c.columnDef.meta?.label ?? c.id}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Table>
        <THead>
          {table.getHeaderGroups().map((hg) => (
            <TR key={hg.id} className="bg-subtle hover:bg-subtle">
              {hg.headers.map((header) => {
                const align = header.column.columnDef.meta?.align;
                const sorted = header.column.getIsSorted();
                return (
                  <TH key={header.id} className={cn(align === "right" && "text-right")} aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined}>
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn("inline-flex items-center gap-1 uppercase hover:text-foreground", align === "right" && "flex-row-reverse")}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === "asc" ? <ArrowUp className="size-3" /> : sorted === "desc" ? <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TH>
                );
              })}
            </TR>
          ))}
        </THead>
        <TBody>
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <TR key={i}>
                {table.getVisibleLeafColumns().map((c) => (
                  <TD key={c.id}><Skeleton className="h-3.5 w-full max-w-32" /></TD>
                ))}
              </TR>
            ))
          ) : rows.length === 0 ? (
            <TR>
              <TD colSpan={table.getVisibleLeafColumns().length} className="h-24 text-center text-muted-foreground">{emptyMessage}</TD>
            </TR>
          ) : (
            rows.map((row) => (
              <TR
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                onKeyDown={onRowClick ? (e) => e.key === "Enter" && onRowClick(row.original) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(onRowClick && "cursor-pointer hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none")}
              >
                {row.getVisibleCells().map((cell) => (
                  <TD key={cell.id} className={cn(cell.column.columnDef.meta?.align === "right" && "text-right")}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TD>
                ))}
              </TR>
            ))
          )}
        </TBody>
      </Table>

      <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
        <span>
          {filteredCount === data.length ? `${data.length} rows` : `${filteredCount} of ${data.length} rows`}
          {activeView && <> · View: <span className="font-medium text-foreground">{activeView.name}</span>{isDirty && " (edited)"}</>}
        </span>
        <div className="flex items-center gap-1">
          <span className="mr-2 tabular">Page {pageIndex + 1} of {Math.max(1, table.getPageCount())}</span>
          <Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page"><ChevronLeft /></Button>
          <Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page"><ChevronRight /></Button>
        </div>
      </div>
    </div>
  );
}

function SavedViewsMenu({
  views, active, isDirty, onApply, onSave, onUpdate, onDelete,
}: {
  views: SavedView[];
  active: SavedView | null;
  isDirty: boolean;
  onApply: (v: SavedView | null) => void;
  onSave: (name: string) => void;
  onUpdate: () => void;
  onDelete: (id: string) => void;
}) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string>();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 font-normal">
            <Bookmark className="!size-3.5" /> {active ? active.name : "Saved views"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-60">
          <DropdownMenuItem onSelect={() => { setName(""); setError(undefined); setDialogOpen(true); }}>Save view</DropdownMenuItem>
          {active && isDirty && <DropdownMenuItem onSelect={onUpdate}>Update “{active.name}”</DropdownMenuItem>}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Saved views</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => onApply(null)} className={cn(!active && "font-medium")}>Default</DropdownMenuItem>
          {views.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No saved views yet.</div>}
          {views.map((v) => (
            <DropdownMenuItem key={v.id} onSelect={() => onApply(v)} className={cn("group", active?.id === v.id && "font-medium")}>
              <span className="truncate">{v.name}</span>
              <button
                type="button"
                aria-label={`Delete view ${v.name}`}
                className="ml-auto rounded p-0.5 opacity-0 hover:bg-negative-muted hover:text-negative group-hover:opacity-100 group-focus:opacity-100"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDelete(v.id); }}
              >
                <Trash2 className="!size-3.5" />
              </button>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = name.trim();
              if (!trimmed) return setError("Give the view a name");
              if (views.some((v) => v.name.toLowerCase() === trimmed.toLowerCase())) return setError("A view with this name exists");
              onSave(trimmed);
              setDialogOpen(false);
            }}
          >
            <DialogHeader><DialogTitle>Save view</DialogTitle></DialogHeader>
            <Field id="view-name" label="Name" error={error} hint="Saves columns, sort, search, and filters.">
              <Input id="view-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={40} placeholder="For example, Q3 clients" />
            </Field>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
