import { describe, expect, it } from "vitest";
import {
  classifyRow,
  duplicateStatus,
  excelSerialToIso,
  toIsoDate,
  type RawImportRow,
} from "./core";

const OPTS = { investmentEnvelopes: ["Invest"] };

function raw(overrides: Partial<RawImportRow>): RawImportRow {
  return {
    rowNumber: 2,
    cat: "Makan",
    details: "kfc",
    date: 45651,
    ex: { value: 124700, formula: null },
    inc: { value: null, formula: null },
    type: "Life",
    notes: null,
    ...overrides,
  };
}

describe("excelSerialToIso", () => {
  it("converts 1900-system serials (45651 = payday 25 Dec 2024)", () => {
    expect(excelSerialToIso(45651)).toBe("2024-12-25");
    expect(excelSerialToIso(45652)).toBe("2024-12-26");
  });

  it("handles Date objects and ISO strings via toIsoDate", () => {
    expect(toIsoDate(new Date(Date.UTC(2025, 0, 15)))).toBe("2025-01-15");
    expect(toIsoDate("2025-01-15")).toBe("2025-01-15");
    expect(toIsoDate(null)).toBeNull();
    expect(toIsoDate("garbage")).toBeNull();
  });
});

describe("classifyRow", () => {
  it("classifies an Ex row as an expense", () => {
    const result = classifyRow(raw({}), OPTS);
    expect(result && "entry" in result && result.entry).toMatchObject({
      kind: "expense",
      name: "kfc",
      amount: 124700,
      date: "2024-12-25",
      category: "Makan",
      type: "Life",
    });
  });

  it("classifies an In row as an income", () => {
    const result = classifyRow(
      raw({
        cat: "In",
        details: "in",
        ex: { value: null, formula: null },
        inc: { value: 15_000_000, formula: null },
        type: "Salary",
      }),
      OPTS
    );
    expect(result && "entry" in result && result.entry).toMatchObject({
      kind: "income",
      amount: 15_000_000,
      type: "Salary",
    });
  });

  it("keeps only the final amount and moves the calculation into notes", () => {
    const result = classifyRow(
      raw({ ex: { value: 2_700_000, formula: "5400000/2" } }),
      OPTS
    );
    const entry = result && "entry" in result ? result.entry : null;
    expect(entry?.amount).toBe(2_700_000);
    expect(entry?.notes).toContain("calc: 5400000/2");
  });

  it("appends the calc after existing notes", () => {
    const result = classifyRow(
      raw({ notes: "split with kenneth", ex: { value: 100, formula: "200/2" } }),
      OPTS
    );
    const entry = result && "entry" in result ? result.entry : null;
    expect(entry?.notes).toBe("split with kenneth · calc: 200/2");
  });

  it("allows negative expenses (surplus) with a warning", () => {
    const result = classifyRow(raw({ ex: { value: -180_000, formula: null } }), OPTS);
    const entry = result && "entry" in result ? result.entry : null;
    expect(entry?.amount).toBe(-180_000);
    expect(entry?.warnings.some((w) => w.includes("surplus"))).toBe(true);
  });

  it("rounds decimal amounts and keeps the original in notes", () => {
    const result = classifyRow(raw({ ex: { value: 1214.05, formula: null } }), OPTS);
    const entry = result && "entry" in result ? result.entry : null;
    expect(entry?.amount).toBe(1214);
    expect(entry?.notes).toContain("orig: 1214.05");
  });

  it("falls back to the category when the name is missing", () => {
    const result = classifyRow(raw({ details: null }), OPTS);
    const entry = result && "entry" in result ? result.entry : null;
    expect(entry?.name).toBe("Makan");
    expect(entry?.warnings.length).toBeGreaterThan(0);
  });

  it("rejects investment rows — they belong in the Investments module", () => {
    const result = classifyRow(raw({ cat: "Inv", type: "Investment" }), OPTS);
    expect(result && "rejected" in result && result.rejected.reason).toMatch(/Investments module/);
    const invest = classifyRow(raw({ type: "Invest" }), OPTS);
    expect(invest && "rejected" in invest).toBe(true);
  });

  it("rejects rows with no amount, both amounts, or no date", () => {
    const none = classifyRow(raw({ ex: { value: null, formula: null } }), OPTS);
    expect(none && "rejected" in none).toBe(true);
    const both = classifyRow(raw({ inc: { value: 5, formula: null } }), OPTS);
    expect(both && "rejected" in both).toBe(true);
    const noDate = classifyRow(raw({ date: null }), OPTS);
    expect(noDate && "rejected" in noDate).toBe(true);
  });

  it("ignores fully blank rows", () => {
    expect(
      classifyRow(
        raw({
          cat: null,
          details: null,
          date: null,
          type: null,
          ex: { value: null, formula: null },
          inc: { value: null, formula: null },
        }),
        OPTS
      )
    ).toBeNull();
  });
});

describe("duplicateStatus", () => {
  const existing = [{ name: "kfc", amount: 124700, date: "2025-01-10" }];

  it("flags an exact name+amount+date match", () => {
    expect(duplicateStatus({ name: "KFC", amount: 124700, date: "2025-01-10" }, existing)).toBe(
      "exact"
    );
  });

  it("flags the same name+amount within ±3 days as similar", () => {
    expect(duplicateStatus({ name: "kfc", amount: 124700, date: "2025-01-12" }, existing)).toBe(
      "similar"
    );
    expect(duplicateStatus({ name: "kfc", amount: 124700, date: "2025-01-20" }, existing)).toBe(
      "none"
    );
  });

  it("flags a different name with the same amount on the same date as similar", () => {
    expect(duplicateStatus({ name: "warteg", amount: 124700, date: "2025-01-10" }, existing)).toBe(
      "similar"
    );
  });

  it("ignores different amounts", () => {
    expect(duplicateStatus({ name: "kfc", amount: 999, date: "2025-01-10" }, existing)).toBe(
      "none"
    );
  });
});
