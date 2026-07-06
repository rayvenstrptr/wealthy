"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";

/** One dated ledger row — buys/sells + yields, precomputed by the page. */
export interface TradeLogRow {
  id: string;
  date: string;
  itemName: string;
  className: string;
  kind: "buy" | "sell" | "yield";
  amount: number;
  quantity: number | null;
}

type SortKey = "date" | "name" | "amount";
type SortDir = "asc" | "desc";
type KindFilter = "all" | TradeLogRow["kind"];

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "buy", label: "Buy" },
  { value: "sell", label: "Sell" },
  { value: "yield", label: "Yield" },
];

const kindStyle: Record<TradeLogRow["kind"], { label: string; color?: string }> = {
  buy: { label: "BUY" },
  sell: { label: "SELL", color: "oklch(0.5 0.12 155)" },
  yield: { label: "YIELD", color: "oklch(0.55 0.11 85)" },
};

function compare(a: TradeLogRow, b: TradeLogRow, key: SortKey): number {
  switch (key) {
    case "date":
      return a.date.localeCompare(b.date) || a.itemName.localeCompare(b.itemName);
    case "name":
      return a.itemName.localeCompare(b.itemName) || a.date.localeCompare(b.date);
    case "amount":
      return a.amount - b.amount || a.date.localeCompare(b.date);
  }
}

/** Flat, sortable ledger of every buy/sell/yield in the selected window. */
export function TradeLog({ rows }: { rows: TradeLogRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");

  const sorted = useMemo(() => {
    const list = rows
      .filter((row) => kindFilter === "all" || row.kind === kindFilter)
      .sort((a, b) => compare(a, b, sortKey));
    if (sortDir === "desc") list.reverse();
    return list;
  }, [rows, sortKey, sortDir, kindFilter]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc"); // names read A→Z, numbers big-first
    }
  }

  function SortHeader({
    label,
    sort,
    align = "left",
  }: {
    label: string;
    sort: SortKey;
    align?: "left" | "right";
  }) {
    const active = sortKey === sort;
    const Icon = sortDir === "asc" ? ChevronUp : ChevronDown;
    return (
      <button
        type="button"
        onClick={() => toggleSort(sort)}
        className={cn(
          "inline-flex items-center gap-0.5 text-[11px] font-semibold tracking-[0.1em] uppercase transition-colors",
          align === "right" && "flex-row-reverse",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
        aria-label={`Sort by ${label}`}
      >
        {label}
        <Icon className={cn("size-3.5", !active && "invisible")} />
      </button>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-input bg-card px-6 py-6 text-center text-[12.5px] text-muted-foreground">
        No entries in this period.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex w-fit rounded-full bg-secondary p-[3px] text-[12px]">
        {KIND_FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setKindFilter(option.value)}
            className={cn(
              "rounded-full px-3 py-1 transition-colors",
              kindFilter === option.value
                ? "bg-card font-semibold text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-input bg-card px-6 py-6 text-center text-[12.5px] text-muted-foreground">
          No {kindFilter} entries in this period.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[14px] bg-card shadow-[0_1px_2px_rgba(38,35,30,0.05)]">
          <table className="w-full min-w-[480px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 text-left">
                  <SortHeader label="Date" sort="date" />
                </th>
                <th className="px-2 py-2.5 text-left">
                  <SortHeader label="Name" sort="name" />
                </th>
                <th className="px-2 py-2.5 text-left text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                  Type
                </th>
                <th className="px-4 py-2.5 text-right">
                  <SortHeader label="Amount" sort="amount" align="right" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const style = kindStyle[row.kind];
                return (
                  <tr
                    key={row.id}
                    className="border-b border-border last:border-b-0 hover:bg-row-hover"
                  >
                    <td className="px-4 py-2 whitespace-nowrap text-muted-foreground tabular-nums">
                      {formatDate(row.date)}
                    </td>
                    <td className="px-2 py-2">
                      <span className="font-medium">{row.itemName}</span>
                      <span className="ml-1.5 text-[11px] text-muted-foreground">
                        {row.className}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={cn(
                          "text-[10.5px] font-bold tracking-[0.06em]",
                          !style.color && "text-muted-foreground",
                        )}
                        style={style.color ? { color: style.color } : undefined}
                      >
                        {style.label}
                      </span>
                      {row.quantity != null && (
                        <span className="ml-1.5 text-[11px] text-muted-foreground tabular-nums">
                          {row.quantity} u
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold whitespace-nowrap tabular-nums">
                      {formatIDR(row.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
