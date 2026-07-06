"use client";

import { useState } from "react";
import { HandCoins } from "lucide-react";
import type { SplitCell } from "@/lib/allocation-split";
import type { AssetClass, BudgetType, IncomeType, InvestmentItem } from "@/lib/types";
import { YieldForm } from "@/components/investments/yield-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface YieldDialogProps {
  assetClasses: AssetClass[];
  items: InvestmentItem[];
  incomeTypes: IncomeType[];
  budgetTypes: BudgetType[];
  latestSplitByType: Record<string, SplitCell[]>;
}

/** "＋ Yield" button + dialog for recording dividends/coupons from holdings. */
export function YieldDialog({
  assetClasses,
  items,
  incomeTypes,
  budgetTypes,
  latestSplitByType,
}: YieldDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <HandCoins className="size-4" />
        Yield
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Record yield</DialogTitle>
            <DialogDescription>
              A dividend/coupon from a holding — saved as income, split across envelopes.
            </DialogDescription>
          </DialogHeader>
          <YieldForm
            assetClasses={assetClasses}
            items={items}
            incomeTypes={incomeTypes}
            budgetTypes={budgetTypes}
            latestSplitByType={latestSplitByType}
            onSaved={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
