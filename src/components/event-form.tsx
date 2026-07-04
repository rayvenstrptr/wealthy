"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createEvent, deleteEvent, updateEvent } from "@/lib/actions/entries";
import type { EventRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface EventFormProps {
  initial?: EventRow;
  onSaved?: () => void;
}

export function EventForm({ initial, onSaved }: EventFormProps) {
  const isEdit = initial !== undefined;

  const [name, setName] = useState(initial?.name ?? "");
  const [startsOn, setStartsOn] = useState(initial?.starts_on ?? "");
  const [endsOn, setEndsOn] = useState(initial?.ends_on ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Event name is required.");

    setBusy(true);
    try {
      const payload = {
        name,
        starts_on: startsOn || null,
        ends_on: endsOn || null,
        notes: notes || null,
      };
      const result = isEdit ? await updateEvent(initial.id, payload) : await createEvent(payload);
      if (!result.ok) return toast.error(result.error);

      toast.success(isEdit ? "Event updated" : "Event created");
      if (!isEdit) {
        setName("");
        setStartsOn("");
        setEndsOn("");
        setNotes("");
      }
      onSaved?.();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!isEdit) return;
    if (!window.confirm("Delete this event?")) return;
    setBusy(true);
    try {
      const result = await deleteEvent(initial.id);
      if (!result.ok) return toast.error(result.error);
      toast.success("Event deleted");
      onSaved?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="event-name">Name</Label>
        <Input
          id="event-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bali trip"
          autoComplete="off"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="event-starts">Starts (optional)</Label>
          <Input
            id="event-starts"
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="event-ends">Ends (optional)</Label>
          <Input
            id="event-ends"
            type="date"
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="event-notes">Notes (optional)</Label>
        <Textarea id="event-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" className="flex-1" disabled={busy}>
          {busy ? "Saving…" : isEdit ? "Save changes" : "Create event"}
        </Button>
        {isEdit && (
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={busy}>
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}
