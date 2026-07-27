import Link from "next/link";

/** Logo in de stijl van devoordeelmarkt.nl: zwart blok met oranje MARKT-balk. */
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const top = size === "lg" ? "text-sm" : "text-[11px]";
  const bottom = size === "lg" ? "text-2xl" : "text-lg";
  return (
    <Link href="/" aria-label="De Voordeelmarkt – naar de homepage" className="inline-flex shrink-0">
      <span className="flex flex-col overflow-hidden rounded-lg shadow-sm ring-1 ring-black/10">
        <span
          className={`bg-ink px-2.5 pb-1 pt-1.5 text-center font-black uppercase leading-none tracking-wide text-white ${top}`}
        >
          De <span className="text-brand-bright">Voordeel</span>
        </span>
        <span
          className={`bg-brand px-2.5 pb-1.5 pt-1 text-center font-black uppercase leading-none tracking-[0.22em] text-white ${bottom}`}
        >
          Markt
        </span>
      </span>
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
