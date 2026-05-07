export const LOCALES = ["en", "pl"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

type Dict = Record<string, string>;

const en: Dict = {
  // brand
  "brand.name": "LeanMind AI",
  "brand.tagline": "Trust. Precision. Wellness, evidenced.",

  // nav
  "nav.dashboard": "Dashboard",
  "nav.chat": "Coach",
  "nav.admin": "Admin",
  "nav.signout": "Sign out",
  "nav.signin": "Sign in",
  "nav.signup": "Create account",

  // landing
  "landing.headline": "Wellness coaching, grounded in evidence.",
  "landing.sub":
    "A behavioral coach that cites peer-reviewed sources, respects your privacy, and stops when something is medical.",
  "landing.cta": "Begin",
  "landing.cta.haveaccount": "I already have an account",
  "landing.feature.cited.title": "Cited",
  "landing.feature.cited.body":
    "Every recommendation grounds itself in published evidence. No more vibes-based wellness.",
  "landing.feature.private.title": "Private",
  "landing.feature.private.body":
    "Your data is yours. Encrypted, deletable, never sold. Designed under GDPR principles.",
  "landing.feature.safe.title": "Safe",
  "landing.feature.safe.body":
    "A safety classifier halts coaching for medical or mental-health crises and routes you to qualified care.",

  // auth
  "auth.signup.title": "Create your account",
  "auth.signin.title": "Welcome back",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.submit.signup": "Create account",
  "auth.submit.signin": "Sign in",
  "auth.switch.tosignin": "Already have an account? Sign in",
  "auth.switch.tosignup": "New here? Create an account",
  "auth.error.generic": "Something went wrong. Please try again.",

  // onboarding
  "onb.title": "Three quick questions",
  "onb.sub": "We use these to tailor your coach. You can change them later.",
  "onb.goal.label": "What matters most to you right now?",
  "onb.goal.energy": "Daily energy",
  "onb.goal.weight_loss": "Weight management",
  "onb.goal.strength": "Strength & fitness",
  "onb.goal.sleep": "Sleep quality",
  "onb.goal.stress": "Stress & focus",
  "onb.goal.general": "General wellbeing",
  "onb.locale.label": "Language",
  "onb.units.label": "Units",
  "onb.units.metric": "Metric (kg, cm)",
  "onb.units.imperial": "Imperial (lb, in)",
  "onb.submit": "Continue",

  // dashboard
  "dash.welcome": "Welcome back",
  "dash.nudge": "Open a conversation with your coach to begin today.",
  "dash.startchat": "Open the coach",

  // chat
  "chat.title": "Behavioral Lead",
  "chat.placeholder": "Ask anything about habits, motivation, or consistency.",
  "chat.send": "Send",
  "chat.empty.title": "What would you like to work on?",
  "chat.empty.suggestion1": "I keep skipping workouts after Wednesday — why?",
  "chat.empty.suggestion2": "Help me build a morning routine I'll actually keep.",
  "chat.empty.suggestion3": "I'm motivated for two weeks then I quit. What's the pattern?",
  "chat.citations": "Sources",
  "chat.thinking": "Thinking…",
  "chat.error": "Something went wrong. Please try again.",
  "chat.safety.title": "I need to pause here",

  // admin
  "admin.title": "Evidence library",
  "admin.sub": "Upload PDFs to make them retrievable by the coach.",
  "admin.form.title": "Title",
  "admin.form.source": "Source (URL or citation)",
  "admin.form.category": "Category (optional)",
  "admin.form.file": "PDF file",
  "admin.form.submit": "Ingest",
  "admin.docs.title": "Ingested documents",
  "admin.docs.empty": "No documents yet.",
  "admin.docs.chunks": "chunks",
};

const pl: Dict = {
  // brand
  "brand.name": "LeanMind AI",
  "brand.tagline": "Zaufanie. Precyzja. Wellness oparty na dowodach.",

  // nav
  "nav.dashboard": "Panel",
  "nav.chat": "Coach",
  "nav.admin": "Administracja",
  "nav.signout": "Wyloguj",
  "nav.signin": "Zaloguj się",
  "nav.signup": "Załóż konto",

  // landing
  "landing.headline": "Coaching wellness oparty na dowodach.",
  "landing.sub":
    "Coach behawioralny, który cytuje recenzowane źródła, szanuje Twoją prywatność i zatrzymuje się, gdy sprawa jest medyczna.",
  "landing.cta": "Rozpocznij",
  "landing.cta.haveaccount": "Mam już konto",
  "landing.feature.cited.title": "Cytowany",
  "landing.feature.cited.body":
    "Każda rekomendacja oparta jest na opublikowanych dowodach. Koniec z wellness na wyczucie.",
  "landing.feature.private.title": "Prywatny",
  "landing.feature.private.body":
    "Twoje dane są Twoje. Szyfrowane, możliwe do usunięcia, nigdy nie sprzedawane. Zaprojektowane zgodnie z RODO.",
  "landing.feature.safe.title": "Bezpieczny",
  "landing.feature.safe.body":
    "Klasyfikator bezpieczeństwa wstrzymuje coaching w sytuacjach kryzysu medycznego lub psychicznego i kieruje do wykwalifikowanej pomocy.",

  // auth
  "auth.signup.title": "Załóż konto",
  "auth.signin.title": "Witaj ponownie",
  "auth.email": "Email",
  "auth.password": "Hasło",
  "auth.submit.signup": "Załóż konto",
  "auth.submit.signin": "Zaloguj się",
  "auth.switch.tosignin": "Masz już konto? Zaloguj się",
  "auth.switch.tosignup": "Nowy użytkownik? Załóż konto",
  "auth.error.generic": "Coś poszło nie tak. Spróbuj ponownie.",

  // onboarding
  "onb.title": "Trzy krótkie pytania",
  "onb.sub": "Pomogą nam dostosować coacha. Możesz je później zmienić.",
  "onb.goal.label": "Co jest dla Ciebie teraz najważniejsze?",
  "onb.goal.energy": "Codzienna energia",
  "onb.goal.weight_loss": "Kontrola wagi",
  "onb.goal.strength": "Siła i kondycja",
  "onb.goal.sleep": "Jakość snu",
  "onb.goal.stress": "Stres i koncentracja",
  "onb.goal.general": "Ogólne samopoczucie",
  "onb.locale.label": "Język",
  "onb.units.label": "Jednostki",
  "onb.units.metric": "Metryczne (kg, cm)",
  "onb.units.imperial": "Imperialne (lb, in)",
  "onb.submit": "Dalej",

  // dashboard
  "dash.welcome": "Witaj ponownie",
  "dash.nudge": "Rozpocznij rozmowę z coachem, aby zacząć dzień.",
  "dash.startchat": "Otwórz coacha",

  // chat
  "chat.title": "Behavioral Lead",
  "chat.placeholder": "Zapytaj o nawyki, motywację lub konsekwencję.",
  "chat.send": "Wyślij",
  "chat.empty.title": "Nad czym chcesz dziś popracować?",
  "chat.empty.suggestion1": "Po środzie zawsze opuszczam treningi — dlaczego?",
  "chat.empty.suggestion2": "Pomóż mi zbudować poranną rutynę, której się trzymam.",
  "chat.empty.suggestion3": "Mam zapał przez dwa tygodnie, potem rzucam. Jaki to wzorzec?",
  "chat.citations": "Źródła",
  "chat.thinking": "Myślę…",
  "chat.error": "Coś poszło nie tak. Spróbuj ponownie.",
  "chat.safety.title": "Muszę tu zrobić pauzę",

  // admin
  "admin.title": "Biblioteka dowodów",
  "admin.sub": "Wgraj pliki PDF, aby były dostępne dla coacha.",
  "admin.form.title": "Tytuł",
  "admin.form.source": "Źródło (URL lub cytowanie)",
  "admin.form.category": "Kategoria (opcjonalnie)",
  "admin.form.file": "Plik PDF",
  "admin.form.submit": "Wgraj",
  "admin.docs.title": "Wgrane dokumenty",
  "admin.docs.empty": "Brak dokumentów.",
  "admin.docs.chunks": "fragmentów",
};

const dictionaries: Record<Locale, Dict> = { en, pl };

export function t(locale: Locale, key: string): string {
  return dictionaries[locale][key] ?? dictionaries.en[key] ?? key;
}
