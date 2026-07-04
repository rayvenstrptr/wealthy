"use client";

// Inline editable fields for list rows: name and amount save on blur/Enter
// without opening the edit dialog. Escape reverts. onSave returns whether the
// save succeeded so the field can roll back on failure.

import { useState } from "react";
import { formatNumber, parseAmountInput } from "@/lib/format";
import { cn } from "@/lib/utils";

const baseClass =
  "rounded-md border border-transparent bg-transparent px-1.5 py-0.5 outline-none transition-colors " +
  "hover:border-input focus:border-ring focus:bg-background focus:ring-2 focus:ring-ring/30";

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
  "aria-label"?: string;
}

export function InlineAmount({ value, onSave, className, ...props }: InlineAmountProps) {
  const [draft, setDraft] = useState<number | null>(value);
  const [reverting, setReverting] = useState(false);

  async function commit() {
    if (reverting) {
      setReverting(false);
      return;
    }
    if (draft == null || draft <= 0 || draft === value) {
      setDraft(value);
      return;
    }
    const ok = await onSave(draft);
    if (!ok) setDraft(value);
  }

  return (
    <input
      inputMode="numeric"
      value={draft == null ? "" : formatNumber(draft)}
      onChange={(e) => setDraft(parseAmountInput(e.target.value))}
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
