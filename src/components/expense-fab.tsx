"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { BudgetType, EventRow, ExpenseCategory } from "@/lib/types";
import { ExpenseForm } from "@/components/expense-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ExpenseFabProps {
  budgetTypes: BudgetType[];
  categories: ExpenseCategory[];
  events: EventRow[];
}

/**
 * Floating "+ Expense" button, present on every page. The dialog stays open
 * after a save (the form resets keeping the date) so several expenses can be
 * entered back to back.
 */
export function ExpenseFab({ budgetTypes, categories, events }: ExpenseFabProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="lg"
        className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 h-13 rounded-full shadow-lg md:bottom-8"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-5" />
        Expense
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add expense</DialogTitle>
            <DialogDescription>Saved entries reset the form, keeping the date.</DialogDescription>
          </DialogHeader>
          <ExpenseForm budgetTypes={budgetTypes} categories={categories} events={events} />
        </DialogContent>
      </Dialog>
    </>
  );
}
