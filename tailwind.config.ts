import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Huisstijl devoordeelmarkt.nl: oranje + zwart
        brand: {
          DEFAULT: "#F5821F",
          bright: "#FF8200",
          dark: "#D96D0D",
          light: "#FFF1E3",
        },
        ink: {
          DEFAULT: "#141414",
          soft: "#555555",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-mulish)",
          "Mulish",
          "Roboto",
          "system-ui",
          "Segoe UI",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 3px rgba(20, 20, 20, 0.08), 0 4px 14px rgba(20, 20, 20, 0.06)",
        lift: "0 4px 10px rgba(20, 20, 20, 0.10), 0 12px 28px rgba(20, 20, 20, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
