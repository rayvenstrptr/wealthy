"use client";

// Period filter for the entry pages (expenses, income). A stepper capsule
// (‹ July 2026 ›) that opens a panel with Month/Year granularity and an
// all-time option — a popover on desktop, a bottom sheet on mobile. The
// footer always resolves the hovered/selected period to its real payday
// window (25th → 24th) so the label is never ambiguous.

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { currentMonthWIB, shiftMonth } from "@/lib/dates";
import { periodCaption, periodKind, periodLabel } from "@/lib/period";
import { cn } from "@/lib/utils";

const MONTH_ABBRS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                     "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const YEAR_CELLS = 9; // 3×3 grid ending at the current budget year
const PANEL_WIDTH = 248; // desktop popover width, used to pick the anchor edge

interface PeriodFilterProps {
  value: string; // "YYYY-MM" | "YYYY" | "all"
  defaultMonth: string; // current budget month — the pill's resting state
  onChange: (value: string) => void;
}

/** Grid cell shared by the month and year grids and the all-time row. */
function optionClass(selected: boolean, current: boolean) {
  return cn(
    "rounded-full py-2 text-[13px] transition-colors outline-none sm:py-1.5 sm:text-[12.5px]",
    "focus-visible:ring-3 focus-visible:ring-secondary",
    selected
      ? "bg-foreground font-semibold text-card"
      : current
        ? "font-semibold text-foreground hover:bg-secondary"
        : "text-foreground/80 hover:bg-secondary hover:text-foreground"
  );
}

