import { useEffect, useState } from "react";
import { api, CalendarEvent } from "../api";

const EVENT_TYPES = ["athletic", "casual", "smart-casual", "business", "formal"];

export default function Calendar() {
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

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Your calendar</h2>
      <p className="text-sm text-neutral-500 mb-4">
        Add the events you're attending — outfit suggestions for that day will match the dress code.
      </p>

      <form onSubmit={submit} className="bg-white rounded-xl shadow-sm p-5 mb-6 grid gap-3 sm:grid-cols-2">
        <input
          required
          placeholder="Event title (e.g. Job interview)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 sm:col-span-2"
        />
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2"
        />
        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2"
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
          className="rounded-lg border border-neutral-300 px-3 py-2 sm:col-span-2"
        />
        {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-neutral-900 text-white py-2 font-medium disabled:opacity-50 sm:col-span-2"
        >
          {busy ? "Adding…" : "Add event"}
        </button>
      </form>

      {loading ? (
        <p className="text-neutral-500">Loading events…</p>
      ) : events.length === 0 ? (
        <p className="text-neutral-500">No events yet.</p>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => (
            <li
              key={ev.id}
              className={`bg-white rounded-lg shadow-sm px-4 py-3 flex items-center justify-between ${
                ev.date === today ? "ring-2 ring-neutral-900" : ""
              }`}
            >
              <div>
                <p className="font-medium">
                  {ev.title}
                  {ev.date === today && (
                    <span className="ml-2 text-xs bg-neutral-900 text-white rounded px-1.5 py-0.5">today</span>
                  )}
                </p>
                <p className="text-sm text-neutral-500">
                  {ev.date} · {ev.event_type}
                  {ev.notes ? ` · ${ev.notes}` : ""}
                </p>
              </div>
              <button onClick={() => remove(ev.id)} className="text-red-600 text-xs">
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
