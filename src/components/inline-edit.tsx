"use client";

// Inline editable fields for list rows: name and amount save on blur/Enter
// without opening the edit dialog. Escape reverts. onSave returns whether the
// save succeeded so the field can roll back on failure.

import { useState } from "react";
import { formatNumber, parseAmountInput } from "@/lib/format";
import { cn } from "@/lib/utils";

// Dashed underline is the "editable in place" affordance; focus firms it to a
// solid ink underline. Enter saves (blur), Esc reverts.
const baseClass =
  "rounded-[4px] border-b border-dashed border-transparent bg-transparent px-1 py-0.5 outline-none transition-colors " +
  "hover:border-placeholder focus:border-solid focus:border-foreground";

function keyHandler(revert: () => void) {
  return (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
    if (e.key === "Escape") {
      revert();
      e.currentTarget.blur();
    }
  };
}

interface InlineNameProps {
  value: string;
  onSave: (value: string) => Promise<boolean>;
  className?: string;
  "aria-label"?: string;
}

export function InlineName({ value, onSave, className, ...props }: InlineNameProps) {
  const [draft, setDraft] = useState(value);
  const [reverting, setReverting] = useState(false);

  async function commit() {
    if (reverting) {
      setReverting(false);
      return;
    }
    const trimmed = draft.trim();
    if (!trimmed || trimmed === value) {
      setDraft(value);
      return;
    }
    const ok = await onSave(trimmed);
    if (!ok) setDraft(value);
  }

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={keyHandler(() => {
        setReverting(true);
        setDraft(value);
      })}
      className={cn(baseClass, "w-full truncate text-sm font-medium", className)}
      autoComplete="off"
      {...props}
    />
  );
}

interface InlineAmountProps {
  value: number;
  onSave: (value: number) => Promise<boolean>;
  className?: string;
  /** Show a "Rp " prefix (id-ID money). Parsing strips it, so it round-trips. */
  currency?: boolean;
  /** Permit a leading "-" (negative expense = surplus that refills the budget). */
  allowNegative?: boolean;
  "aria-label"?: string;
}

export function InlineAmount({
  value,
  onSave,
  className,
  currency,
  allowNegative,
  ...props
}: InlineAmountProps) {
  const [draft, setDraft] = useState<number | null>(value);
  // A lone "-" parses to null; remember it so the sign isn't swallowed mid-typing.
  const [minusDraft, setMinusDraft] = useState(false);
  const [reverting, setReverting] = useState(false);

  async function commit() {
    setMinusDraft(false);
    if (reverting) {
      setReverting(false);
      return;
    }
    const invalid = draft == null || draft === 0 || (!allowNegative && draft < 0);
    if (invalid || draft === value) {
      setDraft(value);
      return;
    }
    const ok = await onSave(draft);
    if (!ok) setDraft(value);
  }

  function handleChange(raw: string) {
    const parsed = parseAmountInput(raw, allowNegative);
    setMinusDraft(Boolean(allowNegative) && parsed == null && raw.replace(/[^\d-]/g, "") === "-");
    setDraft(parsed);
  }

  const display =
    draft != null
      ? currency
        ? `Rp ${formatNumber(draft)}`
        : formatNumber(draft)
      : minusDraft
        ? "-"
        : "";

  return (
    <input
      inputMode={allowNegative ? "text" : "numeric"}
      value={display}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={commit}
      onKeyDown={keyHandler(() => {
        setReverting(true);
        setDraft(value);
      })}
      className={cn(baseClass, "text-right text-sm font-medium tabular-nums", className)}
      autoComplete="off"
      {...props}
    />
  );
}
