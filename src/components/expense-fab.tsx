"use client";

import { Plus } from "lucide-react";
import { useAddExpense } from "@/components/add-expense-provider";

/**
 * Floating "+ Expense" button, present on every page. Mobile: a 54px ink circle
 * above the tab bar. Desktop: an ink pill bottom-right. Opens the shared dialog,
 * which stays open after save for rapid entry.
 */
export function ExpenseFab() {
  const { open } = useAddExpense();

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Add expense"
      className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 inline-flex size-[54px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_18px_rgba(38,35,30,0.3)] transition-colors hover:bg-[#3a362e] md:right-8 md:bottom-8 md:size-auto md:gap-1.5 md:px-6 md:py-3 md:text-[14px] md:font-semibold dark:hover:bg-[#e8e3d9]"
    >
      <Plus className="size-6 md:size-5" />
      <span className="hidden md:inline">Expense</span>
    </button>
  );
}
