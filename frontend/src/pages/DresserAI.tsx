import { useEffect, useRef, useState } from "react";
import { api, ApiError, ChatMessage } from "../api";
import { useFadeRise, useStaggerReveal } from "../animations";

// Session-only chat: kept in memory so it survives tab switches, but is never
// persisted server-side and clears on a page refresh.
let cached: ChatMessage[] = [];

export default function DresserAI({ onQuotaBlocked }: { onQuotaBlocked: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>(cached);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageRef = useFadeRise<HTMLDivElement>();
  const listRef = useStaggerReveal<HTMLDivElement>(messages.length || null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    cached = next;
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const { reply } = await api.dresserAIChat(next);
      const withReply: ChatMessage[] = [...next, { role: "assistant", content: reply }];
      cached = withReply;
      setMessages(withReply);
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        onQuotaBlocked();
        setError(err.message);
      } else {
        setError((err as Error).message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={pageRef}>
      <h2 className="text-xl font-semibold mb-1">DresserAI</h2>
      <p className="text-sm text-navy/50 mb-4">
        Ask for styling advice. DresserAI knows your wardrobe, today's weather, and your
        calendar. Nothing here is saved once you leave.
      </p>

      <div className="clay-card p-5 mb-4 min-h-[16rem] max-h-[28rem] overflow-y-auto flex flex-col gap-3">
        {messages.length === 0 ? (
          <p className="text-navy/40 m-auto text-sm">
            Try: "What should I wear to a casual dinner tonight?"
          </p>
        ) : (
          <div ref={listRef} className="flex flex-col gap-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm ${
                  m.role === "user"
                    ? "self-end bg-blush text-navy shadow-clay-sm"
                    : "self-start bg-cream-deep/60 text-navy shadow-clay-sm"
                }`}
              >
                {m.content}
              </div>
            ))}
          </div>
        )}
        {busy && <p className="self-start text-xs text-navy/40 italic">DresserAI is thinking…</p>}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

      <form onSubmit={send} className="flex gap-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask DresserAI anything about your style…"
          className="flex-1 clay-input"
        />
        <button type="submit" disabled={busy || !input.trim()} className="clay-btn px-5 py-2 text-sm">
          Send
        </button>
      </form>
    </div>
  );
}