export function PeriodFilter({ value, defaultMonth, onChange }: PeriodFilterProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"month" | "year">("month");
  const [pickerYear, setPickerYear] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [alignRight, setAlignRight] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const kind = periodKind(value);
  const nowMonth = currentMonthWIB();
  const nowYear = Number(nowMonth.slice(0, 4));
  const nowMonthNum = Number(nowMonth.slice(5, 7));
  const isDefault = value === defaultMonth;

  function openPanel() {
    setMode(kind === "year" ? "year" : "month");
    setPickerYear(kind === "all" ? nowYear : Number(value.slice(0, 4)));
    setPreview(null);
    const rect = wrapRef.current?.getBoundingClientRect();
    setAlignRight(rect ? rect.left + PANEL_WIDTH > window.innerWidth - 16 : false);
    setOpen(true);
  }

  function apply(next: string) {
    onChange(next);
    setOpen(false);
  }

  // Trigger steppers move by one month/year at the current granularity.
  const nextDisabled = kind === "month" ? value >= nowMonth : Number(value) >= nowYear;
  function step(delta: number) {
    if (kind === "month") onChange(shiftMonth(value, delta));
    else onChange(String(Number(value) + delta));
  }

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const stepUnit = kind === "year" ? "year" : "month";
  const years = Array.from({ length: YEAR_CELLS }, (_, i) => nowYear - YEAR_CELLS + 1 + i);

  return (
    <div ref={wrapRef} className="relative">
      <div
        className={cn(
          "flex h-9 items-stretch rounded-full border transition-colors select-none",
          isDefault ? "border-input" : "border-transparent bg-secondary"
        )}
      >
        {kind !== "all" && (
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label={`Previous ${stepUnit}`}
            className="flex items-center rounded-full pr-1 pl-2.5 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-secondary"
          >
            <ChevronLeft className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openPanel())}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            "flex items-center gap-1 rounded-full text-[13px] transition-colors outline-none focus-visible:ring-3 focus-visible:ring-secondary",
            kind === "all" ? "px-3.5" : "px-1",
            isDefault
              ? "text-muted-foreground hover:text-foreground"
              : "font-semibold text-foreground"
          )}
        >
          <span className="whitespace-nowrap">{periodLabel(value)}</span>
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
              open && "rotate-180"
            )}
          />
        </button>
        {kind !== "all" && (
          <button
            type="button"
            onClick={() => step(1)}
            disabled={nextDisabled}
            aria-label={`Next ${stepUnit}`}
            className="flex items-center rounded-full pr-2.5 pl-1 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-secondary disabled:pointer-events-none disabled:opacity-25"
          >
            <ChevronRight className="size-4" />
          </button>
        )}
      </div>

      {open && (
        <>
          {/* Mobile backdrop — the panel becomes a bottom sheet under sm. */}
          <div
            aria-hidden
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[60] bg-[rgba(38,35,30,0.35)] duration-150 animate-in fade-in-0 sm:hidden motion-reduce:animate-none"
          />
          <div
            role="dialog"
            aria-label="Filter by period"
            className={cn(
              "fixed inset-x-4 bottom-4 z-[70] overflow-hidden rounded-[20px] bg-card shadow-[0_12px_40px_rgba(38,35,30,0.25)] duration-200 animate-in fade-in-0 slide-in-from-bottom-4 motion-reduce:animate-none",
              "sm:absolute sm:inset-x-auto sm:top-[calc(100%+6px)] sm:bottom-auto sm:w-[248px] sm:rounded-[16px] sm:border sm:border-border sm:shadow-[0_4px_20px_rgba(38,35,30,0.12)] sm:duration-100 sm:zoom-in-95 sm:slide-in-from-bottom-0",
              alignRight ? "sm:right-0" : "sm:left-0"
            )}
          >
            {/* Granularity tabs */}
            <div className="mx-3 mt-3 flex rounded-full bg-secondary p-[3px] text-[12px] sm:mx-2.5 sm:mt-2.5">
              {(["month", "year"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setPreview(null);
                  }}
                  className={cn(
                    "flex-1 rounded-full py-1.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-card sm:py-1",
                    mode === m
                      ? "bg-card font-semibold text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m === "month" ? "Month" : "Year"}
                </button>
              ))}
            </div>

            {mode === "month" ? (
              <>
                {/* Year stepper */}
                <div className="flex items-center justify-between px-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setPickerYear((y) => y - 1)}
                    aria-label="Previous year"
                    className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-secondary"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <span className="text-[13.5px] font-semibold tabular-nums">{pickerYear}</span>
                  <button
                    type="button"
                    onClick={() => setPickerYear((y) => y + 1)}
                    disabled={pickerYear >= nowYear}
                    aria-label="Next year"
                    className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-secondary disabled:pointer-events-none disabled:opacity-25"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>

                {/* Month grid */}
                <div
                  className="grid grid-cols-3 gap-1.5 p-3 pt-1.5 sm:gap-1 sm:p-2.5 sm:pt-1"
                  onMouseLeave={() => setPreview(null)}
                >
                  {MONTH_ABBRS.map((abbr, i) => {
                    const m = `${pickerYear}-${String(i + 1).padStart(2, "0")}`;
                    const isFuture =
                      pickerYear > nowYear || (pickerYear === nowYear && i + 1 > nowMonthNum);
                    return (
                      <button
                        key={abbr}
                        type="button"
                        disabled={isFuture}
                        onClick={() => apply(m)}
                        onMouseEnter={() => setPreview(m)}
                        onFocus={() => setPreview(m)}
                        className={cn(
                          optionClass(value === m, m === nowMonth),
                          isFuture && "pointer-events-none opacity-25"
                        )}
                      >
                        {abbr}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              /* Year grid */
              <div
                className="grid grid-cols-3 gap-1.5 p-3 pt-2 sm:gap-1 sm:p-2.5 sm:pt-2"
                onMouseLeave={() => setPreview(null)}
              >
                {years.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => apply(String(y))}
                    onMouseEnter={() => setPreview(String(y))}
                    onFocus={() => setPreview(String(y))}
                    className={cn("tabular-nums", optionClass(value === String(y), y === nowYear))}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}

            {/* All time */}
            <div className="px-3 pb-3 sm:px-2.5 sm:pb-2.5">
              <button
                type="button"
                onClick={() => apply("all")}
                onMouseEnter={() => setPreview("all")}
                onFocus={() => setPreview("all")}
                onMouseLeave={() => setPreview(null)}
                className={cn("w-full", optionClass(value === "all", false))}
              >
                All time
              </button>
            </div>

            {/* Receipt line: the payday-cycle window the selection resolves to. */}
            <div className="flex items-center justify-between gap-3 border-t border-border px-3.5 py-2.5">
              <span className="text-[11px] whitespace-nowrap text-muted-foreground tabular-nums">
                {periodCaption(preview ?? value)}
              </span>
              {!isDefault && (
                <button
                  type="button"
                  onClick={() => apply(defaultMonth)}
                  className="text-[11px] font-semibold whitespace-nowrap text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-secondary"
                >
                  This month
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
