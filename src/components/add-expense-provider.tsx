"use client";

import { createContext, useContext, useState } from "react";
import type { BudgetType, EventRow, ExpenseCategory } from "@/lib/types";
import { ExpenseForm } from "@/components/expense-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AddExpenseContextValue {
  open: () => void;
}

const AddExpenseContext = createContext<AddExpenseContextValue | null>(null);

/** Trigger the shared "Add expense" dialog from anywhere (FAB, desktop nav). */
export function useAddExpense(): AddExpenseContextValue {
  const ctx = useContext(AddExpenseContext);
  if (!ctx) throw new Error("useAddExpense must be used within AddExpenseProvider");
  return ctx;
}

interface AddExpenseProviderProps {
  budgetTypes: BudgetType[];
  categories: ExpenseCategory[];
  events: EventRow[];
  children: React.ReactNode;
}

/**
 * Owns the single "Add expense" dialog so both the floating FAB and the desktop
 * nav button open the same form. The dialog stays open after a save (form resets
 * keeping the date) for rapid back-to-back entry.
 */
export function AddExpenseProvider({
  budgetTypes,
  categories,
  events,
  children,
}: AddExpenseProviderProps) {
  const [open, setOpen] = useState(false);

  return (
    <AddExpenseContext.Provider value={{ open: () => setOpen(true) }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Add expense</DialogTitle>
            <DialogDescription>Saved entries reset the form, keeping the date.</DialogDescription>
          </DialogHeader>
          <ExpenseForm
            budgetTypes={budgetTypes}
            categories={categories}
            events={events}
            onDone={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </AddExpenseContext.Provider>
  );
}
