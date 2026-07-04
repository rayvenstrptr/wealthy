// All "today" defaults use Asia/Jakarta (WIB) regardless of server timezone.
//
// Budget cycle: a month runs from the 25th of the PREVIOUS calendar month to
// the 24th of the labeled month. "January 2026" = 25 Dec 2025 – 24 Jan 2026.
// Budget years follow suit: "2026" = 25 Dec 2025 – 24 Dec 2026, so every
// budget month belongs to exactly one budget year.

export const CYCLE_START_DAY = 25;

/** Today in WIB as "YYYY-MM-DD". */
export function todayWIB(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Budget month ("YYYY-MM") a given date belongs to: on/after the 25th it's the NEXT month. */
export function budgetMonthOf(date: string): string {
  const day = Number(date.slice(8, 10));
  const calendarMonth = date.slice(0, 7);
  return day >= CYCLE_START_DAY ? shiftMonth(calendarMonth, 1) : calendarMonth;
}

/** Current budget month in WIB as "YYYY-MM". */
export function currentMonthWIB(): string {
  return budgetMonthOf(todayWIB());
}

/** Current budget year in WIB as "YYYY". */
export function currentYearWIB(): string {
  return currentMonthWIB().slice(0, 4);
}

/** Budget month range: "2026-02" -> { start: "2026-01-25", end: "2026-02-24" }. */
export function monthRange(month: string): { start: string; end: string } {
  const prev = shiftMonth(month, -1);
  return { start: `${prev}-${CYCLE_START_DAY}`, end: `${month}-${CYCLE_START_DAY - 1}` };
}

/** Budget year range: "2026" -> { start: "2025-12-25", end: "2026-12-24" }. */
export function yearRange(year: string): { start: string; end: string } {
  return {
    start: `${Number(year) - 1}-12-${CYCLE_START_DAY}`,
    end: `${year}-12-${CYCLE_START_DAY - 1}`,
  };
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-07" -> "July 2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "2026-07-04" -> "4 Jul 2026" */
export function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
}

/** Shift "YYYY-MM" by delta months. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}
