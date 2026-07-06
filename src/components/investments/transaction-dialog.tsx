"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { AssetClass, InvestmentItem } from "@/lib/types";
import { TransactionForm } from "@/components/investments/transaction-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TransactionDialogProps {
  assetClasses: AssetClass[];
  items: InvestmentItem[];
  remainingByClass: Record<string, number>;
}

/** "+ Transaction" button + dialog for recording buys/sells. */
export function TransactionDialog({ assetClasses, items, remainingByClass }: TransactionDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Transaction
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Record transaction</DialogTitle>
            <DialogDescription>
              Buys deploy the class budget; sells replenish it.
            </DialogDescription>
          </DialogHeader>
          <TransactionForm
            assetClasses={assetClasses}
            items={items}
            remainingByClass={remainingByClass}
            onSaved={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
