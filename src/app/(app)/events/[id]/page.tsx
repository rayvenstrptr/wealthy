import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { getConfig, getExpenses } from "@/lib/data";
import { formatIDR } from "@/lib/format";
import { summarizeEvent } from "@/lib/summary";
import { EditEventButton } from "@/components/event-dialogs";
import { ExpenseList } from "@/components/expense-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const config = await getConfig();
  const event = config.events.find((e) => e.id === id);
  if (!event) notFound();

  // Event summaries deliberately ignore month/year filters — events cross periods.
  const expenses = await getExpenses({ eventId: id });
  const summary = summarizeEvent(expenses, config.budgetTypes, config.categories);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <Link
            href="/events"
            className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
            Events
          </Link>
          <h1 className="truncate text-xl font-semibold">{event.name}</h1>
          {(event.starts_on || event.ends_on) && (
            <p className="text-sm text-muted-foreground">
              {event.starts_on ? formatDate(event.starts_on) : "…"} –{" "}
              {event.ends_on ? formatDate(event.ends_on) : "…"}
            </p>
          )}
          {event.notes && <p className="mt-1 text-sm text-muted-foreground">{event.notes}</p>}
        </div>
        <EditEventButton event={event} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Total spent</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">{formatIDR(summary.total)}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">By budget type</CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownTable rows={summary.byBudgetType} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">By category</CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownTable rows={summary.byCategory} />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium">Expenses ({expenses.length})</h2>
        <ExpenseList
          expenses={expenses}
          budgetTypes={config.budgetTypes}
          categories={config.categories}
          events={config.events}
        />
      </div>
    </div>
  );
}

function BreakdownTable({ rows }: { rows: { id: string; name: string; total: number }[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No expenses yet.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center justify-between text-sm">
          <span>{row.name}</span>
          <span className="tabular-nums">{formatIDR(row.total)}</span>
        </li>
      ))}
    </ul>
  );
}
