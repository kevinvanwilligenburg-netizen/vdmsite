import Link from "next/link";

import { Icon } from "@/components/icons";
import { Nieuwsbrief } from "@/components/Nieuwsbrief";
import { TrustpilotWidget } from "@/components/TrustpilotWidget";
import { getWhatsappNummer } from "@/lib/contact";
import { kleurtestersActief } from "@/lib/instellingen";
import { CONTACT_EMAIL, CONTACT_PHONE, WHATSAPP_TIJDEN } from "@/lib/site";
import { GRATIS_VANAF_TEKST } from "@/lib/shipping";
import { getBrands, getNavCategories, getStores } from "@/lib/tilroy";

const PAYMENT_METHODS = ["iDEAL", "Bancontact", "Creditcard", "Apple Pay", "Klarna"];

const SERVICE_LINKS = [
  { href: "/zakelijk", label: "Zakelijk inkopen" },
  { href: "/klantenservice", label: "Klantenservice & FAQ" },
  { href: "/bezorgen-en-afhalen", label: "Bezorgen & afhalen" },
  { href: "/winkels", label: "Openingstijden & adressen" },
  { href: "/vacatures", label: "Werken bij De Voordeelmarkt" },
  { href: "/algemene-voorwaarden", label: "Algemene voorwaarden" },
  { href: "/privacy", label: "Privacy & cookies" },
];

export async function Footer() {
  const [categories, brands, stores, whatsappNummer, testers] = await Promise.all([
    getNavCategories(10),
    getBrands(10),
    getStores(),
    getWhatsappNummer(),
    kleurtestersActief(),
  ]);
  return (
    <footer className="mt-14 bg-ink text-white sm:mt-16">
      {/*
        Nieuwsbrief in een eigen strook boven de kolommen.

        Stond eerst als zesde kolom in een raster van vijf; dan valt het rijtje
        uit elkaar en houd je een gat over. Los daarvan hoort een aanmeldveld
        niet in een kolom geperst: het is één regel invullen, en dat verdient
        de breedte in plaats van een smalle strook naast de merkenlijst.
      */}
      <div className="border-b border-white/10">
        <div className="container-page flex flex-wrap items-center justify-between gap-6 py-8">
          <div className="min-w-0 max-w-md">
            <Nieuwsbrief donker />
          </div>
          <p className="hidden max-w-xs text-sm text-white/60 lg:block">
            Eens per maand een mail met wat er in de aanbieding is en waar je bij
            het klussen wat aan hebt. Meer niet.
          </p>
        </div>
      </div>

      <div className="container-page grid gap-10 py-10 sm:grid-cols-2 sm:py-12 lg:grid-cols-3 xl:grid-cols-5">
        <div>
          <p className="mb-3 text-lg font-black uppercase">
            De <span className="text-brand-bright">Voordeelmarkt</span>
          </p>
          <p className="text-sm leading-relaxed text-white/70">
            De beste verf voor de laagste prijs. Vanaf {GRATIS_VANAF_TEKST} bezorgen we gratis,
            en afhalen in de winkel is dat altijd. Verf mengen we gratis in elke
            kleur.
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
          <div className="mt-4 rounded-lg bg-white/5 p-2">
            <TrustpilotWidget variant="micro" />
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
            <li>
              <Link
                href="/kleuren"
                className="text-white/80 transition hover:text-brand-bright"
              >
                Alle kleuren &amp; RAL
              </Link>
            </li>
            {testers && (
              <li>
                <Link
                  href="/kleurstalen"
                  className="text-white/80 transition hover:text-brand-bright"
                >
                  Kleurtesters
                </Link>
              </li>
            )}
            <li>
              <Link
                href="/klusadvies"
                className="text-white/80 transition hover:text-brand-bright"
              >
                Klusadvies
              </Link>
            </li>
            <li>
              <Link
                href="/categorieen"
                className="font-semibold text-brand-bright transition hover:text-white"
              >
                Alle categorieën →
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Merken">
          <p className="mb-3 font-bold uppercase tracking-wide text-brand-bright">
            Merken
          </p>
          <ul className="space-y-2 text-sm">
            {brands.map((brand) => (
              <li key={brand.slug}>
                <Link
                  href={`/merk/${brand.slug}`}
                  className="text-white/80 transition hover:text-brand-bright"
                >
                  {brand.name}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/merken"
                className="font-semibold text-brand-bright transition hover:text-white"
              >
                Alle merken →
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
            {whatsappNummer && (
              <li>
                <a
                  href={`https://wa.me/${whatsappNummer}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 transition hover:text-brand-bright"
                >
                  <Icon name="chat" className="h-4 w-4 shrink-0" /> Appen met de winkel
                  <span className="text-xs text-white/60">({WHATSAPP_TIJDEN})</span>
                </a>
              </li>
            )}
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
