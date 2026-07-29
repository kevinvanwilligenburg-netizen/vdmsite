import Link from "next/link";

import { Icon } from "@/components/icons";
import { Price } from "@/components/Price";
import { ProductArt } from "@/components/ProductArt";
import { discountPct } from "@/lib/format";
import type { Product } from "@/lib/types";

/**
 * Kenmerken die in een lijst het verschil maken, in deze volgorde.
 *
 * Zonder `kwaliteit`: die staat op "Basis" bij alle mengverf, en achter een
 * verfnaam leest "Basis" als mengbasis in plaats van als kwaliteitsklasse.
 * Als filter is het veld prima, op de kaart verwarrend.
 */
const KENMERKEN = ["glans", "verfsoort", "toepassing"] as const;

export function ProductCard({ product }: { product: Product }) {
  const hasDiscount = Boolean(
    product.compareAtPrice && product.compareAtPrice > product.price,
  );
  const kenmerken = KENMERKEN.map((sleutel) => product.attributes?.[sleutel]).filter(
    (waarde): waarde is string => Boolean(waarde),
  );
  const maten = (product.variants ?? [])
    .map((variant) => variant.size ?? variant.name)
    .filter((maat, index, alle) => maat && alle.indexOf(maat) === index);
  return (
    <Link
      href={`/product/${product.slug}`}
      className="card group relative flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="relative">
        <ProductArt
          icon={product.art.icon}
          hue={product.art.hue}
          image={product.image}
          label={product.name}
        />
        {hasDiscount && (
          <span className="absolute left-3 top-3 rounded-md bg-brand px-2 py-1 text-sm font-black text-white shadow">
            −{discountPct(product.price, product.compareAtPrice!)}%
          </span>
        )}
        {product.colorMixable && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-ink px-2 py-1 text-xs font-bold text-white shadow">
            <Icon name="palette" className="h-3.5 w-3.5" /> Elke RAL-kleur
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          {product.brand}
        </p>
        <h3 className="line-clamp-2 font-bold leading-snug text-ink group-hover:text-brand">
          {product.name}
        </h3>
        {/* De kenmerken waar iemand in een lijst op vergelijkt. Staan ze er
            niet, dan moet je elk artikel openen om te zien of het mat of
            zijdeglans is. */}
        {kenmerken.length > 0 && (
          <p className="line-clamp-1 text-xs text-ink-soft">{kenmerken.join(" · ")}</p>
        )}
        <p className="line-clamp-2 hidden text-sm text-ink-soft sm:block">
          {product.shortDescription}
        </p>
        {/* Welke maten er zijn, zonder de pagina te openen. Bij ons is één
            product vaak vier blikken; dat zag je in de lijst nergens. */}
        {maten.length > 1 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {maten.slice(0, 4).map((maat) => (
              <span
                key={maat}
                className="rounded-md border border-ink/15 px-1.5 py-0.5 text-xs font-bold text-ink-soft"
              >
                {maat}
              </span>
            ))}
            {maten.length > 4 && (
              <span className="px-1 py-0.5 text-xs font-bold text-ink-soft">
                +{maten.length - 4}
              </span>
            )}
          </div>
        )}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-3">
          <Price
            price={product.price}
            compareAtPrice={product.compareAtPrice}
            kluspasPrice={product.kluspasPrice}
            from={Boolean(product.variants && product.variants.length > 1)}
            size="sm"
          />
          <span className="rounded-lg bg-ink px-3 py-1.5 text-sm font-bold text-white transition group-hover:bg-brand">
            Bekijk →
          </span>
        </div>
      </div>
    </Link>
  );
}
