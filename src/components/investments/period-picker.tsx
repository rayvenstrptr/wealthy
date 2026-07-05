"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type InvestmentsView = "yearly" | "alltime";

const VIEWS: { value: InvestmentsView; label: string }[] = [
  { value: "yearly", label: "Yearly" },
  { value: "alltime", label: "All time" },
];

interface InvestmentsPeriodPickerProps {
  view: InvestmentsView;
  year: string; // "YYYY" (budget year)
}

/** Yearly | All-time picker for /investments (no monthly window here). */
export function InvestmentsPeriodPicker({ view, year }: InvestmentsPeriodPickerProps) {
  const router = useRouter();

  function go(nextView: InvestmentsView, nextYear = year) {
    const params = new URLSearchParams({ view: nextView });
    if (nextView === "yearly") params.set("year", nextYear);
    router.replace(`/investments?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex rounded-full bg-secondary p-[3px] text-[12.5px]">
        {VIEWS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => go(option.value)}
            className={cn(
              "rounded-full px-[15px] py-1.5 transition-colors",
              view === option.value
                ? "bg-card font-semibold text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      {view === "yearly" && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => go("yearly", String(Number(year) - 1))}
            aria-label="Previous year"
            className="inline-flex size-8 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-[#e2ddd0] dark:hover:bg-[#454034]"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => go("yearly", String(Number(year) + 1))}
            aria-label="Next year"
            className="inline-flex size-8 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-[#e2ddd0] dark:hover:bg-[#454034]"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
