"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { monthLabel } from "@/lib/dates";
import type { BudgetType, EventRow, ExpenseCategory } from "@/lib/types";
import { SimpleSelect } from "@/components/simple-select";
import { cn } from "@/lib/utils";

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

/** Filter chips: active = filled subtle pill, inactive = outlined muted pill. */
function pillClass(active: boolean) {
  return cn(
    "h-9 rounded-full",
    active
      ? "border-transparent bg-secondary font-semibold text-foreground"
      : "text-muted-foreground"
  );
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

  const monthOptions = [
    { value: ALL, label: "All time" },
    ...monthChoices(defaultMonth).map((m) => ({ value: m, label: monthLabel(m) })),
  ];

  const dirty =
    values.budget !== ALL ||
    values.category !== ALL ||
    values.event !== ALL ||
    values.q !== "" ||
    values.month !== defaultMonth;

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="relative min-w-[220px] flex-1 basis-full sm:basis-auto">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder="Search expenses…"
          aria-label="Search expenses by name"
          className="h-9 w-full rounded-full bg-card pr-4 pl-10 text-[13px] shadow-[0_1px_2px_rgba(38,35,30,0.05)] outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-secondary"
        />
      </div>

      <SimpleSelect
        value={values.month}
        onChange={(v) => update({ month: v })}
        options={monthOptions}
        className={pillClass(values.month !== defaultMonth)}
      />

      <SimpleSelect
        value={values.budget}
        onChange={(v) => update({ budget: v })}
        options={[
          { value: ALL, label: "Budget type" },
          ...budgetTypes.map((b) => ({ value: b.id, label: withArchivedLabel(b.name, b.is_active) })),
        ]}
        className={pillClass(values.budget !== ALL)}
      />

      <SimpleSelect
        value={values.category}
        onChange={(v) => update({ category: v })}
        options={[
          { value: ALL, label: "Category" },
          ...categories.map((c) => ({ value: c.id, label: withArchivedLabel(c.name, c.is_active) })),
        ]}
        className={pillClass(values.category !== ALL)}
      />

      <SimpleSelect
        value={values.event}
        onChange={(v) => update({ event: v })}
        options={[
          { value: ALL, label: "Event" },
          ...events.map((e) => ({ value: e.id, label: e.name })),
        ]}
        className={pillClass(values.event !== ALL)}
      />

      {dirty && (
        <button
          type="button"
          onClick={() => {
            setSearchDraft("");
            update({ month: defaultMonth, budget: ALL, category: ALL, event: ALL, q: "" });
          }}
          className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-[12.5px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="size-3.5" />
          Clear
        </button>
      )}
    </div>
  );
}

/** A window of selectable budget months around the current one (±12). */
function monthChoices(center: string): string[] {
  const [y, m] = center.split("-").map(Number);
  const base = y * 12 + (m - 1);
  const out: string[] = [];
  for (let d = 12; d >= -12; d--) {
    const total = base + d;
    const ny = Math.floor(total / 12);
    const nm = (total % 12) + 1;
    out.push(`${ny}-${String(nm).padStart(2, "0")}`);
  }
  return out;
}
