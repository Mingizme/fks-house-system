import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          bg: "#0B0E16",
          surface: "#141824",
          surface2: "#1C2130",
          border: "#282E40",
          text: "#ECEEF5",
          muted: "#8A93A8",
          faint: "#565D6E",
        },
        command: {
          DEFAULT: "#8B5CF6",
          soft: "#2C2955",
          glow: "#C4B5FD",
          cyan: "#22D3EE",
        },
        success: "#34D399",
        danger: "#F0523F",
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
        crest: "0 0 0 1px rgba(255,255,255,0.05), 0 12px 34px -12px rgba(0,0,0,0.7)",
        glow: "0 0 0 1px rgba(139,92,246,0.22), 0 10px 34px -8px rgba(139,92,246,0.5)",
        "glow-cyan": "0 0 0 1px rgba(34,211,238,0.22), 0 10px 34px -8px rgba(34,211,238,0.45)",
      },
      backgroundImage: {
        "command-gradient": "linear-gradient(120deg, #8B5CF6 0%, #6D5DF6 45%, #22D3EE 115%)",
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
        fadeRise: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        floatSlow: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        sheen: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
      },
      animation: {
        ring: "ring 14s linear infinite",
        pulseSoft: "pulseSoft 2s ease-in-out infinite",
        fadeRise: "fadeRise 0.5s cubic-bezier(0.22,1,0.36,1) both",
        floatSlow: "floatSlow 9s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
