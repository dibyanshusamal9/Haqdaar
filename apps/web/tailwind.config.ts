import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

// Haqdaar.ai palette: ink on paper with a saffron accent, matching the citizen site.
// The accent scale is still called `violet` so every existing class picks it up.
const saffron = {
  50: "#FDF4E8",
  100: "#FBE6CC",
  200: "#F6CD9A",
  300: "#F0B066",
  400: "#EB963A",
  500: "#E8801F",
  600: "#C4650C",
  700: "#9F510A",
  800: "#7A3E09",
  900: "#5A2E08",
};

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1C1710",
        "ink-soft": "#5B5141",
        "ink-faint": "#7A6E5A",   // ≥4.5:1 on white
        line: "#EDE4D3",
        canvas: "#FBF6EC",
        sand: "#FDF4E8",
        ember: "#B45309",
        moss: "#C4650C",
        violet: saffron,
      },
      fontFamily: {
        sans: ["var(--font-sans)", "var(--font-brand)", ...defaultTheme.fontFamily.sans],
        brand: ["var(--font-brand)", "sans-serif"],
        logo: ["var(--font-logo)", "var(--font-brand)", "serif"],   // the हक़दार wordmark
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(28,23,16,.04), 0 8px 24px rgba(196,101,12,.06)",
        lift: "0 2px 4px rgba(28,23,16,.05), 0 18px 40px -8px rgba(196,101,12,.18)",
        glow: "0 8px 20px -8px rgba(196,101,12,.7)",
      },
    },
  },
  plugins: [],
};
export default config;
