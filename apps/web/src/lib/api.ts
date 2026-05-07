"use client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TOKEN_KEY = "leanmind_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}

type FetchOpts = RequestInit & { auth?: boolean };

export async function api<T = unknown>(path: string, opts: FetchOpts = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  if (!headers.has("Content-Type") && !(opts.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (opts.auth !== false) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const detail =
      (data && typeof data === "object" && "detail" in data && (data as { detail: unknown }).detail) ||
      `Request failed (${res.status})`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data as T;
}

// ---- Types ----

export type UserPublic = {
  id: string;
  email: string;
  onboarded: boolean;
  goal: string | null;
  locale: "en" | "pl";
  unit_system: "metric" | "imperial";
  is_admin: boolean;
  created_at: string;
};

export type Citation = { source: string; snippet: string; score: number };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: Citation[] | null;
  safety_flag: string | null;
  created_at: string;
};

// ---- SSE chat streaming ----

export type SseHandlers = {
  onSession?: (id: string) => void;
  onCitations?: (cites: Citation[]) => void;
  onToken?: (text: string) => void;
  onSafety?: (category: string, message: string) => void;
  onDone?: (messageId: string) => void;
  onError?: (detail: string) => void;
};

export async function streamChat(
  body: { session_id: string | null; message: string },
  handlers: SseHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    handlers.onError?.(`Request failed (${res.status})`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // SSE frame: lines until a blank line; collect "event:" and "data:" lines per frame.
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIdx;
    while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sepIdx);
      buffer = buffer.slice(sepIdx + 2);
      let event = "message";
      const dataLines: string[] = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      const dataStr = dataLines.join("\n");
      let data: unknown = dataStr;
      try {
        data = JSON.parse(dataStr);
      } catch {
        /* keep as string */
      }
      dispatch(event, data, handlers);
    }
  }
}

function dispatch(event: string, data: unknown, h: SseHandlers): void {
  switch (event) {
    case "session":
      if (data && typeof data === "object" && "id" in data)
        h.onSession?.(String((data as { id: unknown }).id));
      break;
    case "citations":
      if (Array.isArray(data)) h.onCitations?.(data as Citation[]);
      break;
    case "token":
      if (data && typeof data === "object" && "text" in data)
        h.onToken?.(String((data as { text: unknown }).text));
      break;
    case "safety":
      if (data && typeof data === "object")
        h.onSafety?.(
          String((data as { category?: unknown }).category ?? "unknown"),
          String((data as { message?: unknown }).message ?? ""),
        );
      break;
    case "done":
      if (data && typeof data === "object" && "message_id" in data)
        h.onDone?.(String((data as { message_id: unknown }).message_id));
      break;
    case "error":
      if (data && typeof data === "object" && "detail" in data)
        h.onError?.(String((data as { detail: unknown }).detail));
      break;
  }
}
