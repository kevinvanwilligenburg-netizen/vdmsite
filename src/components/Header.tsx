import Link from "next/link";

import { CartBadge } from "@/components/cart/CartBadge";
import { Icon } from "@/components/icons";
import { Logo, Tagline } from "@/components/Logo";
import { MegaMenu } from "@/components/MegaMenu";
import { MobileNav } from "@/components/MobileNav";
import { SearchBox } from "@/components/search/SearchBox";
import { StorePicker } from "@/components/store/StorePicker";
import { getMenu, getStores } from "@/lib/tilroy";

const USPS = [
  "Vóór 09:00 besteld? Vandaag bezorgd mogelijk",
  "Verf gemengd in elke kleur",
  "Gratis bezorgd vanaf € 59 · altijd gratis afhalen",
];

export async function Header() {
  const [menu, stores] = await Promise.all([getMenu(), getStores()]);
  const categories = menu;
  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm">
      {/* USP-balk (oranje, zoals op devoordeelmarkt.nl) */}
      <div className="bg-brand-bright text-white">
        <div className="container-page flex items-center justify-center gap-8 py-1.5 text-[11px] font-bold sm:justify-between sm:text-xs">
          {USPS.map((usp, index) => (
            <span
              key={usp}
              className={`inline-flex items-center gap-1.5 ${index > 0 ? "hidden sm:inline-flex" : ""}`}
            >
              <Icon name="check" className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />
              {usp}
            </span>
          ))}
          <Link href="/klantenservice" className="hidden underline-offset-2 hover:underline md:inline">
            Klantenservice
          </Link>
        </div>
      </div>

      {/* Hoofdbalk */}
      <div className="container-page flex flex-wrap items-center gap-3 py-3 sm:gap-5">
        <MobileNav
          categories={categories.map((category) => ({
            href: `/categorie/${category.slug}`,
            label: category.name,
            // Dezelfde soorten als in het megamenu, zodat een klant op zijn
            // telefoon niet eerst een categoriepagina hoeft te laden.
            soorten: category.soorten,
          }))}
          stores={stores.map((store) => ({
            href: `/winkels/${store.slug}`,
            label: store.city,
          }))}
        />
        <div className="flex items-center gap-3">
          <Logo className="h-9 w-auto sm:h-11" />
          <Tagline />
        </div>
        <SearchBox />
        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <StorePicker />
          <Link
            href="/account"
            aria-label="Mijn Voordeelmarkt"
            className="hidden items-center gap-1.5 rounded-lg border-2 border-ink/10 px-3 py-2 text-sm font-bold text-ink transition hover:border-brand hover:text-brand sm:inline-flex"
          >
            <Icon name="hand" className="h-5 w-5" />
            <span className="hidden lg:inline">Mijn pas</span>
          </Link>
          <CartBadge />
        </div>
      </div>

      {/* Categorienavigatie met uitklappaneel (zwart, desktop) */}
      <MegaMenu categories={menu} />
    </header>
  );
}
