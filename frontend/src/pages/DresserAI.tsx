import { useEffect, useRef, useState } from "react";
import { api, ApiError, ChatMessage } from "../api";
import { useFadeRise, useStaggerReveal } from "../animations";
import ErrorNote from "../components/ErrorNote";
import PageHeader from "../components/PageHeader";
import { Chat as ChatIll } from "../components/illustrations";

// Session-only chat: kept in memory so it survives tab switches, but is never
// persisted server-side and clears on a page refresh.
let cached: ChatMessage[] = [];

// Starter prompts double as an empty state and an onboarding nudge.
const STARTERS = [
  "What should I wear to a casual dinner tonight?",
  "Build me an interview outfit from my closet",
  "What goes with my white sneakers?",
];

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

  const sendText = async (text: string) => {
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

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    sendText(input.trim());
  };

  return (
    <div ref={pageRef}>
      <PageHeader
        title="DresserAI"
        context="Knows your wardrobe, today's weather and your calendar. Conversations aren't saved."
      />

      {/* Chat surface: scrollable transcript with a sticky composer beneath. */}
      <div className="clay-card blob-card-c overflow-hidden flex flex-col" style={{ minHeight: "24rem" }}>
        <div className="flex-1 p-5 sm:p-6 max-h-[30rem] overflow-y-auto flex flex-col gap-3">
          {messages.length === 0 ? (
            <div className="m-auto text-center py-6">
              <div className="w-20 h-20 mx-auto blob-c bg-cream grid place-items-center p-3.5 shadow-clay-sm">
                <ChatIll className="w-full h-full" />
              </div>
              <p className="text-sm text-navy/50 mt-4 max-w-xs mx-auto">
                Ask anything about your style. A few places to start:
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendText(s)}
                    disabled={busy}
                    className="clay-chip hover:shadow-clay transition-shadow text-left"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div ref={listRef} className="flex flex-col gap-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    m.role === "user"
                      ? "self-end bg-blush text-navy shadow-clay-sm rounded-br-md"
                      : "self-start bg-cream-deep/60 text-navy shadow-clay-sm rounded-bl-md"
                  }`}
                >
                  {m.content}
                </div>
              ))}
            </div>
          )}
          {busy && (
            <p className="self-start text-xs text-navy/40 italic animate-pulse">DresserAI is thinking…</p>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Composer, visually part of the chat card */}
        <form onSubmit={send} className="flex gap-3 p-4 border-t border-cream-deep bg-cream-soft">
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

      <ErrorNote message={error} className="mt-4" />
    </div>
  );
}
