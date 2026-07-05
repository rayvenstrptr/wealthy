"use client";

import { cloneElement, isValidElement, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import type { EventRow } from "@/lib/types";
import { EventForm } from "@/components/event-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function NewEventButton({ render }: { render?: React.ReactElement }) {
  const [open, setOpen] = useState(false);

  const trigger =
    render && isValidElement(render) ? (
      cloneElement(render as React.ReactElement<{ onClick?: () => void }>, {
        onClick: () => setOpen(true),
      })
    ) : (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Event
      </Button>
    );

  return (
    <>
      {trigger}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>New event</DialogTitle>
          </DialogHeader>
          <EventForm onSaved={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EditEventButton({ event }: { event: EventRow }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button
        size="icon"
        variant="secondary"
        className="shrink-0"
        onClick={() => setOpen(true)}
        aria-label="Edit event"
      >
        <Pencil className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Edit event</DialogTitle>
          </DialogHeader>
          <EventForm
            initial={event}
            onSaved={() => {
              setOpen(false);
              // The event may have been deleted — go back to the list.
              router.push("/events");
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
