"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { shiftMonth } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type DashboardView = "monthly" | "yearly" | "alltime";

const VIEWS: { value: DashboardView; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "alltime", label: "All time" },
];

interface PeriodPickerProps {
  view: DashboardView;
  month: string; // "YYYY-MM"
  year: string; // "YYYY"
}

export function PeriodPicker({ view, month, year }: PeriodPickerProps) {
  const router = useRouter();

  function go(nextView: DashboardView, nextMonth = month, nextYear = year) {
    const params = new URLSearchParams({ view: nextView });
    if (nextView === "monthly") params.set("month", nextMonth);
    if (nextView === "yearly") params.set("year", nextYear);
    router.replace(`/?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex rounded-lg border p-0.5">
        {VIEWS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => go(option.value)}
            className={cn(
              "rounded-md px-3 py-1 text-sm transition-colors",
              view === option.value
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {view === "monthly" ? (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => go("monthly", shiftMonth(month, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Input
            type="month"
            value={month}
            onChange={(e) => e.target.value && go("monthly", e.target.value)}
            className="w-40"
            aria-label="Month"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => go("monthly", shiftMonth(month, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      ) : view === "yearly" ? (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => go("yearly", month, String(Number(year) - 1))}
            aria-label="Previous year"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="w-16 text-center text-sm font-medium tabular-nums">{year}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => go("yearly", month, String(Number(year) + 1))}
            aria-label="Next year"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
