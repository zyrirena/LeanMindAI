"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";

import { type Locale, t } from "@/i18n/messages";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/cn";

export function Navbar({ locale }: { locale: Locale }) {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const otherLocale: Locale = locale === "en" ? "pl" : "en";

  const switchLocaleHref = useMemo(() => {
    if (!pathname) return `/${otherLocale}`;
    const parts = pathname.split("/");
    parts[1] = otherLocale;
    return parts.join("/") || `/${otherLocale}`;
  }, [pathname, otherLocale]);

  const isOn = (href: string) => pathname?.startsWith(`/${locale}${href}`);

  return (
    <header className="flex items-center justify-between py-6">
      <Link href={`/${locale}`} className="flex items-center gap-2.5 group">
        <BrandMark />
        <span className="h-display text-xl">LeanMind</span>
        <span className="h-display text-xl text-vitality">AI</span>
      </Link>

      <nav className="flex items-center gap-1.5 sm:gap-3">
        {user && (
          <>
            <Link
              href={`/${locale}/dashboard`}
              className={cn(
                "px-3 py-1.5 text-sm rounded transition",
                isOn("/dashboard") ? "text-ink" : "text-slate hover:text-ink",
              )}
            >
              {t(locale, "nav.dashboard")}
            </Link>
            <Link
              href={`/${locale}/chat`}
              className={cn(
                "px-3 py-1.5 text-sm rounded transition",
                isOn("/chat") ? "text-ink" : "text-slate hover:text-ink",
              )}
            >
              {t(locale, "nav.chat")}
            </Link>
            {user.is_admin && (
              <Link
                href={`/${locale}/admin/ingest`}
                className={cn(
                  "px-3 py-1.5 text-sm rounded transition",
                  isOn("/admin") ? "text-ink" : "text-slate hover:text-ink",
                )}
              >
                {t(locale, "nav.admin")}
              </Link>
            )}
          </>
        )}

        <Link
          href={switchLocaleHref}
          className="ml-1 rounded border hairline px-2 py-1 text-[11px] uppercase tracking-wider text-slate hover:text-ink hover:border-ink-soft transition"
        >
          {locale === "en" ? "PL" : "EN"}
        </Link>

        {user ? (
          <button
            type="button"
            className="ml-1 text-sm text-slate hover:text-ink transition"
            onClick={() => {
              signOut();
              router.push(`/${locale}`);
            }}
          >
            {t(locale, "nav.signout")}
          </button>
        ) : (
          <>
            <Link href={`/${locale}/signin`} className="text-sm text-slate hover:text-ink transition">
              {t(locale, "nav.signin")}
            </Link>
            <Link href={`/${locale}/signup`} className="btn-primary text-sm">
              {t(locale, "nav.signup")}
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}

function BrandMark() {
  // A small geometric shield — connected node motif.
  return (
    <svg width="22" height="26" viewBox="0 0 22 26" fill="none" aria-hidden>
      <path
        d="M11 1 L21 5 V13 C21 19 16 23 11 25 C6 23 1 19 1 13 V5 Z"
        stroke="currentColor"
        strokeWidth="1.25"
        fill="none"
      />
      <circle cx="11" cy="11" r="1.6" fill="#2F8F6F" />
      <circle cx="6.5" cy="14.5" r="1.2" fill="currentColor" />
      <circle cx="15.5" cy="14.5" r="1.2" fill="currentColor" />
      <path
        d="M11 11 L6.5 14.5 M11 11 L15.5 14.5"
        stroke="currentColor"
        strokeWidth="0.9"
        opacity="0.6"
      />
    </svg>
  );
}
