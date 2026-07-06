"use client";

// Three-step import: pick a file → review the parsed preview (duplicates
// unchecked by default, warnings visible per row) → import the selection.

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileUp, Loader2 } from "lucide-react";
import {
  executeImport,
  parseImportFile,
  type ImportPreview,
  type ImportResult,
  type PreviewEntry,
} from "@/lib/actions/import";
import { formatDate } from "@/lib/dates";
import { formatIDR } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function defaultSelection(entries: PreviewEntry[]): Set<number> {
  // Exact duplicates start unchecked — everything else is in.
  return new Set(entries.filter((e) => e.dup !== "exact").map((e) => e.rowNumber));
}

export function ImportWizard() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parsing, startParsing] = useTransition();
  const [importing, startImporting] = useTransition();

  function reset() {
    setPreview(null);
    setResult(null);
    setSelected(new Set());
    setFileName(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    startParsing(async () => {
      const formData = new FormData();
      formData.set("file", file);
      const parsed = await parseImportFile(formData);
      if (!parsed.ok) {
        toast.error(parsed.error);
        reset();
        return;
      }
      setPreview(parsed);
      setSelected(defaultSelection(parsed.entries));
    });
  }

  function toggle(rowNumber: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  }

  function handleImport() {
    if (!preview) return;
    const chosen = preview.entries.filter((e) => selected.has(e.rowNumber));
    startImporting(async () => {
      const outcome = await executeImport(chosen);
      if (!outcome.ok) {
        toast.error(outcome.error);
        return;
      }
      setResult(outcome);
      setPreview(null);
      toast.success(
        `Imported ${outcome.imported.expenses} expenses and ${outcome.imported.incomes} incomes.`
      );
      router.refresh();
    });
  }

  // ---- Step 3: done ----
  if (result) {
    return (
      <div className="rounded-[16px] bg-card px-6 py-8 text-center shadow-[0_1px_2px_rgba(38,35,30,0.05)]">
        <CheckCircle2 className="mx-auto size-8 text-emerald-600 dark:text-emerald-500" />
        <div className="mt-3 text-[15px] font-bold">Import complete</div>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {result.imported.expenses} expenses and {result.imported.incomes} incomes imported.
          {result.created.categories + result.created.envelopes + result.created.incomeTypes > 0 &&
            ` Created ${result.created.categories} categories, ${result.created.envelopes} envelopes, ${result.created.incomeTypes} income types.`}
        </p>
        <div className="mt-5 flex justify-center gap-2.5">
          <Button variant="outline" onClick={reset}>
            Import another file
          </Button>
          <Button render={<Link href="/expenses" />}>View expenses</Button>
        </div>
      </div>
    );
  }

  // ---- Step 1: pick a file ----
  if (!preview) {
    return (
      <label
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-[16px] border border-dashed border-input bg-card px-6 py-10 text-center transition-colors hover:border-foreground/30",
          parsing && "pointer-events-none opacity-70"
        )}
      >
        {parsing ? (
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        ) : (
          <FileUp className="size-6 text-muted-foreground" />
        )}
        <div className="text-[13.5px] font-semibold">
          {parsing ? `Reading ${fileName}…` : "Choose an .xlsx file"}
        </div>
        <div className="text-[12.5px] text-muted-foreground">
          Nothing is saved until you review and confirm.
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(e) => handleFile(e.target.files?.[0])}
          disabled={parsing}
        />
      </label>
    );
  }

  // ---- Step 2: review ----
  const entries = preview.entries;
  const exactCount = entries.filter((e) => e.dup === "exact").length;
  const similarCount = entries.filter((e) => e.dup === "similar").length;
  const selectedEntries = entries.filter((e) => selected.has(e.rowNumber));
  const allSelected = selected.size === entries.length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-[16px] bg-card px-6 py-5 shadow-[0_1px_2px_rgba(38,35,30,0.05)]">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-[15px] font-bold">{preview.fileName}</div>
          <button
            type="button"
            onClick={reset}
            className="text-[12.5px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Pick a different file
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[12.5px]">
          <Badge variant="secondary">{entries.length} entries</Badge>
          {exactCount > 0 && <Badge variant="destructive">{exactCount} already exist</Badge>}
          {similarCount > 0 && (
            <Badge variant="warning">{similarCount} similar near the date</Badge>
          )}
          {preview.rejected.length > 0 && (
            <Badge variant="outline">{preview.rejected.length} skipped</Badge>
          )}
        </div>

        {(preview.newCategories.length > 0 ||
          preview.newEnvelopes.length > 0 ||
          preview.newIncomeTypes.length > 0 ||
          preview.noSplitHistory.length > 0) && (
          <div className="mt-3 space-y-1 border-t border-border pt-3 text-[12.5px] text-muted-foreground">
            {preview.newCategories.length > 0 && (
              <p>
                New categories: <span className="text-foreground">{preview.newCategories.join(", ")}</span>
              </p>
            )}
            {preview.newEnvelopes.length > 0 && (
              <p className="text-amber-600 dark:text-amber-500">
                New envelopes will be created: {preview.newEnvelopes.join(", ")} — check Settings
                after importing.
              </p>
            )}
            {preview.newIncomeTypes.length > 0 && (
              <p>
                New income types: <span className="text-foreground">{preview.newIncomeTypes.join(", ")}</span>
              </p>
            )}
            {preview.noSplitHistory.length > 0 && preview.fallbackEnvelope && (
              <p className="text-amber-600 dark:text-amber-500">
                {preview.noSplitHistory.map((s) => `${s.count}× ${s.type}`).join(", ")} income has no
                split history — allocated 100% to {preview.fallbackEnvelope}; edit the splits later.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Entry table */}
      <div className="overflow-hidden rounded-[16px] bg-card shadow-[0_1px_2px_rgba(38,35,30,0.05)]">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2.5 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() =>
              setSelected(allSelected ? new Set() : new Set(entries.map((e) => e.rowNumber)))
            }
            aria-label="Select all"
            className="accent-foreground"
          />
          <span>{selected.size} selected</span>
        </div>
        <div className="max-h-[26rem] overflow-y-auto">
          {entries.map((entry) => (
            <label
              key={entry.rowNumber}
              className={cn(
                "flex cursor-pointer items-start gap-3 border-b border-border px-4 py-2 last:border-b-0 hover:bg-row-hover",
                !selected.has(entry.rowNumber) && "opacity-50"
              )}
            >
              <input
                type="checkbox"
                checked={selected.has(entry.rowNumber)}
                onChange={() => toggle(entry.rowNumber)}
                className="mt-1 accent-foreground"
                aria-label={`Include ${entry.name}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[13px] font-medium">{entry.name}</span>
                  <span
                    className={cn(
                      "shrink-0 text-[13px] font-semibold tabular-nums",
                      entry.kind === "income" && "text-emerald-600 dark:text-emerald-500",
                      entry.kind === "expense" && entry.amount < 0 && "text-emerald-600 dark:text-emerald-500"
                    )}
                  >
                    {entry.kind === "income" ? "+" : ""}
                    {formatIDR(entry.amount)}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-muted-foreground">
                  <span>{formatDate(entry.date)}</span>
                  <span>· {entry.kind === "income" ? `income / ${entry.type}` : `${entry.category} / ${entry.type}`}</span>
                  {entry.dup === "exact" && (
                    <span className="font-medium text-destructive">already exists</span>
                  )}
                  {entry.dup === "similar" && (
                    <span className="font-medium text-amber-600 dark:text-amber-500">
                      similar entry near this date
                    </span>
                  )}
                  {entry.warnings.map((warning) => (
                    <span key={warning} className="text-amber-600 dark:text-amber-500">
                      {warning}
                    </span>
                  ))}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Skipped rows */}
      {preview.rejected.length > 0 && (
        <details className="rounded-[16px] bg-card px-6 py-4 shadow-[0_1px_2px_rgba(38,35,30,0.05)]">
          <summary className="cursor-pointer text-[13px] font-semibold">
            <AlertTriangle className="mr-1.5 inline size-4 text-amber-600 dark:text-amber-500" />
            {preview.rejected.length} rows won&apos;t be imported
          </summary>
          <ul className="mt-3 space-y-1.5 text-[12.5px] text-muted-foreground">
            {preview.rejected.map((row) => (
              <li key={row.rowNumber}>
                <span className="text-foreground">
                  Row {row.rowNumber} ({row.label})
                </span>{" "}
                — {row.reason}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex items-center justify-end gap-2.5">
        <Button variant="secondary" onClick={reset} disabled={importing}>
          Cancel
        </Button>
        <Button onClick={handleImport} disabled={importing || selectedEntries.length === 0}>
          {importing ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Importing…
            </>
          ) : (
            `Import ${selectedEntries.length} entries`
          )}
        </Button>
      </div>
    </div>
  );
}
