import Link from "next/link";

import { CartBadge } from "@/components/cart/CartBadge";
import { Icon } from "@/components/icons";
import { Logo, Tagline } from "@/components/Logo";
import { MobileNav } from "@/components/MobileNav";
import { StorePicker } from "@/components/store/StorePicker";
import { getCategories, getStores } from "@/lib/tilroy";

const USPS = [
  "Vóór 10:00 besteld, vandaag verzonden",
  "Verf gemengd in elke kleur",
  "Gratis bezorgen én gratis afhalen",
];

export async function Header() {
  const [categories, stores] = await Promise.all([getCategories(), getStores()]);
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
        <form action="/zoeken" role="search" className="order-last flex w-full flex-1 sm:order-none sm:w-auto">
          <label htmlFor="site-zoeken" className="sr-only">
            Zoeken in het assortiment
          </label>
          <input
            id="site-zoeken"
            type="search"
            name="q"
            enterKeyHint="search"
            placeholder="Zoeken naar…"
            className="w-full rounded-l-lg border-2 border-r-0 border-ink/10 px-4 py-2 outline-none transition focus:border-brand"
          />
          <button
            type="submit"
            className="rounded-r-lg bg-brand px-4 font-bold text-white transition hover:bg-brand-dark"
            aria-label="Zoeken"
          >
            <Icon name="search" className="h-5 w-5" />
          </button>
        </form>
        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <StorePicker />
          <CartBadge />
        </div>
      </div>

      {/* Categorienavigatie (zwart, desktop) */}
      <nav aria-label="Categorieën" className="hidden bg-ink text-white lg:block">
        <div className="container-page flex items-center gap-1 overflow-x-auto whitespace-nowrap py-1 text-sm font-bold">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/categorie/${category.slug}`}
              className="rounded-md px-3 py-1.5 transition hover:text-brand-bright"
            >
              {category.name}
            </Link>
          ))}
          <Link
            href="/kleurkiezer"
            className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-white transition hover:bg-brand-dark"
          >
            <Icon name="palette" className="h-4 w-4" /> Kleurkiezer
          </Link>
        </div>
      </nav>
    </header>
  );
}
