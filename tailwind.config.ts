import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          bg: "#12141A",
          surface: "#1B1E27",
          surface2: "#232732",
          border: "#2D3140",
          text: "#EDEEF2",
          muted: "#8B93A6",
          faint: "#565D6E",
        },
        command: {
          DEFAULT: "#6C7BFF",
          soft: "#3A3F73",
          glow: "#9BA6FF",
        },
        success: "#3FC98A",
        danger: "#E0523F",
        house: {
          wolves: "#4FA8E0",
          "wolves-glow": "#8FCBF2",
          phoenix: "#FF5C39",
          "phoenix-glow": "#FF9A76",
          lions: "#E8B23F",
          "lions-glow": "#F5D27E",
          rhinos: "#98A2B3",
          "rhinos-glow": "#C7CEDA",
        },
      },
      fontFamily: {
        display: ["var(--font-sora)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jbmono)", "monospace"],
      },
      boxShadow: {
        crest: "0 0 0 1px rgba(255,255,255,0.06), 0 8px 24px -8px rgba(0,0,0,0.6)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        ring: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        ring: "ring 14s linear infinite",
        pulseSoft: "pulseSoft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
