import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: {
          DEFAULT: "var(--surface)",
          muted: "var(--surface-muted)",
        },
        lime: {
          500: "var(--lime-500)",
          400: "var(--lime-400)",
          100: "var(--lime-100)",
        },
        forest: {
          900: "var(--forest-900)",
        },
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        positive: "var(--positive)",
        negative: "var(--negative)",
        warning: "var(--warning)",
      },
      borderRadius: {
        card: "var(--radius-card)",
        panel: "var(--radius-panel)",
        control: "var(--radius-control)",
        pill: "var(--radius-pill)",
      },
      fontFamily: {
        sans: ["var(--font-plus-jakarta-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 26, 18, 0.04)",
      },
    },
  },
  plugins: [],
};
export default config;
