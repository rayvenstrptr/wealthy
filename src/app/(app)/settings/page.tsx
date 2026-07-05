import { signOut } from "@/lib/actions/auth";
import { getConfig, getIncomes } from "@/lib/data";
import { AllocationMatrix } from "@/components/settings/allocation-matrix";
import { BudgetTypesCard } from "@/components/settings/budget-types-card";
import { CategoriesCard } from "@/components/settings/categories-card";
import { IncomeTypesCard } from "@/components/settings/income-types-card";
import { Button } from "@/components/ui/button";

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
    <div className="space-y-4">
      <h1 className="text-[28px] font-bold tracking-[-0.02em]">Settings</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <IncomeTypesCard incomeTypes={config.incomeTypes} />
        <CategoriesCard categories={config.categories} budgetTypes={activeBudgetTypes} />
      </div>

      <div className="rounded-[16px] bg-card px-6 py-[22px] shadow-[0_1px_2px_rgba(38,35,30,0.05)]">
        <div className="text-[15px] font-bold">Budget allocation matrix</div>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          Each income type defines its own split. Amounts are just a way to write percentages —
          actual allocation is always derived % × income received.
        </p>
        <div className="mt-4">
          <AllocationMatrix
            incomeTypes={activeIncomeTypes}
            budgetTypes={activeBudgetTypes}
            allocations={config.allocations}
            latestIncomeByType={latestIncomeByType}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-border pt-4">
          <span className="mr-1 text-[13px] font-bold">Budget types</span>
          <BudgetTypesCard budgetTypes={config.budgetTypes} />
          <form action={signOut} className="ml-auto">
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
