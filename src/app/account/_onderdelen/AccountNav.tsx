import Link from "next/link";

/**
 * De onderdelen van het account naast elkaar.
 *
 * Het overzicht blijft de mengelmoes van webshop en winkel; de andere pagina's
 * zijn de plekken waar een klant iets doet — opnieuw bestellen, zijn lijstje
 * bijwerken, een factuur zoeken voor de boekhouding.
 */
const ONDERDELEN = [
  { href: "/account", label: "Overzicht" },
  { href: "/account/bestellingen", label: "Bestellingen" },
  { href: "/account/favorieten", label: "Bewaard" },
  { href: "/account/facturen", label: "Facturen" },
] as const;

export function AccountNav({ actief }: { actief: string }) {
  return (
    <nav aria-label="Mijn Voordeelmarkt" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-2 whitespace-nowrap">
        {ONDERDELEN.map((onderdeel) => {
          const isActief = onderdeel.href === actief;
          return (
            <li key={onderdeel.href}>
              <Link
                href={onderdeel.href}
                aria-current={isActief ? "page" : undefined}
                className={`inline-flex rounded-lg px-3 py-2 text-sm font-bold transition ${
                  isActief
                    ? "bg-ink text-white"
                    : "border-2 border-ink/10 text-ink hover:border-brand hover:text-brand"
                }`}
              >
                {onderdeel.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
