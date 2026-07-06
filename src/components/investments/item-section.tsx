"use client";

import { useState } from "react";
import { ChevronDown, Pencil } from "lucide-react";
import { assetClassHue } from "@/lib/asset-class-colors";
import { formatDate } from "@/lib/dates";
import { formatIDR } from "@/lib/format";
import type { AssetClass, InvestmentItem, InvestmentTransaction } from "@/lib/types";
import { TransactionForm } from "@/components/investments/transaction-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface ItemView {
  item: InvestmentItem;
  units: number | null;
  costBasis: number;
  /** Realized P&L within the selected window. */
  realized: number;
  /** realized ÷ basis sold within the window; null when nothing sold. */
  realizedPct: number | null;
  /** All transactions of the item, newest first. */
  transactions: InvestmentTransaction[];
}

export interface ClassGroup {
  assetClass: AssetClass;
  items: ItemView[];
}

interface ItemSectionProps {
  groups: ClassGroup[];
  /** Everything the edit dialog needs. */
  assetClasses: AssetClass[];
  allItems: InvestmentItem[];
  remainingByClass: Record<string, number>;
}

function RealizedLabel({ realized, pct }: { realized: number; pct: number | null }) {
  if (realized === 0 && pct == null) {
    return <span className="text-right text-[12px] text-muted-foreground">—</span>;
  }
  const loss = realized < 0;
  return (
    <span
      className="text-right text-[12.5px] font-semibold tabular-nums"
      style={{ color: loss ? "oklch(0.52 0.16 25)" : "oklch(0.5 0.12 155)" }}
    >
      {loss ? "−" : "+"}
      {formatIDR(Math.abs(realized))}
      {pct != null && (
        <span className="ml-1 font-medium opacity-80">
          {loss ? "" : "+"}
          {Math.round(pct * 1000) / 10}%
        </span>
      )}
    </span>
  );
}

/** Per-class holdings: expandable item rows with transaction history + edit. */
export function ItemSection({ groups, assetClasses, allItems, remainingByClass }: ItemSectionProps) {
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<InvestmentTransaction | null>(null);

  return (
    <div className="space-y-4">
      {groups.map(({ assetClass, items }) => {
        const hue = assetClassHue(assetClass.name);
        // Display subtotals of the already-computed per-item numbers.
        const heldTotal = items.reduce((sum, v) => sum + v.costBasis, 0);
        const realizedTotal = items.reduce((sum, v) => sum + v.realized, 0);
        return (
          <div key={assetClass.id}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: hue.fill }} aria-hidden />
                <span className="text-[12px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                  {assetClass.name}
                </span>
              </span>
              <span className="text-[11.5px] text-muted-foreground tabular-nums">
                {heldTotal > 0 && `${formatIDR(heldTotal)} held`}
                {heldTotal > 0 && realizedTotal !== 0 && " · "}
                {realizedTotal !== 0 && (
                  <span
                    className="font-semibold"
                    style={{
                      color: realizedTotal < 0 ? "oklch(0.52 0.16 25)" : "oklch(0.5 0.12 155)",
                    }}
                  >
                    {realizedTotal < 0 ? "−" : "+"}
                    {formatIDR(Math.abs(realizedTotal))}
                  </span>
                )}
              </span>
            </div>

            <div className="mt-2 overflow-hidden rounded-[14px] bg-card shadow-[0_1px_2px_rgba(38,35,30,0.05)]">
              {items.map((view, i) => {
                const expanded = openItem === view.item.id;
                return (
                  <div
                    key={view.item.id}
                    style={
                      i < items.length - 1 ? { borderBottom: "1px solid var(--border)" } : undefined
                    }
                  >
                    <button
                      type="button"
                      onClick={() => setOpenItem(expanded ? null : view.item.id)}
                      className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto_20px] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-row-hover sm:grid-cols-[minmax(0,1fr)_minmax(110px,auto)_minmax(150px,auto)_20px]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-medium">
                          {view.item.name}
                          {!view.item.is_active && (
                            <span className="text-muted-foreground"> (archived)</span>
                          )}
                        </span>
                        {view.units != null && view.units > 0 && (
                          <span className="text-[11.5px] text-muted-foreground tabular-nums">
                            {view.units} units held
                          </span>
                        )}
                      </span>
                      <span className="text-right text-[13px] font-semibold tabular-nums">
                        {view.costBasis > 0 ? (
                          formatIDR(view.costBasis)
                        ) : (
                          <span className="font-normal text-muted-foreground">—</span>
                        )}
                      </span>
                      <RealizedLabel realized={view.realized} pct={view.realizedPct} />
                      <ChevronDown
                        className={cn(
                          "size-4 text-placeholder transition-transform",
                          expanded && "rotate-180"
                        )}
                      />
                    </button>

                    {expanded && (
                      <div className="bg-sunken px-4 pb-3">
                        {view.transactions.map((tx) => (
                          <div
                            key={tx.id}
                            className="grid grid-cols-[52px_1fr_auto_32px] items-center gap-2 py-2 text-[12.5px]"
                            style={{ borderBottom: "1px solid var(--border)" }}
                          >
                            <span
                              className={cn(
                                "font-bold uppercase tracking-[0.06em]",
                                tx.side === "buy" ? "text-muted-foreground" : ""
                              )}
                              style={
                                tx.side === "sell" ? { color: "oklch(0.5 0.12 155)" } : undefined
                              }
                            >
                              {tx.side}
                            </span>
                            <span className="text-muted-foreground">
                              {formatDate(tx.date)}
                              {tx.quantity != null && (
                                <span className="tabular-nums"> · {tx.quantity} u</span>
                              )}
                            </span>
                            <span className="text-right font-semibold tabular-nums">
                              {formatIDR(tx.amount)}
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingTx(tx)}
                              aria-label="Edit transaction"
                              className="inline-flex size-7 items-center justify-center rounded-full text-placeholder transition-colors hover:text-foreground"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                          </div>
                        ))}
                        {view.transactions.length === 0 && (
                          <p className="py-2 text-[12.5px] text-muted-foreground">
                            No transactions yet.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {items.length === 0 && (
                <p className="px-4 py-3 text-[13px] text-muted-foreground">Nothing held yet.</p>
              )}
            </div>
          </div>
        );
      })}

      <Dialog open={editingTx !== null} onOpenChange={(open) => !open && setEditingTx(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Edit transaction</DialogTitle>
          </DialogHeader>
          {editingTx && (
            <TransactionForm
              assetClasses={assetClasses}
              items={allItems}
              remainingByClass={remainingByClass}
              initial={editingTx}
              onSaved={() => setEditingTx(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
