"use client";

import { Input } from "@/components/ui/input";
import { formatNumber, parseAmountInput } from "@/lib/format";
import { cn } from "@/lib/utils";

interface AmountInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  id?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  "aria-label"?: string;
}

/** IDR amount input: digits only, live thousands separator ("1.250.000"). */
export function AmountInput({ value, onChange, className, ...props }: AmountInputProps) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
        Rp
      </span>
      <Input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={cn("pl-9 tabular-nums", className)}
        value={value == null ? "" : formatNumber(value)}
        onChange={(e) => onChange(parseAmountInput(e.target.value))}
        {...props}
      />
    </div>
  );
}
