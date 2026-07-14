import { useEffect, useState } from "react";
import { api, CalendarEvent } from "../api";
import { useFadeRise, useStaggerReveal } from "../animations";

const EVENT_TYPES = ["athletic", "casual", "smart-casual", "business", "formal"];

export default function Calendar() {
  const pageRef = useFadeRise<HTMLDivElement>();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [eventType, setEventType] = useState("casual");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setEvents(await api.listEvents());
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createEvent({ title, date, event_type: eventType, notes: notes || undefined });
      setTitle("");
      setNotes("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    await api.deleteEvent(id);
    setEvents((prev) => prev.filter((ev) => ev.id !== id));
  };

  const today = new Date().toISOString().slice(0, 10);
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
        <button type="submit" disabled={busy} className="clay-btn py-2.5 sm:col-span-2">
          {busy ? "Adding…" : "Add event"}
        </button>
      </form>

      {loading ? (
        <p className="text-navy/50">Loading events…</p>
      ) : events.length === 0 ? (
        <p className="text-navy/50">No events yet.</p>
      ) : (
        <ul ref={listRef} className="space-y-3">
          {events.map((ev) => (
            <li
              key={ev.id}
              className={`clay-card clay-card-hover px-5 py-4 flex items-center justify-between ${
                ev.date === today ? "ring-4 ring-blush/60" : ""
              }`}
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
