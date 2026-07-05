import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { getConfig, getEventTotals } from "@/lib/data";
import { formatIDR } from "@/lib/format";
import { NewEventButton } from "@/components/event-dialogs";

export default async function EventsPage() {
  const [config, totals] = await Promise.all([getConfig(), getEventTotals()]);

  return (
    <div className="mx-auto max-w-[620px] space-y-[18px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.02em]">Events</h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Cross-month spending buckets — trips, celebrations, projects.
          </p>
        </div>
        <NewEventButton />
      </div>

      {config.events.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-input bg-card px-6 py-8 text-center">
          <div className="text-[13.5px] font-semibold">No events yet</div>
          <div className="mt-1 text-[12.5px] text-muted-foreground">
            Events group expenses across months — trips, celebrations, projects.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {config.events.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="flex items-center justify-between gap-4 rounded-[16px] bg-card px-[22px] py-[18px] shadow-[0_1px_2px_rgba(38,35,30,0.05)] transition-shadow hover:shadow-[0_3px_8px_rgba(38,35,30,0.1)]"
            >
              <div className="min-w-0">
                <div className="truncate text-[14.5px] font-bold">{event.name}</div>
                {(event.starts_on || event.ends_on) && (
                  <div className="mt-0.5 text-[12px] text-muted-foreground">
                    {event.starts_on ? formatDate(event.starts_on) : "…"} –{" "}
                    {event.ends_on ? formatDate(event.ends_on) : "…"}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3.5">
                <span className="text-[15px] font-bold tabular-nums">
                  {formatIDR(totals.get(event.id) ?? 0)}
                </span>
                <ChevronRight className="size-4 shrink-0 text-placeholder" />
              </div>
            </Link>
          ))}

          <NewEventButton
            render={
              <button className="rounded-[16px] border border-dashed border-input bg-transparent px-[22px] py-3.5 text-center text-[13px] text-muted-foreground transition-colors hover:bg-card">
                + New event
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}
