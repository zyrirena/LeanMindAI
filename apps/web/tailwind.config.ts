import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bone: "#F6F3EC",
        ivory: "#FBF9F4",
        ink: "#0E1B2C",
        "ink-soft": "#28384C",
        slate: "#5C6A7E",
        line: "#E5E0D5",
        vitality: "#2F8F6F",
        "vitality-deep": "#1F6651",
        alert: "#B23A48",
      },
      fontFamily: {
        display: ['"Fraunces"', "ui-serif", "Georgia", "serif"],
        sans: ['"Inter Tight"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        "tighter-display": "-0.025em",
      },
      borderRadius: {
        DEFAULT: "0.375rem",
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(14,27,44,0.04), 0 8px 24px -12px rgba(14,27,44,0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
