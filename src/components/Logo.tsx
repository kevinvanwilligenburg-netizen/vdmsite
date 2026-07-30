import Link from "next/link";

/**
 * Logo van De Voordeelmarkt, nagebouwd als inline SVG naar het echte logo:
 * afgeronde badge met witte rand, zwart bovenvlak "DE VOORDEEL" (DE wit,
 * VOORDEEL oranje) en oranje ondervlak "MARKT" met licht schuine scheidslijn.
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
        <polygon
          points="6,101 294,89 294,170 6,170"
          clipPath="url(#vdm-logo-clip)"
          fill="#FF8200"
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
          y="68"
          fontFamily="var(--font-mulish), 'Arial Black', Arial, sans-serif"
          fontWeight="900"
          fontSize="42"
          fill="#FFFFFF"
          textLength="252"
          lengthAdjust="spacingAndGlyphs"
        >
          DE <tspan fill="#FF8200">VOORDEEL</tspan>
        </text>
        <text
          x="24"
          y="154"
          fontFamily="var(--font-mulish), 'Arial Black', Arial, sans-serif"
          fontWeight="900"
          fontSize="60"
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
