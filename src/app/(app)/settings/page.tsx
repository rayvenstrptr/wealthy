import { signOut } from "@/lib/actions/auth";
import { getConfig, getInvestmentConfig } from "@/lib/data";
import { AssetClassesCard } from "@/components/settings/asset-classes-card";
import { BudgetTypesCard } from "@/components/settings/budget-types-card";
import { CategoriesCard } from "@/components/settings/categories-card";
import { ClassTargetsCard } from "@/components/settings/class-targets-card";
import { IncomeTypesCard } from "@/components/settings/income-types-card";
import { InvestmentItemsCard } from "@/components/settings/investment-items-card";
import { Button } from "@/components/ui/button";

export default async function SettingsPage() {
  const [config, investmentConfig] = await Promise.all([getConfig(), getInvestmentConfig()]);
  // Expense categories can only default to spending envelopes — investment
  // envelopes are deployed via the investments module.
  const spendingBudgetTypes = config.budgetTypes.filter(
    (t) => t.is_active && t.kind === "spending"
  );

  return (
    <div className="space-y-4">
      <h1 className="text-[28px] font-bold tracking-[-0.02em]">Settings</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <IncomeTypesCard incomeTypes={config.incomeTypes} />
        <CategoriesCard categories={config.categories} budgetTypes={spendingBudgetTypes} />
      </div>

      {/* Investments */}
      <div className="rounded-[16px] bg-card px-6 py-[22px] shadow-[0_1px_2px_rgba(38,35,30,0.05)]">
        <div className="text-[15px] font-bold">Investments</div>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          The Invest envelope funds these asset classes. Targets are per budget year — each
          income&apos;s Invest split × target % = the class budget.
        </p>

        <div className="mt-4">
          <AssetClassesCard assetClasses={investmentConfig.assetClasses} />
        </div>

        <div className="mt-5 grid gap-6 border-t border-border pt-5 md:grid-cols-2">
          <div>
            <div className="text-[13px] font-bold">Target split</div>
            <div className="mt-2.5">
              <ClassTargetsCard
                assetClasses={investmentConfig.assetClasses}
                targets={investmentConfig.targets}
              />
            </div>
          </div>
          <div>
            <div className="text-[13px] font-bold">Items</div>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              The things you buy — options in the transaction form.
            </p>
            <div className="mt-2.5">
              <InvestmentItemsCard
                assetClasses={investmentConfig.assetClasses}
                items={investmentConfig.items}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Envelopes + sign out */}
      <div className="rounded-[16px] bg-card px-6 py-[22px] shadow-[0_1px_2px_rgba(38,35,30,0.05)]">
        <div className="text-[15px] font-bold">Envelopes</div>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          Every income is split across these when you record it. The investment envelope is
          deployed on the Investments page, not via expenses.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
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
