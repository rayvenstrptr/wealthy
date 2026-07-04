"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { BudgetType, EventRow, ExpenseCategory } from "@/lib/types";
import { SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ALL = "all";

export interface ExpenseFilterValues {
  month: string; // "YYYY-MM" or "all"
  budget: string;
  category: string;
  event: string;
  q: string;
}

interface ExpenseFiltersProps {
  values: ExpenseFilterValues;
  budgetTypes: BudgetType[];
  categories: ExpenseCategory[];
  events: EventRow[];
  defaultMonth: string;
}

export function ExpenseFilters({
  values,
  budgetTypes,
  categories,
  events,
  defaultMonth,
}: ExpenseFiltersProps) {
  const router = useRouter();
  const [searchDraft, setSearchDraft] = useState(values.q);

  function update(patch: Partial<ExpenseFilterValues>) {
    const next = { ...values, ...patch };
    const params = new URLSearchParams();
    params.set("month", next.month);
    if (next.budget !== ALL) params.set("budget", next.budget);
    if (next.category !== ALL) params.set("category", next.category);
    if (next.event !== ALL) params.set("event", next.event);
    if (next.q) params.set("q", next.q);
    router.replace(`/expenses?${params.toString()}`);
  }

  // Debounced search → URL.
  useEffect(() => {
    if (searchDraft === values.q) return;
    const timer = setTimeout(() => update({ q: searchDraft }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  const withArchivedLabel = (name: string, isActive: boolean) =>
    isActive ? name : `${name} (archived)`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-40 flex-1 basis-full sm:basis-auto">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder="Search expenses…"
          className="pl-8"
          aria-label="Search expenses by name"
        />
      </div>
      <div className="flex items-center gap-1">
        <Input
          type="month"
          value={values.month === ALL ? "" : values.month}
          onChange={(e) => update({ month: e.target.value || ALL })}
          className="w-40"
          aria-label="Filter by month"
        />
        {values.month !== ALL && (
          <Button variant="ghost" size="sm" onClick={() => update({ month: ALL })}>
            All time
          </Button>
        )}
      </div>

      <SimpleSelect
        value={values.budget}
        onChange={(v) => update({ budget: v })}
        options={[
          { value: ALL, label: "All budgets" },
          ...budgetTypes.map((b) => ({ value: b.id, label: withArchivedLabel(b.name, b.is_active) })),
        ]}
        className="w-36"
      />

      <SimpleSelect
        value={values.category}
        onChange={(v) => update({ category: v })}
        options={[
          { value: ALL, label: "All categories" },
          ...categories.map((c) => ({ value: c.id, label: withArchivedLabel(c.name, c.is_active) })),
        ]}
        className="w-40"
      />

      <SimpleSelect
        value={values.event}
        onChange={(v) => update({ event: v })}
        options={[
          { value: ALL, label: "All events" },
          ...events.map((e) => ({ value: e.id, label: e.name })),
        ]}
        className="w-36"
      />

      {(values.budget !== ALL ||
        values.category !== ALL ||
        values.event !== ALL ||
        values.q !== "" ||
        values.month !== defaultMonth) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearchDraft("");
            update({ month: defaultMonth, budget: ALL, category: ALL, event: ALL, q: "" });
          }}
        >
          Reset
        </Button>
      )}
    </div>
  );
}
