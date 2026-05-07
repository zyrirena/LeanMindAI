import Link from "next/link";

import { type Locale, t } from "@/i18n/messages";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: l } = await params;
  const locale = l as Locale;

  return (
    <div className="pt-10 sm:pt-20">
      <section className="grid gap-12 sm:gap-16 lg:grid-cols-12">
        <div className="lg:col-span-7 rise" style={{ animationDelay: "60ms" }}>
          <p className="text-xs uppercase tracking-[0.2em] text-vitality-deep mb-6">
            {t(locale, "brand.tagline")}
          </p>
          <h1 className="h-display text-5xl sm:text-6xl lg:text-7xl text-ink">
            {t(locale, "landing.headline")}
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-soft leading-relaxed">
            {t(locale, "landing.sub")}
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link href={`/${locale}/signup`} className="btn-vital">
              {t(locale, "landing.cta")}
              <span aria-hidden>→</span>
            </Link>
            <Link href={`/${locale}/signin`} className="btn-ghost">
              {t(locale, "landing.cta.haveaccount")}
            </Link>
          </div>
        </div>

        <aside className="lg:col-span-5 rise" style={{ animationDelay: "180ms" }}>
          <SpecimenCard locale={locale} />
        </aside>
      </section>

      <div className="divider-rule my-20" />

      <section className="grid gap-8 sm:grid-cols-3">
        {(
          [
            { key: "cited" },
            { key: "private" },
            { key: "safe" },
          ] as const
        ).map((f, i) => (
          <article
            key={f.key}
            className="rise"
            style={{ animationDelay: `${300 + i * 90}ms` }}
          >
            <div className="text-vitality h-display text-4xl mb-3">
              0{i + 1}
            </div>
            <h3 className="h-display text-xl mb-2">
              {t(locale, `landing.feature.${f.key}.title`)}
            </h3>
            <p className="text-sm text-ink-soft leading-relaxed">
              {t(locale, `landing.feature.${f.key}.body`)}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}

function SpecimenCard({ locale }: { locale: Locale }) {
  // A typographic specimen card — gives the landing a real visual anchor
  // without resorting to a stock illustration.
  return (
    <div className="card p-7 sm:p-8 relative overflow-hidden">
      <div className="absolute -top-12 -right-12 h-44 w-44 rounded-full bg-vitality/10 blur-2xl" />
      <div className="text-[11px] uppercase tracking-[0.22em] text-slate">Coach Excerpt</div>
      <p className="mt-5 h-display text-2xl leading-snug text-ink">
        {locale === "pl"
          ? "Spójność powstaje z systemów, nie z motywacji. Zacznijmy od jednej kotwicy o stałej godzinie."
          : "Consistency comes from systems, not motivation. Let's anchor one habit to a fixed time."}
      </p>
      <div className="mt-6 flex items-center gap-3 text-xs text-slate">
        <span className="rounded border hairline px-2 py-0.5">CBT</span>
        <span className="rounded border hairline px-2 py-0.5">Atomic Habits</span>
        <span className="rounded border hairline px-2 py-0.5">SDT</span>
      </div>
      <div className="mt-7 border-t hairline pt-4 text-xs text-slate">
        {locale === "pl" ? "Cytuje:" : "Cites:"}{" "}
        <span className="text-ink-soft">Lally et al. (2010) · Eur. J. Soc. Psych.</span>
      </div>
    </div>
  );
}
