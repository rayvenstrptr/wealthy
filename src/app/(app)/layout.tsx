import { redirect } from "next/navigation";
import { getConfig } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth/session";
import { AddExpenseProvider } from "@/components/add-expense-provider";
import { ExpenseFab } from "@/components/expense-fab";
import { Nav } from "@/components/nav";

// Data changes on every visit (and mock mode reads a local file) — never prerender.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Middleware only checks the cookie exists; this verifies its signature.
  // A bad cookie goes through /auth/reset (which clears it) — redirecting
  // straight to /login would loop, since middleware sees a cookie and bounces back.
  const username = await getCurrentUser();
  if (!username) redirect("/auth/reset");

  const config = await getConfig();
  const budgetTypes = config.budgetTypes.filter((b) => b.is_active);
  const categories = config.categories.filter((c) => c.is_active);

  return (
    <AddExpenseProvider budgetTypes={budgetTypes} categories={categories} events={config.events}>
      <div className="min-h-dvh bg-background pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-16">
        <Nav username={username} />
        <main className="mx-auto w-full max-w-[1120px] px-4 pt-5 md:px-8 md:pt-8">{children}</main>
        <ExpenseFab />
      </div>
    </AddExpenseProvider>
  );
}
