import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { getConfig, getExpenses } from "@/lib/data";
import { envelopeHue } from "@/lib/envelope-colors";
import { formatIDR } from "@/lib/format";
import { summarizeEvent, type GroupTotalRow } from "@/lib/summary";
import { EditEventButton } from "@/components/event-dialogs";
import { ExpenseList } from "@/components/expense-list";

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

  const dateRange =
    event.starts_on || event.ends_on
      ? `${event.starts_on ? formatDate(event.starts_on) : "…"} – ${event.ends_on ? formatDate(event.ends_on) : "…"}`
      : null;

  return (
    <div className="mx-auto max-w-[820px] space-y-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href="/events"
            className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Events
          </Link>
          <h1 className="mt-1 truncate text-[22px] font-bold tracking-[-0.02em]">{event.name}</h1>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            {expenses.length} expense{expenses.length === 1 ? "" : "s"}
            {dateRange ? ` · ${dateRange}` : ""} · ignores period filters
          </p>
          {event.notes && <p className="mt-1 text-[13px] text-muted-foreground">{event.notes}</p>}
        </div>
        <EditEventButton event={event} />
      </div>

      {/* Ink total card */}
      <div className="rounded-[16px] bg-primary px-[22px] py-5 text-primary-foreground">
        <div className="text-[12px] font-medium text-on-ink">Event total</div>
        <div className="mt-1.5 text-[24px] font-bold tracking-[-0.01em] tabular-nums">
          {formatIDR(summary.total)}
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <div className="rounded-[16px] bg-card px-[22px] py-[18px] shadow-[0_1px_2px_rgba(38,35,30,0.05)]">
          <div className="text-[13.5px] font-bold">By budget type</div>
          <div className="mt-3 flex flex-col gap-2.5">
            {summary.byBudgetType.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No expenses yet.</p>
            ) : (
              summary.byBudgetType.map((row) => (
                <BudgetTypeBar key={row.id} row={row} total={summary.total} />
              ))
            )}
          </div>
        </div>

        <div className="rounded-[16px] bg-card px-[22px] py-[18px] shadow-[0_1px_2px_rgba(38,35,30,0.05)]">
          <div className="text-[13.5px] font-bold">By category</div>
          <div className="mt-2">
            {summary.byCategory.length === 0 ? (
              <p className="mt-1 text-[13px] text-muted-foreground">No expenses yet.</p>
            ) : (
              summary.byCategory.map((row, i, all) => (
                <div
                  key={row.id}
                  className="flex justify-between py-2 text-[13px]"
                  style={i === all.length - 1 ? undefined : { borderBottom: "1px solid var(--border)" }}
                >
                  <span>{row.name}</span>
                  <span className="font-semibold tabular-nums">{formatIDR(row.total)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2 pt-1">
        <h2 className="text-[13.5px] font-bold">Expenses ({expenses.length})</h2>
        <ExpenseList
          expenses={expenses}
          budgetTypes={config.budgetTypes}
          categories={config.categories}
          events={config.events}
          emptyTitle="No expenses yet"
          emptyHint="Add expenses to this event from the expense form."
        />
      </div>
    </div>
  );
}

function BudgetTypeBar({ row, total }: { row: GroupTotalRow; total: number }) {
  const hue = envelopeHue(row.name);
  const pct = total > 0 ? (row.total / total) * 100 : 0;
  return (
    <div className="grid grid-cols-[70px_1fr_110px] items-center gap-3.5 text-[12.5px]">
      <span className="flex items-center gap-1.5 font-semibold" style={{ color: hue.text }}>
        <span className="size-2 rounded-full" style={{ background: hue.fill }} />
        {row.name}
      </span>
      <div className="h-[5px] rounded-[3px] bg-border">
        <div className="h-full rounded-[3px]" style={{ width: `${pct}%`, background: hue.fill }} />
      </div>
      <span className="text-right font-semibold tabular-nums">{formatIDR(row.total)}</span>
    </div>
  );
}
