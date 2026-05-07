"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { type FormEvent, useState } from "react";

import { type Locale, t } from "@/i18n/messages";
import { useAuth } from "@/lib/auth-context";

export function AuthForm({
  locale,
  mode,
}: {
  locale: Locale;
  mode: "signin" | "signup";
}) {
  const { signIn, signUp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") await signUp(email, password);
      else await signIn(email, password);
      router.push(`/${locale}/dashboard`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t(locale, "auth.error.generic"));
    } finally {
      setBusy(false);
    }
  }

  const title = t(locale, mode === "signup" ? "auth.signup.title" : "auth.signin.title");
  const submitLabel = t(locale, mode === "signup" ? "auth.submit.signup" : "auth.submit.signin");
  const switchLabel = t(locale, mode === "signup" ? "auth.switch.tosignin" : "auth.switch.tosignup");
  const switchHref = `/${locale}/${mode === "signup" ? "signin" : "signup"}`;

  return (
    <div className="mx-auto max-w-md py-16 sm:py-24 rise">
      <h1 className="h-display text-4xl mb-2">{title}</h1>
      <p className="text-sm text-slate mb-8">{t(locale, "brand.tagline")}</p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="text-xs uppercase tracking-wider text-slate">
            {t(locale, "auth.email")}
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            className="field mt-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-slate">
            {t(locale, "auth.password")}
          </label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className="field mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-50">
          {busy ? "…" : submitLabel}
        </button>
      </form>

      <p className="mt-6 text-sm text-center text-slate">
        <Link href={switchHref} className="hover:text-ink underline-offset-2 hover:underline">
          {switchLabel}
        </Link>
      </p>
    </div>
  );
}
