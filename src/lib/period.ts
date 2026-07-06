// Period filter values for the entry pages (expenses, income): a budget
// month ("YYYY-MM"), a budget year ("YYYY"), or "all". Stored in the
// `month` URL param; ranges resolve through the payday cycle in dates.ts.

import { formatDate, monthLabel, monthRange, yearRange } from "@/lib/dates";

export type PeriodKind = "month" | "year" | "all";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const YEAR_RE = /^\d{4}$/;

export function periodKind(value: string): PeriodKind {
  if (value === "all") return "all";
  return YEAR_RE.test(value) ? "year" : "month";
}

/** Validate a raw ?month= param; anything unrecognized falls back to the default month. */
export function normalizePeriod(raw: string | undefined, defaultMonth: string): string {
  if (raw && (raw === "all" || MONTH_RE.test(raw) || YEAR_RE.test(raw))) return raw;
  return defaultMonth;
}

/** Date range a period covers; undefined = unbounded (all time). */
export function periodRange(value: string): { start: string; end: string } | undefined {
  const kind = periodKind(value);
  if (kind === "all") return undefined;
  return kind === "year" ? yearRange(value) : monthRange(value);
}

/** "2026-07" -> "July 2026", "2026" -> "2026", "all" -> "All time". */
export function periodLabel(value: string): string {
  const kind = periodKind(value);
  if (kind === "all") return "All time";
  return kind === "year" ? value : monthLabel(value);
}

/** The resolved payday-cycle window, e.g. "25 Jun 2026 – 24 Jul 2026". */
export function periodCaption(value: string): string {
  const range = periodRange(value);
  if (!range) return "Everything ever recorded";
  return `${formatDate(range.start)} – ${formatDate(range.end)}`;
}
