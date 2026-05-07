"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { type Locale, t } from "@/i18n/messages";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const GOALS = ["energy", "weight_loss", "strength", "sleep", "stress", "general"] as const;

export default function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter();
  const { user, loading, refresh } = useAuth();
  const [locale, setLocale] = useState<Locale>("en");
  const [pageLocale, setPageLocale] = useState<Locale>("en");

  useEffect(() => {
    void params.then((p) => {
      setPageLocale(p.locale as Locale);
      setLocale(p.locale as Locale);
    });
  }, [params]);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/${pageLocale}/signin`);
    else if (user.onboarded) router.replace(`/${pageLocale}/dashboard`);
  }, [user, loading, router, pageLocale]);

  const [goal, setGoal] = useState<(typeof GOALS)[number]>("energy");
  const [units, setUnits] = useState<"metric" | "imperial">("metric");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/users/onboarding", {
        method: "POST",
        body: JSON.stringify({ goal, locale, unit_system: units }),
      });
      await refresh();
      router.push(`/${locale}/dashboard`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return null;

  return (
    <div className="mx-auto max-w-2xl py-16 rise">
      <h1 className="h-display text-4xl">{t(pageLocale, "onb.title")}</h1>
      <p className="text-slate mt-2">{t(pageLocale, "onb.sub")}</p>

      <form onSubmit={submit} className="mt-10 space-y-10">
        <fieldset>
          <legend className="text-xs uppercase tracking-wider text-slate mb-3">
            {t(pageLocale, "onb.goal.label")}
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {GOALS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGoal(g)}
                className={`rounded border px-3 py-3 text-sm transition text-left ${
                  goal === g
                    ? "border-ink bg-white text-ink shadow-card"
                    : "border-line bg-transparent text-slate hover:text-ink hover:border-ink-soft"
                }`}
              >
                {t(pageLocale, `onb.goal.${g}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs uppercase tracking-wider text-slate mb-3">
            {t(pageLocale, "onb.locale.label")}
          </legend>
          <div className="flex gap-2">
            {(["en", "pl"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLocale(l)}
                className={`rounded border px-4 py-2 text-sm uppercase tracking-wider transition ${
                  locale === l
                    ? "border-ink bg-white text-ink"
                    : "border-line text-slate hover:text-ink"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs uppercase tracking-wider text-slate mb-3">
            {t(pageLocale, "onb.units.label")}
          </legend>
          <div className="grid grid-cols-2 gap-2 max-w-md">
            {(["metric", "imperial"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnits(u)}
                className={`rounded border px-3 py-3 text-sm transition ${
                  units === u
                    ? "border-ink bg-white text-ink"
                    : "border-line text-slate hover:text-ink"
                }`}
              >
                {t(pageLocale, `onb.units.${u}`)}
              </button>
            ))}
          </div>
        </fieldset>

        {error && <p className="text-sm text-alert">{error}</p>}

        <button type="submit" disabled={busy} className="btn-vital">
          {busy ? "…" : t(pageLocale, "onb.submit")} <span aria-hidden>→</span>
        </button>
      </form>
    </div>
  );
}
