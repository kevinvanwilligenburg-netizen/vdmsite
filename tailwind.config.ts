import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /*
         * Kleuren uit de huisstijlgids (8159 DVDM Huisstijl gids v1):
         *   Oranje  PMS 151   C0 M60 Y100 K0   #FF8200
         *   Zwart             C30 M30 Y30 K100 #000000
         *   Rood    PMS 2347  C0 M88 Y100 K0   #E10600  — alleen voor acties
         *
         * Het oranje stond hier op #F5821F, een tint die nergens in de gids
         * voorkomt. Naast een echte huisstijluiting (folder, gevel, tas) valt
         * dat op als een net iets andere oranje.
         */
        brand: {
          DEFAULT: "#FF8200",
          bright: "#FF8200",
          dark: "#D96E00",
          light: "#FFF1E3",
          /** PMS 2347. In de gids voorbehouden aan acties: "GRATIS", "2 halen 1 betalen". */
          actie: "#E10600",
        },
        ink: {
          /*
           * Zwart uit de gids voor vlakken en koppen. Voor lopende tekst
           * blijft er een iets zachter grijs, anders wordt een lange
           * productomschrijving hard om te lezen.
           */
          DEFAULT: "#000000",
          soft: "#555555",
        },
      },
      fontFamily: {
        // Lopende tekst volgens de huisstijlgids. "Muller" staat vooraan voor
        // het geval de licentie er komt en het lettertype lokaal geladen wordt.
        sans: [
          "var(--font-vdm)",
          "Roboto Condensed",
          "Roboto",
          "system-ui",
          "Segoe UI",
          "sans-serif",
        ],
        kop: [
          "Muller",
          "var(--font-vdm)",
          "Roboto Condensed",
          "system-ui",
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
