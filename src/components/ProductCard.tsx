import Link from "next/link";

import { Icon } from "@/components/icons";
import { Price } from "@/components/Price";
import { ProductArt } from "@/components/ProductArt";
import { discountPct } from "@/lib/format";
import type { Product } from "@/lib/types";

export function ProductCard({ product }: { product: Product }) {
  const hasDiscount = Boolean(
    product.compareAtPrice && product.compareAtPrice > product.price,
  );
  return (
    <Link
      href={`/product/${product.slug}`}
      className="card group relative flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="relative">
        <ProductArt icon={product.art.icon} hue={product.art.hue} label={product.name} />
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
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          {product.brand}
        </p>
        <h3 className="line-clamp-2 font-bold leading-snug text-ink group-hover:text-brand">
          {product.name}
        </h3>
        <p className="line-clamp-2 text-sm text-ink-soft">{product.shortDescription}</p>
        <div className="mt-auto flex items-end justify-between pt-3">
          <Price
            price={product.price}
            compareAtPrice={product.compareAtPrice}
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
