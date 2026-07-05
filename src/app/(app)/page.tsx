import Link from "next/link";
import {
  currentMonthWIB,
  currentYearWIB,
  formatDate,
  monthLabel,
  monthRange,
  yearRange,
} from "@/lib/dates";
import { getConfig, getExpenses, getIncomes } from "@/lib/data";
import { envelopeHue } from "@/lib/envelope-colors";
import { formatIDR } from "@/lib/format";
import {
  computeBudgetPerformance,
  computeTotals,
  summarizeExpensesBy,
  summarizeIncomeByType,
} from "@/lib/summary";
import { EnvelopeCard, EnvelopeRow } from "@/components/dashboard/envelope-card";
import {
  MobilePeriod,
  PeriodPicker,
  type DashboardView,
} from "@/components/dashboard/period-picker";
import { Badge } from "@/components/ui/badge";

interface SearchParams {
  view?: string;
  month?: string;
  year?: string;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const view: DashboardView =
    params.view === "yearly" ? "yearly" : params.view === "alltime" ? "alltime" : "monthly";
  const month = params.month ?? currentMonthWIB();
  const year = params.year ?? currentYearWIB();
  const range =
    view === "monthly" ? monthRange(month) : view === "yearly" ? yearRange(year) : undefined;

  const [config, incomes, expenses] = await Promise.all([
    getConfig(),
    getIncomes({ start: range?.start, end: range?.end }),
    getExpenses({ start: range?.start, end: range?.end }),
  ]);

  const totals = computeTotals(incomes, expenses);

  const performance = computeBudgetPerformance({
    window: view === "monthly" ? "monthly" : "yearly",
    incomeTypes: config.incomeTypes,
    budgetTypes: config.budgetTypes,
    allocations: config.allocations,
    incomes,
    expenses,
  });
  const activeById = new Map(config.budgetTypes.map((b) => [b.id, b.is_active]));
  const performanceRows = performance.rows.filter(
    (row) => activeById.get(row.budget_type_id) || row.allocated !== 0 || row.spent !== 0
  );

  const incomeByType = summarizeIncomeByType(incomes, config.incomeTypes);
  const byCategory = summarizeExpensesBy(expenses, "expense_category_id", config.categories);
  const recentExpenses = expenses.slice(0, view === "monthly" ? 4 : 6);
  const noSalaryThisMonth = view === "monthly" && performance.monthlyCadenceIncomeTotal === 0;

  const budgetNameById = new Map(config.budgetTypes.map((b) => [b.id, b.name]));

  const title =
    view === "monthly" ? monthLabel(month) : view === "yearly" ? year : "All time";
  const caption = range
    ? `${formatDate(range.start)} – ${formatDate(range.end)} · budget ${view === "monthly" ? "month" : "year"}`
    : "Everything ever recorded";
  const envelopeHint =
    view === "monthly"
      ? "Salary-based budget"
      : view === "yearly"
        ? `All income received in ${year} × each type's split`
        : "All income ever received × each type's split";

  const warnings = performance.unallocatedIncomeTypeNames;

