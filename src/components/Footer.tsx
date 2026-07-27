import Link from "next/link";

import { Icon } from "@/components/icons";
import { CONTACT_EMAIL, CONTACT_PHONE } from "@/lib/site";
import { getCategories, getStores } from "@/lib/tilroy";

const PAYMENT_METHODS = ["iDEAL", "Bancontact", "Creditcard", "Apple Pay"];

export async function Footer() {
  const [categories, stores] = await Promise.all([getCategories(), getStores()]);
  return (
    <footer className="mt-16 bg-ink text-white">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="mb-3 text-lg font-black uppercase">
            De <span className="text-brand-bright">Voordeelmarkt</span>
          </p>
          <p className="text-sm leading-relaxed text-white/70">
            De beste verf voor de laagste prijs. Bestel online, betaal veilig en
            haal je bestelling gratis op in een van onze winkels. Verf mengen we
            gratis op elke RAL-kleur — klaar terwijl je wacht.
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
          <p className="mb-3 font-bold uppercase tracking-wide text-brand-bright">
            Assortiment
          </p>
          <ul className="space-y-2 text-sm">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/categorie/${category.slug}`}
                  className="text-white/80 transition hover:text-brand-bright"
                >
                  {category.name}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/kleurkiezer"
                className="text-white/80 transition hover:text-brand-bright"
              >
                Kleurkiezer (RAL)
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Onze winkels">
          <p className="mb-3 font-bold uppercase tracking-wide text-brand-bright">
            Onze winkels
          </p>
          <ul className="space-y-2 text-sm">
            {stores.map((store) => (
              <li key={store.id}>
                <Link
                  href={`/winkels/${store.slug}`}
                  className="text-white/80 transition hover:text-brand-bright"
                >
                  De Voordeelmarkt {store.city}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="mb-3 font-bold uppercase tracking-wide text-brand-bright">
            Klantenservice
          </p>
          <ul className="space-y-2 text-sm text-white/80">
            <li>
              <a
                href={`tel:${CONTACT_PHONE.replace(/[^\d+]/g, "")}`}
                className="inline-flex items-center gap-2 transition hover:text-brand-bright"
              >
                <Icon name="phone" className="h-4 w-4" /> {CONTACT_PHONE}
              </a>
            </li>
            <li>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex items-center gap-2 transition hover:text-brand-bright"
              >
                <Icon name="mail" className="h-4 w-4" /> {CONTACT_EMAIL}
              </a>
            </li>
            <li>
              <Link href="/winkels" className="transition hover:text-brand-bright">
                Openingstijden &amp; adressen
              </Link>
            </li>
            <li>
              <Link href="/winkelwagen" className="transition hover:text-brand-bright">
                Winkelwagen
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-4 text-xs text-white/60 sm:flex-row">
          <p>
            © {new Date().getFullYear()} De Voordeelmarkt · KvK 70367922 · BTW
            NL855528618B01
          </p>
          <p>Online bestellen · Gratis afhalen in de winkel</p>
        </div>
      </div>
    </footer>
  );
}
