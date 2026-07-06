"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { formatNumber, parseAmountInput } from "@/lib/format";
import { cn } from "@/lib/utils";

interface AmountInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  /** Permit a leading "-" (negative expense = surplus that refills the budget). */
  allowNegative?: boolean;
  id?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  "aria-label"?: string;
}

/** IDR amount input: digits only, live thousands separator ("1.250.000"). */
export function AmountInput({ value, onChange, allowNegative, className, ...props }: AmountInputProps) {
  // A lone "-" parses to null; remember it so the sign isn't swallowed mid-typing.
  const [minusDraft, setMinusDraft] = useState(false);

  function handleChange(raw: string) {
    const parsed = parseAmountInput(raw, allowNegative);
    setMinusDraft(Boolean(allowNegative) && parsed == null && raw.trim() === "-");
    onChange(parsed);
  }

  const display =
    value != null ? formatNumber(value) : minusDraft ? "-" : "";

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[13.5px] text-muted-foreground">
        Rp
      </span>
      <Input
        type="text"
        inputMode={allowNegative ? "text" : "numeric"}
        autoComplete="off"
        className={cn("pl-10 font-semibold tabular-nums", className)}
        value={display}
        onChange={(e) => handleChange(e.target.value)}
        {...props}
      />
    </div>
  );
}
