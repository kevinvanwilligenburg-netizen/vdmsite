import Link from "next/link";

import { CartBadge } from "@/components/cart/CartBadge";
import { Logo } from "@/components/Logo";
import { getCategories } from "@/lib/tilroy";

const USPS = [
  "✔ Gratis afhalen in de winkel",
  "✔ Vaak dezelfde dag klaar",
  "✔ Veilig betalen met iDEAL",
];

export async function Header() {
  const categories = await getCategories();
  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm">
      {/* USP-balk */}
      <div className="bg-ink text-white">
        <div className="container-page flex items-center justify-center gap-8 py-1.5 text-xs font-semibold sm:justify-between">
          {USPS.map((usp, index) => (
            <span key={usp} className={index > 0 ? "hidden sm:inline" : undefined}>
              {usp}
            </span>
          ))}
        </div>
      </div>

      {/* Hoofdbalk */}
      <div className="container-page flex flex-wrap items-center gap-3 py-3 sm:gap-6">
        <Logo />
        <form action="/zoeken" className="order-last flex w-full flex-1 sm:order-none sm:w-auto">
          <label htmlFor="site-zoeken" className="sr-only">
            Zoeken in het assortiment
          </label>
          <input
            id="site-zoeken"
            type="search"
            name="q"
            placeholder="Zoek in ons assortiment…"
            className="w-full rounded-l-lg border-2 border-r-0 border-ink/10 px-4 py-2 outline-none transition focus:border-brand"
          />
          <button
            type="submit"
            className="rounded-r-lg bg-brand px-4 font-bold text-white transition hover:bg-brand-dark"
          >
            Zoek
          </button>
        </form>
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/winkels"
            className="hidden items-center gap-2 rounded-lg px-3 py-2 font-bold text-ink transition hover:text-brand md:inline-flex"
          >
            <span aria-hidden>📍</span> Winkels
          </Link>
          <CartBadge />
        </div>
      </div>

      {/* Categorienavigatie */}
      <nav aria-label="Categorieën" className="bg-brand text-white">
        <div className="container-page flex items-center gap-1 overflow-x-auto whitespace-nowrap py-1 text-sm font-bold">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/categorie/${category.slug}`}
              className="rounded-md px-3 py-1.5 transition hover:bg-white/15"
            >
              {category.name}
            </Link>
          ))}
          <Link
            href="/kleurkiezer"
            className="ml-auto rounded-md bg-accent px-3 py-1.5 text-ink transition hover:bg-accent-dark"
          >
            🎨 Kleurkiezer
          </Link>
        </div>
      </nav>
    </header>
  );
}
