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
import { formatIDR } from "@/lib/format";
import {
  computeBudgetPerformance,
  computeTotals,
  summarizeExpensesBy,
  summarizeIncomeByType,
} from "@/lib/summary";
import { BudgetPerformance } from "@/components/dashboard/budget-performance";
import { PeriodPicker, type DashboardView } from "@/components/dashboard/period-picker";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

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

  // Archived types stay in the math so history renders correctly; rows for
  // archived budget types are shown only if they have activity in the window.
  // All-time uses the yearly rule: every income type's split applies.
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
  const recentExpenses = expenses.slice(0, 10);
  const noSalaryThisMonth = view === "monthly" && performance.monthlyCadenceIncomeTotal === 0;

  return (
    <div className="space-y-4">
      <PeriodPicker view={view} month={month} year={year} />

      <p className="text-xs text-muted-foreground">
        {range
          ? `Budget ${view === "monthly" ? "month" : "year"}: ${formatDate(range.start)} – ${formatDate(range.end)}`
          : "Everything ever recorded"}
      </p>

      {performance.unallocatedIncomeTypeNames.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {performance.unallocatedIncomeTypeNames.map((name) => (
            <Badge
              key={name}
              variant="outline"
              className="border-amber-400 text-amber-700 dark:text-amber-400"
            >
              ⚠ {name} has no budget split configured
            </Badge>
          ))}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <StatCard label="Total Income" value={totals.income} tone="income" />
        <StatCard label="Total Expenses" value={totals.expenses} tone="expense" />
        <StatCard label="Net" value={totals.net} tone={totals.net >= 0 ? "income" : "expense"} />
      </div>

      {/* Budget performance */}
      <Card>
        <CardHeader>
          <CardTitle>Budget performance</CardTitle>
          <CardDescription>
            {view === "monthly"
              ? `Salary-based budget for ${monthLabel(month)}`
              : view === "yearly"
                ? `All income received in ${year} × each type's split`
                : "All income ever received × each type's split"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {noSalaryThisMonth && (
            <p className="mb-3 rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
              No monthly-cadence income (Salary) recorded this month — allocated amounts are 0.
            </p>
          )}
          <BudgetPerformance rows={performanceRows} />
        </CardContent>
      </Card>

      {/* Income by type */}
      <Card>
        <CardHeader>
          <CardTitle>Income by type</CardTitle>
        </CardHeader>
        <CardContent>
          {incomeByType.length === 0 ? (
            <p className="text-sm text-muted-foreground">No income recorded in this period.</p>
          ) : view !== "monthly" ? (
            <div className="space-y-4">
              <IncomeGroup
                label="Monthly cadence"
                rows={incomeByType.filter((r) => r.cadence === "monthly")}
              />
              <IncomeGroup
                label="Yearly cadence"
                rows={incomeByType.filter((r) => r.cadence === "yearly")}
              />
            </div>
          ) : (
            <IncomeGroup rows={incomeByType} />
          )}
        </CardContent>
      </Card>

      {/* Expenses by category — collapsed / less prominent */}
      <details className="rounded-xl border">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
          Expenses by category
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({byCategory.length} categories)
          </span>
        </summary>
        <div className="border-t px-4 py-3">
          {byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expenses in this period.</p>
          ) : (
            <ul className="space-y-1.5">
              {byCategory.map((row) => (
                <li key={row.id} className="flex items-center justify-between text-sm">
                  <span>{row.name}</span>
                  <span className="tabular-nums">{formatIDR(row.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>

      {/* Recent expenses — monthly view only */}
      {view === "monthly" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent expenses</CardTitle>
            <Link href="/expenses" className="text-xs text-muted-foreground hover:text-foreground">
              View all →
            </Link>
          </CardHeader>
          <CardContent>
            {recentExpenses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing yet — tap “+ Expense” to add your first one.
              </p>
            ) : (
              <ul className="space-y-2">
                {recentExpenses.map((expense) => (
                  <li key={expense.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <span className="truncate">{expense.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {formatDate(expense.date)}
                      </span>
                    </div>
                    <span className="shrink-0 tabular-nums">{formatIDR(expense.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "income" | "expense";
}) {
  return (
    <Card className="gap-1 py-4">
      <CardHeader className="px-3 md:px-4">
        <CardDescription className="text-xs">{label}</CardDescription>
      </CardHeader>
      <CardContent className="px-3 md:px-4">
        <p
          className={cn(
            "text-sm font-semibold tabular-nums md:text-lg",
            tone === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
          )}
        >
          {formatIDR(value)}
        </p>
      </CardContent>
    </Card>
  );
}

function IncomeGroup({
  label,
  rows,
}: {
  label?: string;
  rows: { income_type_id: string; name: string; total: number }[];
}) {
  if (rows.length === 0) {
    return label ? (
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">{label}</p>
        <p className="text-sm text-muted-foreground">None.</p>
      </div>
    ) : null;
  }
  return (
    <div>
      {label && (
        <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase">{label}</p>
      )}
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li key={row.income_type_id} className="flex items-center justify-between text-sm">
            <span>{row.name}</span>
            <span className="tabular-nums">{formatIDR(row.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
