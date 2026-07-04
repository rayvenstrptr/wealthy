import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { getConfig, getEventTotals } from "@/lib/data";
import { formatIDR } from "@/lib/format";
import { NewEventButton } from "@/components/event-dialogs";

export default async function EventsPage() {
  const [config, totals] = await Promise.all([getConfig(), getEventTotals()]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Events</h1>
        <NewEventButton />
      </div>

      {config.events.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No events yet. Events group expenses across months — trips, celebrations, projects.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {config.events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/events/${event.id}`}
                className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{event.name}</div>
                  {(event.starts_on || event.ends_on) && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {event.starts_on ? formatDate(event.starts_on) : "…"} –{" "}
                      {event.ends_on ? formatDate(event.ends_on) : "…"}
                    </div>
                  )}
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums">
                  {formatIDR(totals.get(event.id) ?? 0)}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
