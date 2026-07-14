import { useEffect, useState } from "react";
import { api, CalendarEvent } from "../api";
import { useFadeRise, useStaggerReveal } from "../animations";
import { ListSkeleton } from "../components/Skeleton";
import { localISODate } from "../date";
import { eventsCache } from "../store";

const EVENT_TYPES = ["athletic", "casual", "smart-casual", "business", "formal"];

export default function Calendar() {
  const pageRef = useFadeRise<HTMLDivElement>();
  const [events, setEvents] = useState<CalendarEvent[]>(eventsCache.peek() ?? []);
  const [loading, setLoading] = useState(eventsCache.peek() === null);
  const [error, setError] = useState<string | null>(null);

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
      <h2 className="text-xl font-semibold mb-4">Your calendar</h2>
      <p className="text-sm text-navy/50 mb-4">
        Add the events you're attending — outfit suggestions for that day will match the dress code.
      </p>

      <form onSubmit={submit} className="clay-card p-6 mb-6 grid gap-4 sm:grid-cols-2">
        <input
          required
          placeholder="Event title (e.g. Job interview)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="clay-input sm:col-span-2"
        />
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="clay-input"
        />
        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className="clay-input"
        >
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="clay-input sm:col-span-2"
        />
        {error && <p className="text-sm text-red-500 sm:col-span-2">{error}</p>}
        <button type="submit" className="clay-btn py-2.5 sm:col-span-2">
          Add event
        </button>
      </form>

      {loading ? (
        <ListSkeleton count={3} />
      ) : events.length === 0 ? (
        <p className="text-navy/50">No events yet.</p>
      ) : (
        <ul ref={listRef} className="space-y-3">
          {events.map((ev) => (
            <li
              key={ev.id}
              className={`clay-card clay-card-hover px-5 py-4 flex items-center justify-between ${
                ev.date === today ? "ring-4 ring-blush/60" : ""
              } ${ev.id < 0 ? "opacity-70" : ""}`}
            >
              <div>
                <p className="font-medium">
                  {ev.title}
                  {ev.date === today && <span className="clay-chip ml-2">today</span>}
                </p>
                <p className="text-sm text-navy/50">
                  {ev.date} · {ev.event_type}
                  {ev.notes ? ` · ${ev.notes}` : ""}
                </p>
              </div>
              <button
                onClick={() => remove(ev.id)}
                className="text-blush-deep text-xs font-medium hover:underline"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
