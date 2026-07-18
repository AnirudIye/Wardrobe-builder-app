import { useEffect, useState } from "react";
import { api, CalendarEvent } from "../api";
import { useFadeRise, useStaggerReveal } from "../animations";
import { ListSkeleton } from "../components/Skeleton";
import ConfirmDialog from "../components/ConfirmDialog";
import ErrorNote from "../components/ErrorNote";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import { Calendar as CalendarIll } from "../components/illustrations";
import { localISODate } from "../date";
import { eventsCache } from "../store";

const EVENT_TYPES = ["athletic", "casual", "smart-casual", "business", "formal"];

// Meaningful color coding: the tint follows the formality scale the
// recommendation engine itself uses (light and playful -> dark and formal).
const TYPE_TINT: Record<string, string> = {
  athletic: "bg-cream-deep text-navy/70",
  casual: "bg-blush-soft/70 text-navy/80",
  "smart-casual": "bg-blush/60 text-navy",
  business: "bg-navy/10 text-navy",
  formal: "bg-navy text-cream",
};

export default function Calendar() {
  const pageRef = useFadeRise<HTMLDivElement>();
  const [events, setEvents] = useState<CalendarEvent[]>(eventsCache.peek() ?? []);
  const [loading, setLoading] = useState(eventsCache.peek() === null);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const pendingEvent = events.find((e) => e.id === confirmId) ?? null;

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => localISODate());
  const [eventType, setEventType] = useState("casual");
  const [notes, setNotes] = useState("");

  const syncEvents = (next: CalendarEvent[]) => {
    eventsCache.set(next);
    setEvents(next);
  };

  useEffect(() => {
    eventsCache.get().then((e) => {
      setEvents(e);
      setLoading(false);
    });
  }, []);

  // Optimistic add: show the event instantly with a temp id, swap in the real
  // one when the server responds, remove it again on failure.
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const tempId = -Date.now();
    const optimistic: CalendarEvent = {
      id: tempId,
      title,
      date,
      event_type: eventType,
      notes: notes || null,
    };
    const before = events;
    syncEvents(
      [...events, optimistic].sort((a, b) => a.date.localeCompare(b.date))
    );
    setTitle("");
    setNotes("");
    api
      .createEvent({ title: optimistic.title, date, event_type: eventType, notes: optimistic.notes ?? undefined })
      .then((created) =>
        syncEvents(
          (eventsCache.peek() ?? []).map((ev) => (ev.id === tempId ? created : ev))
        )
      )
      .catch((err) => {
        syncEvents(before);
        setError((err as Error).message);
      });
  };

  // Optimistic delete: remove instantly, restore on failure.
  const remove = (id: number) => {
    const before = events;
    syncEvents(events.filter((ev) => ev.id !== id));
    if (id < 0) return; // optimistic row that hasn't been created yet
    api.deleteEvent(id).catch((err) => {
      syncEvents(before);
      setError((err as Error).message);
    });
  };

  const today = localISODate();
  const listRef = useStaggerReveal<HTMLUListElement>(loading ? null : events.length);

  return (
    <div ref={pageRef}>
      <PageHeader
        title="Your Calendar"
        context={`Today is ${new Date().toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}. Outfit recommendations match the dress code of whatever the day holds.`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Rail: add-event form with labelled fields */}
        <form onSubmit={submit} className="clay-card blob-card-a p-6 space-y-4 lg:order-2">
          <h3 className="font-semibold">Add an event</h3>
          <label className="block">
            <span className="text-xs font-medium text-navy/50">Title</span>
            <input
              required
              placeholder="Job interview"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="clay-input w-full mt-1.5"
            />
          </label>
          {/* Stacked on lg where the rail is narrow: a date input needs about
              110px of content width or Chrome clips the value into invisibility. */}
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 lg:gap-4">
            <label className="block">
              <span className="text-xs font-medium text-navy/50">Date</span>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="clay-input w-full mt-1.5"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-navy/50">Dress code</span>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="clay-input w-full mt-1.5"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-navy/50">Notes (optional)</span>
            <input
              placeholder="Rooftop venue, might be windy"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="clay-input w-full mt-1.5"
            />
          </label>
          <ErrorNote message={error} />
          <button type="submit" className="clay-btn py-2.5 w-full">
            Add event
          </button>
        </form>

        {/* Main: the schedule */}
        <div className="lg:col-span-2 lg:order-1">
          {loading ? (
            <ListSkeleton count={3} />
          ) : events.length === 0 ? (
            <EmptyState
              Ill={CalendarIll}
              title="Nothing on the calendar"
              body="Add interviews, weddings or gym days and every outfit recommendation dresses you for the occasion."
            />
          ) : (
            <ul ref={listRef} className="space-y-3">
              {events.map((ev) => {
                const d = new Date(`${ev.date}T00:00:00`);
                return (
                  <li
                    key={ev.id}
                    className={`clay-card clay-card-hover px-5 py-4 flex items-center gap-4 ${
                      ev.date === today ? "ring-4 ring-blush/60" : ""
                    } ${ev.id < 0 ? "opacity-70" : ""}`}
                  >
                    {/* Date block */}
                    <div className="w-14 shrink-0 text-center">
                      <p className="font-brand text-2xl leading-none">{d.getDate()}</p>
                      <p className="text-[11px] uppercase tracking-wide text-navy/40 mt-0.5">
                        {d.toLocaleDateString(undefined, { month: "short" })}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium leading-snug">
                        {ev.title}
                        {ev.date === today && <span className="clay-chip ml-2">today</span>}
                      </p>
                      <p className="text-sm text-navy/50 mt-0.5 truncate">
                        {d.toLocaleDateString(undefined, { weekday: "long" })}
                        {ev.notes ? ` · ${ev.notes}` : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 text-xs font-medium px-3 py-1 rounded-full ${TYPE_TINT[ev.event_type] ?? "bg-cream-deep"}`}>
                      {ev.event_type}
                    </span>
                    <button
                      onClick={() => setConfirmId(ev.id)}
                      className="shrink-0 text-blush-deep text-xs font-medium hover:underline"
                    >
                      Delete
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmId !== null}
        title="Delete event?"
        message={
          pendingEvent
            ? `Delete "${pendingEvent.title}"? This can't be undone.`
            : ""
        }
        onConfirm={() => {
          if (confirmId !== null) remove(confirmId);
          setConfirmId(null);
        }}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}
