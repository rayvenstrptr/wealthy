import { signOut } from "@/lib/actions/auth";
import { getConfig, getIncomes } from "@/lib/data";
import { AllocationMatrix } from "@/components/settings/allocation-matrix";
import { BudgetTypesCard } from "@/components/settings/budget-types-card";
import { CategoriesCard } from "@/components/settings/categories-card";
import { IncomeTypesCard } from "@/components/settings/income-types-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function SettingsPage() {
  const [config, allIncomes] = await Promise.all([getConfig(), getIncomes()]);
  const activeIncomeTypes = config.incomeTypes.filter((t) => t.is_active);
  const activeBudgetTypes = config.budgetTypes.filter((t) => t.is_active);

  // Most recent actual income per type (incomes come sorted date desc) — used
  // by the matrix to sanity-check amount-mode rows against reality.
  const latestIncomeByType: Record<string, number> = {};
  for (const income of allIncomes) {
    if (!(income.income_type_id in latestIncomeByType)) {
      latestIncomeByType[income.income_type_id] = income.amount;
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Income types</CardTitle>
          <CardDescription>
            Monthly cadence drives the monthly budget (Salary); yearly types are budgeted on the
            yearly window.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IncomeTypesCard incomeTypes={config.incomeTypes} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Budget types</CardTitle>
          <CardDescription>The envelopes money is allocated to.</CardDescription>
        </CardHeader>
        <CardContent>
          <BudgetTypesCard budgetTypes={config.budgetTypes} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Budget allocation matrix</CardTitle>
          <CardDescription>
            Per income type: how each rupiah received is split across budget types. Amounts are
            only a convenient way to define percentages — actual allocation is always derived % ×
            income received.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AllocationMatrix
            incomeTypes={activeIncomeTypes}
            budgetTypes={activeBudgetTypes}
            allocations={config.allocations}
            latestIncomeByType={latestIncomeByType}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Expense categories</CardTitle>
          <CardDescription>
            What money was spent on. The default budget type prefills the expense form.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CategoriesCard categories={config.categories} budgetTypes={activeBudgetTypes} />
        </CardContent>
      </Card>

      <form action={signOut}>
        <Button type="submit" variant="outline" className="w-full">
          Sign out
        </Button>
      </form>
    </div>
  );
}
