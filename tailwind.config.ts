import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#E2001A",
          dark: "#B80015",
          light: "#FFE8EA",
        },
        accent: {
          DEFAULT: "#FFD500",
          dark: "#EBBF00",
          light: "#FFF7CC",
        },
        ink: {
          DEFAULT: "#17233B",
          soft: "#3D4A66",
        },
      },
      boxShadow: {
        card: "0 1px 3px rgba(23, 35, 59, 0.08), 0 4px 14px rgba(23, 35, 59, 0.06)",
        lift: "0 4px 10px rgba(23, 35, 59, 0.10), 0 12px 28px rgba(23, 35, 59, 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
