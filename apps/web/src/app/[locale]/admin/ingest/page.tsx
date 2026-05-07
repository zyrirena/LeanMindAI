"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { type Locale, t } from "@/i18n/messages";
import { api, getToken } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type IngestedDoc = {
  id: string;
  title: string;
  source: string;
  category: string | null;
  chunk_count: number;
  created_at: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function AdminIngest({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    void params.then((p) => setLocale(p.locale as Locale));
  }, [params]);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/${locale}/signin`);
    else if (!user.is_admin) router.replace(`/${locale}/dashboard`);
  }, [user, loading, router, locale]);

  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [category, setCategory] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [docs, setDocs] = useState<IngestedDoc[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await api<IngestedDoc[]>("/admin/documents");
      setDocs(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    }
  }, []);

  useEffect(() => {
    if (user?.is_admin) void refresh();
  }, [user, refresh]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    setSuccess(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", title);
    fd.append("source", source);
    if (category) fd.append("category", category);

    const token = getToken();
    try {
      const res = await fetch(`${API_BASE}/admin/ingest`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;
      if (!res.ok) {
        throw new Error(data?.detail ?? `Upload failed (${res.status})`);
      }
      setSuccess(`✓ ${data.title} — ${data.chunks} chunks`);
      setTitle("");
      setSource("");
      setCategory("");
      setFile(null);
      const fileInput = document.getElementById("ingest-file") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user || !user.is_admin) return null;

  return (
    <div className="py-12 max-w-4xl">
      <h1 className="h-display text-4xl">{t(locale, "admin.title")}</h1>
      <p className="text-slate mt-2">{t(locale, "admin.sub")}</p>

      <form onSubmit={onSubmit} className="mt-10 card p-6 sm:p-8 space-y-5">
        <div>
          <label className="text-xs uppercase tracking-wider text-slate">
            {t(locale, "admin.form.title")}
          </label>
          <input
            type="text"
            required
            className="field mt-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-slate">
            {t(locale, "admin.form.source")}
          </label>
          <input
            type="text"
            required
            className="field mt-1"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="https://… or Author et al. (2020)"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-slate">
            {t(locale, "admin.form.category")}
          </label>
          <input
            type="text"
            className="field mt-1"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="sleep · nutrition · habits …"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-slate">
            {t(locale, "admin.form.file")}
          </label>
          <input
            id="ingest-file"
            type="file"
            accept="application/pdf"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm file:mr-4 file:rounded file:border file:border-line file:bg-white file:px-4 file:py-2 file:text-sm file:text-ink hover:file:border-ink-soft"
          />
        </div>

        {error && <p className="text-sm text-alert">{error}</p>}
        {success && <p className="text-sm text-vitality-deep">{success}</p>}

        <button type="submit" disabled={busy || !file} className="btn-vital disabled:opacity-50">
          {busy ? "…" : t(locale, "admin.form.submit")}
        </button>
      </form>

      <section className="mt-12">
        <h2 className="h-display text-2xl mb-4">{t(locale, "admin.docs.title")}</h2>
        {docs.length === 0 ? (
          <p className="text-sm text-slate">{t(locale, "admin.docs.empty")}</p>
        ) : (
          <ul className="divide-y divide-line border hairline rounded bg-white/60">
            {docs.map((d) => (
              <li key={d.id} className="px-4 py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm text-ink truncate">{d.title}</div>
                  <div className="text-xs text-slate truncate mt-0.5">{d.source}</div>
                  {d.category && (
                    <span className="inline-block mt-1.5 text-[10px] uppercase tracking-wider text-vitality-deep border border-vitality/30 rounded px-1.5 py-0.5">
                      {d.category}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate whitespace-nowrap pt-0.5">
                  {d.chunk_count} {t(locale, "admin.docs.chunks")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
