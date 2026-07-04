const idNumber = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** 1250000 -> "1.250.000" */
export function formatNumber(n: number): string {
  return idNumber.format(Math.round(n));
}

/** 1250000 -> "Rp 1.250.000" (negatives: "-Rp 50.000") */
export function formatIDR(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}Rp ${idNumber.format(Math.abs(rounded))}`;
}

/** "1.250.000" / "Rp 1,250,000" / "1250000" -> 1250000. Empty -> null. */
export function parseAmountInput(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  return Number.parseInt(digits, 10);
}

/** Fraction 0.155 -> "15,5%" (max 1 decimal, id-ID comma). */
export function formatPercent(fraction: number): string {
  const pct = Math.round(fraction * 1000) / 10;
  return `${pct.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
}
