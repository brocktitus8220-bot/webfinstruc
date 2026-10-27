"use client";
import * as React from "react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DATE_PRESETS, describeRange, rangeForPreset } from "@/lib/date-range";
import { cn } from "@/lib/utils";
import { useShellState } from "./shell-state";

export function DateRangeSelector() {
  const { dateRange, setDateRange } = useShellState();
  const [open, setOpen] = React.useState(false);
  const [from, setFrom] = React.useState(dateRange.from);
  const [to, setTo] = React.useState(dateRange.to);
  const invalid = !from || !to || from > to;

  React.useEffect(() => {
    if (open) {
      setFrom(dateRange.from);
      setTo(dateRange.to);
    }
  }, [open, dateRange]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="font-normal">
          <CalendarDays className="!size-3.5 text-muted-foreground" />
          {describeRange(dateRange)}
          <ChevronDown className="!size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0">
        <ul className="p-1">
          {DATE_PRESETS.map((p) => (
            <li key={p.value}>
              <button
                type="button"
                onClick={() => {
                  setDateRange(rangeForPreset(p.value));
                  setOpen(false);
                }}
                className={cn("flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted", dateRange.preset === p.value && "font-medium")}
              >
                {p.label}
                {dateRange.preset === p.value && <Check className="ml-auto size-4 text-primary" />}
              </button>
            </li>
          ))}
        </ul>
        <form
          className="space-y-2 border-t p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (invalid) return;
            setDateRange({ preset: "custom", from, to });
            setOpen(false);
          }}
        >
          <div className="text-xs font-medium">Custom range</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="range-from" className="text-2xs text-muted-foreground">From</Label>
              <Input id="range-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="range-to" className="text-2xs text-muted-foreground">To</Label>
              <Input id="range-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <Button type="submit" size="sm" className="w-full" disabled={invalid}>Apply</Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
