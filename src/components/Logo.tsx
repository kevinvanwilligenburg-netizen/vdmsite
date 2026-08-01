import Link from "next/link";

/**
 * Logo van De Voordeelmarkt, nagebouwd als inline SVG naar "LOGO vdm 2022.png"
 * uit het officiële huisstijlpakket (nagemeten op de pixel, 1 aug 2026):
 * afgeronde badge met witte rand, zwart bovenvlak "DE VOORDEEL" (DE wit,
 * VOORDEEL oranje), en een HORIZONTALE scheidslijn op 36,7% van de hoogte —
 * de eerdere schuine lijn en de 50/50-verdeling kwamen uit een oudere
 * aangeleverde afbeelding en wijken af van het echte logo. Het oranje in het
 * logo is #F5821F (het huisstijl-oranje), niet het fellere #FF8200 van de
 * actiebalken; de letters staan in Muller, het echte logoletterype.
 */
export function Logo({ className = "h-11 w-auto" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="De Voordeelmarkt – naar de homepage"
      className="inline-flex shrink-0"
    >
      <svg viewBox="0 0 300 176" className={className} aria-hidden>
        <defs>
          <clipPath id="vdm-logo-clip">
            <rect x="6" y="6" width="288" height="164" rx="18" />
          </clipPath>
        </defs>
        <rect x="6" y="6" width="288" height="164" rx="18" fill="#141414" />
        <rect
          x="6"
          y="64.5"
          width="288"
          height="105.5"
          clipPath="url(#vdm-logo-clip)"
          fill="#F5821F"
        />
        <rect
          x="4"
          y="4"
          width="292"
          height="168"
          rx="20"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="7"
        />
        <text
          x="24"
          y="50"
          fontFamily="'Muller', var(--font-vdm), 'Arial Black', Arial, sans-serif"
          fontWeight="900"
          fontSize="34"
          fill="#FFFFFF"
          textLength="252"
          lengthAdjust="spacingAndGlyphs"
        >
          DE <tspan fill="#F5821F">VOORDEEL</tspan>
        </text>
        <text
          x="24"
          y="150"
          fontFamily="'Muller', var(--font-vdm), 'Arial Black', Arial, sans-serif"
          fontWeight="900"
          fontSize="66"
          fill="#FFFFFF"
          textLength="252"
          lengthAdjust="spacingAndGlyphs"
        >
          MARKT
        </text>
      </svg>
    </Link>
  );
}

/** De slogan naast het logo, zoals op de huidige site. */
export function Tagline() {
  return (
    <p className="hidden select-none text-xs font-black uppercase leading-tight tracking-tight text-ink lg:block">
      De beste verf
      <br />
      voor de laagste prijs.
    </p>
  );
}
