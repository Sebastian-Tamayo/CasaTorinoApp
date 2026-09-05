import type { Config } from "tailwindcss";

/**
 * Casa Torino — Design System
 * Identidad visual del back-office financiero (PWA / TPV táctil).
 * Tokens CSS espejo en src/app/globals.css (:root + @theme).
 */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: "#FAF6F0",
        ink: "#1C2541",
        card: "#FFFFFF",
        "amarillo-colombia": "#FFCD00",
        "azul-colombia": "#003087",
        "rojo-colombia": "#C8102E",
        "azul-asturias": "#0055A5",
        "rojo-espana": "#AA151B",
        esmeralda: "#1B4D3E",
        oro: "#E5A93C",
      },
      fontFamily: {
        sans: ["var(--font-montserrat)", "Montserrat", "sans-serif"],
        display: ["var(--font-playfair)", "Playfair Display", "serif"],
        accent: ["var(--font-caveat)", "Caveat", "cursive"],
      },
      boxShadow: {
        tpv: "0 2px 8px rgba(28, 37, 65, 0.08)",
        "tpv-lg": "0 8px 24px rgba(28, 37, 65, 0.12)",
      },
      borderRadius: {
        tpv: "1rem",
        "tpv-lg": "1.25rem",
      },
      minHeight: {
        touch: "3.5rem",
      },
      spacing: {
        nav: "4.5rem",
        header: "3.75rem",
      },
    },
  },
  plugins: [],
};

export default config;
