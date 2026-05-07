"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { type Locale, t } from "@/i18n/messages";
import { useAuth } from "@/lib/auth-context";

export default function Dashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    void params.then((p) => setLocale(p.locale as Locale));
  }, [params]);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/${locale}/signin`);
    else if (!user.onboarded) router.replace(`/${locale}/onboarding`);
  }, [user, loading, router, locale]);

  if (loading || !user || !user.onboarded) return null;

  const greeting = user.email.split("@")[0];

  return (
    <div className="py-12 sm:py-16 rise">
      <p className="text-xs uppercase tracking-[0.2em] text-vitality-deep">
        {t(locale, "dash.welcome")}
      </p>
      <h1 className="h-display text-5xl mt-3">{greeting}</h1>

      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        <StatCard label={locale === "pl" ? "Cel" : "Goal"} value={t(locale, `onb.goal.${user.goal ?? "general"}`)} />
        <StatCard label={locale === "pl" ? "Język" : "Language"} value={user.locale.toUpperCase()} />
        <StatCard label={locale === "pl" ? "Jednostki" : "Units"} value={user.unit_system} />
      </div>

      <div className="mt-12 card p-7 sm:p-9">
        <h2 className="h-display text-2xl">{t(locale, "dash.nudge")}</h2>
        <Link href={`/${locale}/chat`} className="btn-vital mt-5">
          {t(locale, "dash.startchat")} <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate">{label}</div>
      <div className="mt-2 h-display text-2xl text-ink capitalize">{value}</div>
    </div>
  );
}
