import { getConfig } from "@/lib/data";
import { ExpenseFab } from "@/components/expense-fab";
import { Nav } from "@/components/nav";

// Data changes on every visit (and mock mode reads a local file) — never prerender.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const config = await getConfig();

  return (
    <div className="min-h-dvh pb-24 md:pb-10">
      <Nav />
      <main className="mx-auto w-full max-w-3xl px-4 pt-4 md:pt-6">{children}</main>
      <ExpenseFab
        budgetTypes={config.budgetTypes.filter((b) => b.is_active)}
        categories={config.categories.filter((c) => c.is_active)}
        events={config.events}
      />
    </div>
  );
}
