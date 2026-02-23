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
        "jeopardy-blue": "#060CE9",
        "jeopardy-category": "#03008D",
        "jeopardy-gold": "#FFD700",
        "jeopardy-buzz": "#FF4500",
      },
    },
  },
  plugins: [],
};
export default config;
