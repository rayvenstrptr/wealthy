"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatDate, monthLabel, monthRange, shiftMonth, yearRange } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type DashboardView = "monthly" | "yearly" | "alltime";

const VIEWS: { value: DashboardView; label: string; short: string }[] = [
  { value: "monthly", label: "Monthly", short: "Monthly" },
  { value: "yearly", label: "Yearly", short: "Yearly" },
  { value: "alltime", label: "All time", short: "All" },
];

interface PeriodProps {
  view: DashboardView;
  month: string; // "YYYY-MM"
  year: string; // "YYYY"
}

function usePeriodNav({ month, year }: Pick<PeriodProps, "month" | "year">) {
  const router = useRouter();
  return (nextView: DashboardView, nextMonth = month, nextYear = year) => {
    const params = new URLSearchParams({ view: nextView });
    if (nextView === "monthly") params.set("month", nextMonth);
    if (nextView === "yearly") params.set("year", nextYear);
    router.replace(`/?${params.toString()}`);
  };
}

/** Pill segmented control: subtle track, active = white pill with a soft shadow. */
function ViewTabs({
  view,
  go,
  compact,
}: {
  view: DashboardView;
  go: (v: DashboardView) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex rounded-full bg-secondary p-[3px]",
        compact ? "text-[11.5px]" : "text-[12.5px]"
      )}
    >
      {VIEWS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => go(option.value)}
          className={cn(
            "rounded-full transition-colors",
            compact ? "px-3 py-[5px]" : "px-[15px] py-1.5",
            view === option.value
              ? "bg-card font-semibold text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {compact ? option.short : option.label}
        </button>
      ))}
    </div>
  );
}

function StepButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex size-8 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-[#e2ddd0] dark:hover:bg-[#454034]"
    >
      {children}
    </button>
  );
}

/** Desktop dashboard controls: segmented view tabs + prev/next steppers. */
export function PeriodPicker({ view, month, year }: PeriodProps) {
  const go = usePeriodNav({ month, year });

  return (
    <div className="flex items-center gap-2.5">
      <ViewTabs view={view} go={go} />
      {view === "monthly" ? (
        <div className="flex items-center gap-1.5">
          <StepButton onClick={() => go("monthly", shiftMonth(month, -1))} label="Previous month">
            <ChevronLeft className="size-4" />
          </StepButton>
          <StepButton onClick={() => go("monthly", shiftMonth(month, 1))} label="Next month">
            <ChevronRight className="size-4" />
          </StepButton>
        </div>
      ) : view === "yearly" ? (
        <div className="flex items-center gap-1.5">
          <StepButton
            onClick={() => go("yearly", month, String(Number(year) - 1))}
            label="Previous year"
          >
            <ChevronLeft className="size-4" />
          </StepButton>
          <StepButton
            onClick={() => go("yearly", month, String(Number(year) + 1))}
            label="Next year"
          >
            <ChevronRight className="size-4" />
          </StepButton>
        </div>
      ) : null}
    </div>
  );
}

/** Mobile dashboard header: wordmark + compact tabs, then a centered stepper. */
export function MobilePeriod({ view, month, year }: PeriodProps) {
  const go = usePeriodNav({ month, year });

  const title =
    view === "monthly" ? monthLabel(month) : view === "yearly" ? year : "All time";
  const range =
    view === "monthly" ? monthRange(month) : view === "yearly" ? yearRange(year) : undefined;
  const caption = range
    ? `${formatDate(range.start)} – ${formatDate(range.end)}`
    : "Everything ever recorded";

  const stepper = view !== "alltime";

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-base font-bold tracking-[-0.01em]">
          wealth<span style={{ color: "oklch(0.62 0.10 85)" }}>.</span>
        </div>
        <ViewTabs view={view} go={go} compact />
      </div>

      <div className="mt-5 flex items-center justify-between">
        {stepper ? (
          <StepButton
            onClick={() =>
              view === "monthly"
                ? go("monthly", shiftMonth(month, -1))
                : go("yearly", month, String(Number(year) - 1))
            }
            label="Previous period"
          >
            <ChevronLeft className="size-4" />
          </StepButton>
        ) : (
          <span className="size-8" />
        )}
        <div className="text-center">
          <div className="text-[21px] font-bold tracking-[-0.02em]">{title}</div>
          <div className="mt-0.5 text-[11.5px] text-muted-foreground">{caption}</div>
        </div>
        {stepper ? (
          <StepButton
            onClick={() =>
              view === "monthly"
                ? go("monthly", shiftMonth(month, 1))
                : go("yearly", month, String(Number(year) + 1))
            }
            label="Next period"
          >
            <ChevronRight className="size-4" />
          </StepButton>
        ) : (
          <span className="size-8" />
        )}
      </div>
    </div>
  );
}
