import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        "lake-dark": "var(--lake-dark)",
        lake: "var(--lake)",
        "lake-light": "var(--lake-light)",
        teal: "var(--teal)",
        aqua: "var(--aqua)",
        sand: "var(--sand)",
        "sand-light": "var(--sand-light)",
        ink: "var(--ink)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        "surface-soft": "var(--surface-soft)",
        primary: "var(--primary)",
        secondary: "var(--secondary)",
        accent: "var(--accent)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        muted: "var(--muted)",
        border: "var(--border)",
        ring: "var(--ring)"
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        card: "0 8px 28px rgba(18, 51, 66, 0.07)"
      },
      borderRadius: {
        kol: "0.875rem"
      }
    }
  },
  plugins: []
};

export default config;
