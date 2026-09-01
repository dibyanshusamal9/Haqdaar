import type { Config } from "tailwindcss";
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        sand: "#f7f3ec",
        ember: "#b45309",
        moss: "#2f6f4e",
      },
      fontFamily: { mono: ["ui-monospace","SFMono-Regular","monospace"] },
    },
  },
  plugins: [],
};
export default config;
