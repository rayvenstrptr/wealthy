// Pure logic for the xlsx import: row classification, date conversion and
// duplicate detection. No I/O here — the server action (lib/actions/import.ts)
// reads the workbook and the DB, this module decides what each row means.
//
// Expected sheet columns: Cat · Details · Date · Ex · In · Type · Notes.
// A row with In is an income (Type = income type); a row with Ex is an expense
// (Cat = category, Type = envelope). Formula cells keep only the final amount —
// the calculation itself is preserved in the notes. Negative Ex is a surplus
// (someone paid extra, a refund) and is imported as a negative expense.

export interface RawCell {
  value: number | null;
  formula: string | null;
}

export interface RawImportRow {
  rowNumber: number;
  cat: string | null;
  details: string | null;
  date: string | number | Date | null;
  ex: RawCell;
  inc: RawCell;
  type: string | null;
  notes: string | null;
}

export interface ParsedEntry {
  rowNumber: number;
  kind: "expense" | "income";
  name: string;
  /** Integer IDR. Negative only for expenses (surplus). */
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  /** Expense category name (expenses only). */
  category: string | null;
  /** Envelope name (expense) or income type name (income). */
  type: string;
  notes: string | null;
  warnings: string[];
}

export interface RejectedEntry {
  rowNumber: number;
  label: string;
  reason: string;
}

export type ClassifiedRow =
  | { entry: ParsedEntry }
  | { rejected: RejectedEntry }
  | null; // fully blank row — ignore silently

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/** Excel 1900-system serial → "YYYY-MM-DD" (day 1 = 1900-01-01; base accounts for the leap-year bug). */
export function excelSerialToIso(serial: number): string {
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Serial number, Date object (exceljs parses date cells as UTC) or "YYYY-MM-DD"-ish string. */
export function toIsoDate(value: string | number | Date | null): string | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return value > 0 ? excelSerialToIso(value) : null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? match[0] : null;
}

/** Append "calc: …" / "orig: …" fragments to the sheet's own notes. */
function joinNotes(base: string | null, extras: string[]): string | null {
  const parts = [base?.trim(), ...extras].filter((p): p is string => Boolean(p));
  return parts.length ? parts.join(" · ") : null;
}

export interface ClassifyOptions {
  /** Names of investment-kind envelopes — expenses must never land in these. */
  investmentEnvelopes: string[];
}

export function classifyRow(raw: RawImportRow, options: ClassifyOptions): ClassifiedRow {
  const label = raw.details || raw.cat || `row ${raw.rowNumber}`;
  const hasEx = raw.ex.value != null;
  const hasInc = raw.inc.value != null;

  const blank =
    !hasEx && !hasInc && !raw.cat && !raw.details && raw.date == null && !raw.type && !raw.notes;
  if (blank) return null;

  const reject = (reason: string): ClassifiedRow => ({
    rejected: { rowNumber: raw.rowNumber, label, reason },
  });

  if (hasEx && hasInc) return reject("Has both an expense and an income amount.");
  if (!hasEx && !hasInc) return reject("No amount.");

  const date = toIsoDate(raw.date);
  if (!date) return reject("Missing or unreadable date.");

  const warnings: string[] = [];
  const noteExtras: string[] = [];
  const cell = hasEx ? raw.ex : raw.inc;
  if (cell.formula) noteExtras.push(`calc: ${cell.formula}`);

  const rawAmount = cell.value as number;
  const amount = Math.round(rawAmount);
  if (amount !== rawAmount) {
    noteExtras.push(`orig: ${rawAmount}`);
    warnings.push(`Rounded from ${rawAmount}.`);
  }

  const type = (raw.type ?? "").trim();
  const notes = joinNotes(raw.notes, noteExtras);

  if (hasInc) {
    if (amount <= 0) return reject("Income amount must be positive.");
    if (!type) return reject("Income row has no income type (Type column).");
    const name = (raw.details ?? "").trim() || type;
    return {
      entry: { rowNumber: raw.rowNumber, kind: "income", name, amount, date, category: null, type, notes, warnings },
    };
  }

  // Expense
  if (amount === 0) return reject("Amount is 0.");
  const investNames = new Set(options.investmentEnvelopes.map(norm));
  if (type && (investNames.has(norm(type)) || norm(type).startsWith("invest"))) {
    return reject("Investment deployment — record it in the Investments module instead.");
  }
  const category = (raw.cat ?? "").trim();
  if (!category) return reject("Missing category (Cat column).");
  if (!type) return reject("No envelope (Type column).");

  let name = (raw.details ?? "").trim();
  if (!name) {
    name = category;
    warnings.push("No name — category used as the name.");
  }
  if (amount < 0) warnings.push("Negative expense — imported as a surplus that refills the budget.");

  return {
    entry: { rowNumber: raw.rowNumber, kind: "expense", name, amount, date, category, type, notes, warnings },
  };
}

// ---------- Duplicate detection ----------

export type DuplicateStatus = "none" | "exact" | "similar";

export interface ExistingEntry {
  name: string;
  amount: number;
  date: string;
}

function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.abs(Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000;
}

/**
 * "exact"   — an entry with the same name, amount and date already exists.
 * "similar" — same amount near the date: either the same name within ±windowDays,
 *             or a different name on the very same date.
 */
export function duplicateStatus(
  entry: { name: string; amount: number; date: string },
  existing: ExistingEntry[],
  windowDays = 3
): DuplicateStatus {
  const name = norm(entry.name);
  let similar = false;
  for (const other of existing) {
    if (other.amount !== entry.amount) continue;
    const sameName = norm(other.name) === name;
    const diff = dayDiff(other.date, entry.date);
    if (sameName && diff === 0) return "exact";
    if ((sameName && diff <= windowDays) || diff === 0) similar = true;
  }
  return similar ? "similar" : "none";
}
