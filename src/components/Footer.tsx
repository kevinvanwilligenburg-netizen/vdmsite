import Link from "next/link";

import { getCategories, getStores } from "@/lib/tilroy";

const PAYMENT_METHODS = ["iDEAL", "Bancontact", "Creditcard", "Apple Pay"];

export async function Footer() {
  const [categories, stores] = await Promise.all([getCategories(), getStores()]);
  return (
    <footer className="mt-16 bg-ink text-white">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="mb-3 text-lg font-black uppercase italic">
            De <span className="text-accent">Voordeelmarkt</span>
          </p>
          <p className="text-sm leading-relaxed text-white/70">
            Dé discounter voor klussen, huis en tuin. Bestel online, betaal
            veilig en haal je bestelling gratis op in een van onze winkels.
            Verf mengen we gratis op elke RAL-kleur.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((method) => (
              <span
                key={method}
                className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-semibold"
              >
                {method}
              </span>
            ))}
          </div>
        </div>
        <nav aria-label="Assortiment">
          <p className="mb-3 font-bold uppercase tracking-wide text-accent">Assortiment</p>
          <ul className="space-y-2 text-sm">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/categorie/${category.slug}`}
                  className="text-white/80 transition hover:text-accent"
                >
                  {category.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/kleurkiezer" className="text-white/80 transition hover:text-accent">
                Kleurkiezer (RAL)
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Onze winkels">
          <p className="mb-3 font-bold uppercase tracking-wide text-accent">Onze winkels</p>
          <ul className="space-y-2 text-sm">
            {stores.map((store) => (
              <li key={store.id}>
                <Link
                  href={`/winkels/${store.slug}`}
                  className="text-white/80 transition hover:text-accent"
                >
                  {store.city}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Service">
          <p className="mb-3 font-bold uppercase tracking-wide text-accent">Service</p>
          <ul className="space-y-2 text-sm text-white/80">
            <li>
              <Link href="/winkels" className="transition hover:text-accent">
                Openingstijden &amp; contact
              </Link>
            </li>
            <li>
              <Link href="/winkelwagen" className="transition hover:text-accent">
                Winkelwagen
              </Link>
            </li>
            <li>
              <Link href="/zoeken" className="transition hover:text-accent">
                Zoeken
              </Link>
            </li>
          </ul>
          <p className="mt-6 text-sm text-white/70">
            Vragen? Bel of mail je{" "}
            <Link href="/winkels" className="underline transition hover:text-accent">
              dichtstbijzijnde winkel
            </Link>
            .
          </p>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-4 text-xs text-white/60 sm:flex-row">
          <p>© {new Date().getFullYear()} De Voordeelmarkt · devoordeelmarkt.nl</p>
          <p>Online bestellen · Gratis afhalen in de winkel</p>
        </div>
      </div>
    </footer>
  );
}
