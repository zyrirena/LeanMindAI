"use client";

import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { type Locale, t } from "@/i18n/messages";
import { type Citation, streamChat } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type UiMessage = {
  id: string; // local or server id
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  safetyFlag?: string;
  pending?: boolean;
};

let nextLocalId = 0;
const localId = () => `local-${++nextLocalId}`;

export default function ChatPage({ params }: { params: Promise<{ locale: string }> }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("en");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void params.then((p) => setLocale(p.locale as Locale));
  }, [params]);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/${locale}/signin`);
    else if (!user.onboarded) router.replace(`/${locale}/onboarding`);
  }, [user, loading, router, locale]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Auto-grow textarea
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);
  useEffect(() => {
    resizeTextarea();
  }, [draft, resizeTextarea]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      setError(null);
      setBusy(true);
      setDraft("");

      const userMsg: UiMessage = {
        id: localId(),
        role: "user",
        content: trimmed,
      };
      const assistantMsg: UiMessage = {
        id: localId(),
        role: "assistant",
        content: "",
        pending: true,
      };
      setMessages((m) => [...m, userMsg, assistantMsg]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamChat(
          { session_id: sessionId, message: trimmed },
          {
            onSession: (id) => setSessionId(id),
            onCitations: (cites) =>
              setMessages((m) =>
                m.map((msg) =>
                  msg.id === assistantMsg.id ? { ...msg, citations: cites } : msg,
                ),
              ),
            onToken: (chunk) =>
              setMessages((m) =>
                m.map((msg) =>
                  msg.id === assistantMsg.id
                    ? { ...msg, content: msg.content + chunk }
                    : msg,
                ),
              ),
            onSafety: (category, message) =>
              setMessages((m) =>
                m.map((msg) =>
                  msg.id === assistantMsg.id
                    ? { ...msg, content: message, safetyFlag: category, pending: false }
                    : msg,
                ),
              ),
            onDone: () =>
              setMessages((m) =>
                m.map((msg) =>
                  msg.id === assistantMsg.id ? { ...msg, pending: false } : msg,
                ),
              ),
            onError: (detail) => {
              setError(detail);
              setMessages((m) => m.filter((msg) => msg.id !== assistantMsg.id));
            },
          },
          controller.signal,
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError(err instanceof Error ? err.message : t(locale, "chat.error"));
          setMessages((m) => m.filter((msg) => msg.id !== assistantMsg.id));
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, sessionId, locale],
  );

  // If user navigates to /chat?session=... we could load history; for the slice
  // we keep things simple and start fresh. Hook is left here for future extension.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void send(draft);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(draft);
    }
  };

  if (loading || !user || !user.onboarded) return null;

  const empty = messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col py-4 sm:py-6">
      <header className="mb-4 flex items-baseline justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-vitality-deep">
            {t(locale, "chat.title")}
          </p>
          <h1 className="h-display text-3xl mt-1">{t(locale, "nav.chat")}</h1>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-thin pr-1"
      >
        {empty ? (
          <EmptyState locale={locale} onPick={(s) => void send(s)} />
        ) : (
          <ul className="space-y-6 pb-6">
            {messages.map((m) => (
              <MessageBubble key={m.id} m={m} locale={locale} />
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-2 text-sm text-alert">
          {error}
        </p>
      )}

      <form
        onSubmit={onSubmit}
        className="flex items-end gap-3 border-t hairline pt-4"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t(locale, "chat.placeholder")}
          className="field resize-none min-h-[44px] max-h-[200px]"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="btn-primary self-stretch disabled:opacity-40"
        >
          {t(locale, "chat.send")}
        </button>
      </form>
    </div>
  );
}

function EmptyState({
  locale,
  onPick,
}: {
  locale: Locale;
  onPick: (suggestion: string) => void;
}) {
  const suggestions = [
    t(locale, "chat.empty.suggestion1"),
    t(locale, "chat.empty.suggestion2"),
    t(locale, "chat.empty.suggestion3"),
  ];
  return (
    <div className="rise pt-12 sm:pt-20">
      <h2 className="h-display text-3xl sm:text-4xl text-ink max-w-xl">
        {t(locale, "chat.empty.title")}
      </h2>
      <ul className="mt-8 grid gap-3 sm:grid-cols-3 max-w-3xl">
        {suggestions.map((s) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className="card w-full p-4 text-left text-sm text-ink-soft hover:text-ink hover:border-ink-soft transition leading-relaxed"
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MessageBubble({ m, locale }: { m: UiMessage; locale: Locale }) {
  if (m.role === "user") {
    return (
      <li className="flex justify-end">
        <div className="max-w-[80%] rounded-md bg-ink text-bone px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
          {m.content}
        </div>
      </li>
    );
  }

  const isSafety = !!m.safetyFlag;

  return (
    <li>
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate mb-2">
        {isSafety ? t(locale, "chat.safety.title") : t(locale, "chat.title")}
      </div>
      <div
        className={
          isSafety
            ? "rounded-md border-l-2 border-alert bg-white/70 p-4 text-sm leading-relaxed text-ink whitespace-pre-wrap"
            : "text-base leading-relaxed text-ink whitespace-pre-wrap"
        }
      >
        {m.content || (m.pending && !m.content ? t(locale, "chat.thinking") : "")}
        {m.pending && m.content ? <span className="caret" /> : null}
      </div>

      {m.citations && m.citations.length > 0 && (
        <Citations cites={m.citations} locale={locale} />
      )}
    </li>
  );
}

function Citations({ cites, locale }: { cites: Citation[]; locale: Locale }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-[11px] uppercase tracking-[0.18em] text-vitality-deep hover:text-vitality transition"
      >
        {t(locale, "chat.citations")} · {cites.length} {open ? "▾" : "▸"}
      </button>
      {open && (
        <ol className="mt-3 space-y-2.5">
          {cites.map((c, i) => (
            <li key={i} className="border-l-2 border-line pl-3 text-xs text-ink-soft">
              <div className="font-medium text-ink">
                [{i + 1}] {c.source}
              </div>
              <div className="text-slate mt-1 leading-relaxed line-clamp-3">{c.snippet}</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
