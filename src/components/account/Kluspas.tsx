import { KLUSPAS_DISCOUNT_LABEL } from "@/lib/kluspas";

/**
 * De Kluspas als scanbare kaart.
 *
 * De streepjescode is Code 128-B, in SVG opgebouwd: dat is wat de kassa leest
 * en het werkt op elke telefoon zonder app of certificaat. Een echte
 * Apple Wallet-pas vraagt een ondertekend certificaat van Apple; zolang dat
 * er niet is, is dit de werkende variant en geen tijdelijke schijnoplossing.
 */

/** Code 128-B patronen, per teken vanaf spatie (ASCII 32). */
const CODE128B = [
  "11011001100", "11001101100", "11001100110", "10010011000", "10010001100",
  "10001001100", "10011001000", "10011000100", "10001100100", "11001001000",
  "11001000100", "11000100100", "10110011100", "10011011100", "10011001110",
  "10111001100", "10011101100", "10011100110", "11001110010", "11001011100",
  "11001001110", "11011100100", "11001110100", "11101101110", "11101001100",
  "11100101100", "11100100110", "11101100100", "11100110100", "11100110010",
  "11011011000", "11011000110", "11000110110", "10100011000", "10001011000",
  "10001000110", "10110001000", "10001101000", "10001100010", "11010001000",
  "11000101000", "11000100010", "10110111000", "10110001110", "10001101110",
  "10111011000", "10111000110", "10001110110", "11101110110", "11010001110",
  "11000101110", "11011101000", "11011100010", "11011101110", "11101011000",
  "11101000110", "11100010110", "11101101000", "11101100010", "11100011010",
  "11101111010", "11001000010", "11110001010", "10100110000", "10100001100",
  "10010110000", "10010000110", "10000101100", "10000100110", "10110010000",
  "10110000100", "10011010000", "10011000010", "10000110100", "10000110010",
  "11000010010", "11001010000", "11110111010", "11000010100", "10001111010",
  "10100111100", "10010111100", "10010011110", "10111100100", "10011110100",
  "10011110010", "11110100100", "11110010100", "11110010010", "11011011110",
  "11011110110", "11110110110", "10101111000", "10100011110", "10001011110",
  "10111101000", "10111100010", "11110101000", "11110100010", "10111011110",
  "10111101110", "11101011110", "11110101110",
];
const START_B = "11010010000";
const STOP = "1100011101011";

function code128b(waarde: string): { balken: string; breedte: number } {
  const tekens = [...waarde].filter((teken) => {
    const code = teken.charCodeAt(0);
    return code >= 32 && code <= 126;
  });

  // Checksum: startwaarde 104 (Start B), daarna positie × tekenwaarde.
  let som = 104;
  let patroon = START_B;
  tekens.forEach((teken, index) => {
    const waardeVanTeken = teken.charCodeAt(0) - 32;
    patroon += CODE128B[waardeVanTeken];
    som += waardeVanTeken * (index + 1);
  });
  patroon += CODE128B[som % 103] + STOP;

  return { balken: patroon, breedte: patroon.length };
}

export function Kluspas({
  nummer,
  naam,
}: {
  nummer: string;
  naam?: string;
}) {
  const { balken, breedte } = code128b(nummer);

  return (
    <div className="overflow-hidden rounded-2xl bg-ink text-white shadow-lift">
      <div className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-brand-bright">
            Kluspas
          </p>
          <p className="mt-1 text-lg font-black">{naam ?? "De Voordeelmarkt"}</p>
          <p className="text-sm text-white/70">{KLUSPAS_DISCOUNT_LABEL} op het hele assortiment</p>
        </div>
        <span className="rounded-lg bg-brand px-2.5 py-1 text-xs font-black uppercase">
          Actief
        </span>
      </div>

      <div className="bg-white p-4">
        <svg
          viewBox={`0 0 ${breedte} 70`}
          preserveAspectRatio="none"
          className="h-16 w-full"
          role="img"
          aria-label={`Streepjescode van Kluspas ${nummer}`}
        >
          {[...balken].map((bit, index) =>
            bit === "1" ? (
              <rect key={index} x={index} y="0" width="1" height="70" fill="#141414" />
            ) : null,
          )}
        </svg>
        <p className="mt-2 text-center font-mono text-sm font-bold tracking-[0.3em] text-ink">
          {nummer}
        </p>
      </div>

      <p className="px-5 py-3 text-xs text-white/60">
        Laat deze code scannen bij de kassa. Zet de pagina op je beginscherm,
        dan heb je hem altijd bij de hand.
      </p>
    </div>
  );
}
