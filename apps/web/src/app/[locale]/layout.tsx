import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Navbar } from "@/components/navbar";
import { AuthProvider } from "@/lib/auth-context";
import { isLocale } from "@/i18n/messages";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <AuthProvider>
      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-5 sm:px-8">
        <Navbar locale={locale} />
        <main className="flex-1 pb-16">{children}</main>
        <footer className="border-t hairline py-6 text-xs text-slate">
          © {new Date().getFullYear()} LeanMind AI · Not medical advice.
        </footer>
      </div>
    </AuthProvider>
  );
}
