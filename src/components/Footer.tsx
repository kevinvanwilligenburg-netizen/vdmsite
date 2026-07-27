import Link from "next/link";

import { Icon } from "@/components/icons";
import { CONTACT_EMAIL, CONTACT_PHONE } from "@/lib/site";
import { getCategories, getStores } from "@/lib/tilroy";

const PAYMENT_METHODS = ["iDEAL", "Bancontact", "Creditcard", "Apple Pay"];

const SERVICE_LINKS = [
  { href: "/klantenservice", label: "Klantenservice & FAQ" },
  { href: "/bezorgen-en-afhalen", label: "Bezorgen & afhalen" },
  { href: "/winkels", label: "Openingstijden & adressen" },
  { href: "/algemene-voorwaarden", label: "Algemene voorwaarden" },
  { href: "/privacy", label: "Privacy & cookies" },
];

export async function Footer() {
  const [categories, stores] = await Promise.all([getCategories(), getStores()]);
  return (
    <footer className="mt-14 bg-ink text-white sm:mt-16">
      <div className="container-page grid gap-10 py-10 sm:grid-cols-2 sm:py-12 lg:grid-cols-4">
        <div>
          <p className="mb-3 text-lg font-black uppercase">
            De <span className="text-brand-bright">Voordeelmarkt</span>
          </p>
          <p className="text-sm leading-relaxed text-white/70">
            De beste verf voor de laagste prijs. Vóór 10:00 besteld wordt vandaag
            bezorgd — gratis, net als afhalen in de winkel. Verf mengen we gratis
            in elke kleur.
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
                Kleurkiezer
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

        <nav aria-label="Klantenservice">
          <p className="mb-3 font-bold uppercase tracking-wide text-brand-bright">
            Klantenservice
          </p>
          <ul className="space-y-2 text-sm text-white/80">
            <li>
              <a
                href={`tel:${CONTACT_PHONE.replace(/[^\d+]/g, "")}`}
                className="inline-flex items-center gap-2 transition hover:text-brand-bright"
              >
                <Icon name="phone" className="h-4 w-4 shrink-0" /> {CONTACT_PHONE}
              </a>
            </li>
            <li>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex items-center gap-2 break-all transition hover:text-brand-bright"
              >
                <Icon name="mail" className="h-4 w-4 shrink-0" /> {CONTACT_EMAIL}
              </a>
            </li>
            {SERVICE_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition hover:text-brand-bright">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-4 text-center text-xs text-white/60 sm:flex-row sm:text-left">
          <p>
            © {new Date().getFullYear()} De Voordeelmarkt · KvK 70367922 · BTW
            NL855528618B01
          </p>
          <p>Gratis bezorgd of gratis afgehaald · Veilig betalen via Mollie</p>
        </div>
      </div>
    </footer>
  );
}
