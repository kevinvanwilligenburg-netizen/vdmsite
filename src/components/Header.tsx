import { cookies } from "next/headers";
import Link from "next/link";

import { CartBadge } from "@/components/cart/CartBadge";
import { Icon } from "@/components/icons";
import { Logo, Tagline } from "@/components/Logo";
import { MegaMenu } from "@/components/MegaMenu";
import { MobileNav } from "@/components/MobileNav";
import { SearchBox } from "@/components/search/SearchBox";
import { StorePicker } from "@/components/store/StorePicker";
import { emailVanSessie, SESSIE_COOKIE } from "@/lib/account";
import { GRATIS_VANAF_TEKST } from "@/lib/shipping";
import { getMenu, getStores } from "@/lib/tilroy";

const USPS = [
  "Vóór 09:00 besteld? Vandaag bezorgd mogelijk",
  "Verf gemengd in elke kleur",
  `Gratis bezorgd vanaf ${GRATIS_VANAF_TEKST} · altijd gratis afhalen`,
];

export async function Header() {
  const [menu, stores, email] = await Promise.all([
    getMenu(),
    getStores(),
    emailVanSessie(cookies().get(SESSIE_COOKIE)?.value),
  ]);
  const ingelogd = Boolean(email);
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
          {/*
            "Mijn pas" stond hier terwijl de knop naar het account leidt, en
            hij verdween op een telefoon. Een klant die wil inloggen zoekt naar
            "inloggen", en wie al is ingelogd wil dat kunnen zien.
          */}
          <Link
            href="/account"
            aria-label={ingelogd ? "Mijn account" : "Inloggen"}
            className={`inline-flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-sm font-bold transition ${
              ingelogd
                ? "border-brand bg-brand-light text-brand"
                : "border-ink/10 text-ink hover:border-brand hover:text-brand"
            }`}
          >
            <Icon name={ingelogd ? "circle-check" : "hand"} className="h-5 w-5" />
            <span className="hidden lg:inline">
              {ingelogd ? "Mijn account" : "Inloggen"}
            </span>
          </Link>
          <CartBadge />
        </div>
      </div>

      {/* Categorienavigatie met uitklappaneel (zwart, desktop) */}
      <MegaMenu categories={menu} />
    </header>
  );
}
