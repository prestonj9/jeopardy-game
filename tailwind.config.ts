import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "#F5F5F7",
        "surface-hover": "#EBEBED",
        border: "#E5E5E7",
        "text-primary": "#1D1D1F",
        "text-secondary": "#86868B",
        "text-tertiary": "#AEAEB2",
        accent: "#0066FF",
        "accent-cyan": "#00D4FF",
        success: "#34C759",
        danger: "#FF3B30",
        warning: "#FF9500",
      },
      boxShadow: {
        "glow-accent": "0 0 30px rgba(0, 102, 255, 0.4)",
        "glow-warning": "0 0 30px rgba(255, 149, 0, 0.4)",
      },
    },
  },
  plugins: [],
};
export default config;