  return (
    <div className="pb-4">
      {/* ============ MOBILE ============ */}
      <div className="md:hidden">
        <MobilePeriod view={view} month={month} year={year} />

        {warnings.length > 0 && <WarningChips names={warnings} className="mt-4" />}

        {/* Ink hero replaces the stat trio on mobile */}
        <div className="mt-[18px] rounded-[16px] bg-primary px-5 py-[18px] text-primary-foreground">
          <div className="text-[11.5px] font-medium text-on-ink">
            {view === "monthly" ? "Net this month" : "Net"}
          </div>
          <div
            className="mt-1 text-[26px] font-bold tracking-[-0.01em] tabular-nums"
            style={totals.net < 0 ? { color: "oklch(0.72 0.15 25)" } : undefined}
          >
            {netLabel(totals.net)}
          </div>
          <div className="mt-3 flex gap-[18px] text-[11.5px] text-on-ink">
            <span>
              In <b className="font-semibold text-primary-foreground tabular-nums">{formatIDR(totals.income)}</b>
            </span>
            <span>
              Out <b className="font-semibold text-primary-foreground tabular-nums">{formatIDR(totals.expenses)}</b>
            </span>
          </div>
        </div>

        <div className="mt-[22px] text-[14px] font-bold">Envelopes</div>
        {noSalaryThisMonth && <NoSalaryNote className="mt-2.5" />}
        <div className="mt-2.5 flex flex-col gap-[9px]">
          {performanceRows.map((row) => (
            <EnvelopeRow key={row.budget_type_id} row={row} />
          ))}
        </div>

        {view === "monthly" && (
          <>
            <div className="mt-[22px] flex items-baseline justify-between">
              <span className="text-[14px] font-bold">Recent expenses</span>
              <Link href="/expenses" className="text-[11.5px] text-muted-foreground">
                View all →
              </Link>
            </div>
            <div className="mt-2.5 overflow-hidden rounded-[14px] bg-card shadow-[0_1px_2px_rgba(38,35,30,0.05)]">
              {recentExpenses.length === 0 ? (
                <p className="p-4 text-[13px] text-muted-foreground">Nothing yet.</p>
              ) : (
                recentExpenses.map((expense, i) => (
                  <div
                    key={expense.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 px-4 py-3 text-[13px]"
                    style={
                      i < recentExpenses.length - 1
                        ? { borderBottom: "1px solid var(--border)" }
                        : undefined
                    }
                  >
                    <Dot name={budgetNameById.get(expense.budget_type_id)} size={7} />
                    <span className="truncate">{expense.name}</span>
                    <span className="font-semibold tabular-nums">{formatIDR(expense.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* ============ DESKTOP ============ */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold tracking-[-0.02em]">{title}</h1>
            <p className="mt-1 text-[12.5px] text-muted-foreground">{caption}</p>
          </div>
          <PeriodPicker view={view} month={month} year={year} />
        </div>

        {warnings.length > 0 && <WarningChips names={warnings} className="mt-6" />}

        {/* Stat trio */}
        <div className="mt-6 grid grid-cols-3 gap-3.5">
          <StatCard label="Total income" value={totals.income} />
          <StatCard label="Total expenses" value={totals.expenses} />
          <div className="rounded-[16px] bg-primary px-[22px] py-5 text-primary-foreground">
            <div className="text-[12px] font-medium text-on-ink">Net</div>
            <div
              className="mt-1.5 text-[24px] font-bold tracking-[-0.01em] tabular-nums"
              style={totals.net < 0 ? { color: "oklch(0.72 0.15 25)" } : undefined}
            >
              {netLabel(totals.net)}
            </div>
          </div>
        </div>

        {/* Envelopes */}
        <div className="mt-[30px] flex items-baseline justify-between">
          <div className="text-[16px] font-bold">Envelopes</div>
          <div className="text-[12.5px] text-muted-foreground">{envelopeHint}</div>
        </div>
        {noSalaryThisMonth && <NoSalaryNote className="mt-3.5" />}
        <div className="mt-3.5 grid grid-cols-5 gap-3.5">
          {performanceRows.map((row) => (
            <EnvelopeCard key={row.budget_type_id} row={row} />
          ))}
        </div>

        {/* Lower grid */}
        <div
          className="mt-6 grid gap-3.5"
          style={{ gridTemplateColumns: view === "monthly" ? "1.4fr 1fr" : "1fr 1fr" }}
        >
          {view === "monthly" ? (
            <Panel>
              <PanelHead title="Recent expenses" hint={<Link href="/expenses" className="text-[12.5px] text-muted-foreground hover:text-foreground">View all →</Link>} />
              {recentExpenses.length === 0 ? (
                <EmptyLine />
              ) : (
                <div className="mt-2">
                  {recentExpenses.map((expense, i) => (
                    <div
                      key={expense.id}
                      className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 py-2.5 text-[13.5px]"
                      style={
                        i < recentExpenses.length - 1
                          ? { borderBottom: "1px solid var(--border)" }
                          : undefined
                      }
                    >
                      <Dot name={budgetNameById.get(expense.budget_type_id)} size={8} />
                      <span className="truncate">{expense.name}</span>
                      <span className="text-[11.5px] text-muted-foreground">
                        {formatDate(expense.date)}
                      </span>
                      <span className="min-w-[100px] text-right font-semibold tabular-nums">
                        {formatIDR(expense.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          ) : (
            <Panel>
              <div className="text-[15px] font-bold">Income by type</div>
              {incomeByType.length === 0 ? (
                <EmptyLine />
              ) : (
                <div className="mt-2 space-y-3.5">
                  <IncomeGroup label="Monthly cadence" rows={incomeByType.filter((r) => r.cadence === "monthly")} />
                  <IncomeGroup label="Yearly cadence" rows={incomeByType.filter((r) => r.cadence === "yearly")} />
                </div>
              )}
            </Panel>
          )}

          <Panel>
            <PanelHead
              title="Expenses by category"
              hint={
                <span className="text-[12.5px] text-muted-foreground">
                  {byCategory.length > 6 ? `top 6 of ${byCategory.length}` : `${byCategory.length} categories`}
                </span>
              }
            />
            {byCategory.length === 0 ? (
              <EmptyLine />
            ) : (
              <div className="mt-2">
                {byCategory.slice(0, 6).map((row, i, shown) => (
                  <MoneyRow key={row.id} label={row.name} value={row.total} last={i === shown.length - 1} />
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- helpers ----------------------------- */

function netLabel(net: number): string {
  return net >= 0 ? `+ ${formatIDR(net)}` : formatIDR(net);
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[16px] bg-card px-[22px] py-5 shadow-[0_1px_2px_rgba(38,35,30,0.05)]">
      <div className="text-[12px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1.5 text-[24px] font-bold tracking-[-0.01em] tabular-nums">
        {formatIDR(value)}
      </div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[16px] bg-card px-[22px] py-5 shadow-[0_1px_2px_rgba(38,35,30,0.05)]">
      {children}
    </div>
  );
}

function PanelHead({ title, hint }: { title: string; hint?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[15px] font-bold">{title}</span>
      {hint}
    </div>
  );
}

function MoneyRow({ label, value, last }: { label: string; value: number; last?: boolean }) {
  return (
    <div
      className="flex justify-between py-[9px] text-[13.5px]"
      style={last ? undefined : { borderBottom: "1px solid var(--border)" }}
    >
      <span>{label}</span>
      <span className="font-semibold tabular-nums">{formatIDR(value)}</span>
    </div>
  );
}

function IncomeGroup({
  label,
  rows,
}: {
  label: string;
  rows: { income_type_id: string; name: string; total: number }[];
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-1">
        {rows.map((row, i) => (
          <MoneyRow key={row.income_type_id} label={row.name} value={row.total} last={i === rows.length - 1} />
        ))}
      </div>
    </div>
  );
}

function Dot({ name, size }: { name: string | undefined; size: number }) {
  return (
    <span
      className="inline-block rounded-full"
      style={{ width: size, height: size, background: envelopeHue(name).fill }}
    />
  );
}

function WarningChips({ names, className }: { names: string[]; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className ?? ""}`}>
      {names.map((name) => (
        <Badge key={name} variant="warning">
          ⚠ {name} has no budget split configured
        </Badge>
      ))}
    </div>
  );
}

function NoSalaryNote({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-[14px] border border-dashed border-input bg-sunken px-4 py-3 text-[12.5px] text-muted-foreground ${className ?? ""}`}
    >
      No monthly-cadence income (Salary) recorded this month — allocations are Rp 0.
    </div>
  );
}

function EmptyLine() {
  return <p className="mt-2 text-[13px] text-muted-foreground">Nothing in this period.</p>;
}
