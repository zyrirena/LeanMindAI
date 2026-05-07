import { AuthForm } from "@/components/auth-form";
import { type Locale } from "@/i18n/messages";

export default async function SignUpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <AuthForm locale={locale as Locale} mode="signup" />;
}
