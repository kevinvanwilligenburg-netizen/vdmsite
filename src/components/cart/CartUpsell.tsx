"use client";

import Link from "next/link";

import Image from "next/image";

import { useCart } from "@/components/cart/CartProvider";
import { Icon } from "@/components/icons";
import { euro } from "@/lib/format";
import type { Product } from "@/lib/types";

/**
 * Bijverkoop in de winkelwagen: kleine, direct toe te voegen artikelen die
 * logisch bij de klus horen. Artikelen die al in de wagen zitten of een
 * kleurkeuze vereisen, vallen af.
 */
export function CartUpsell({ suggestions }: { suggestions: Product[] }) {
  const { items, addItem, hydrated } = useCart();

  if (!hydrated || items.length === 0) return null;

  const inCart = new Set(items.map((item) => item.productId));
  const shown = suggestions
    .filter((product) => !product.colorMixable && !inCart.has(product.id))
    .slice(0, 3);

  if (shown.length === 0) return null;

  return (
    <section aria-labelledby="upsell-titel" className="card p-5">
      <h2 id="upsell-titel" className="font-black text-ink">
        Vaak samen gekocht
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Handig om meteen mee te bestellen — bezorgen en afhalen blijven gratis.
      </p>
      <ul className="mt-4 space-y-3">
        {shown.map((product) => (
          <li key={product.id} className="flex items-center gap-3">
            {product.image ? (
              <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-black/5">
                <Image
                  src={product.image}
                  alt=""
                  fill
                  sizes="48px"
                  className="object-contain p-1"
                />
              </span>
            ) : (
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: `linear-gradient(135deg, hsl(${product.art.hue} 85% 94%), hsl(${product.art.hue} 70% 86%))`,
                  color: `hsl(${product.art.hue} 45% 38%)`,
                }}
                aria-hidden
              >
                <Icon name={product.art.icon} className="h-6 w-6" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <Link
                href={`/product/${product.slug}`}
                className="line-clamp-1 font-bold text-ink hover:text-brand"
              >
                {product.name}
              </Link>
              <p className="text-sm font-black text-brand">{euro(product.price)}</p>
            </div>
            <button
              type="button"
              onClick={() =>
                addItem({
                  key: `${product.id}::`,
                  productId: product.id,
                  slug: product.slug,
                  name: product.name,
                  unitPrice: product.price,
                  icon: product.art.icon,
                  hue: product.art.hue,
                })
              }
              className="shrink-0 rounded-lg border-2 border-ink/10 px-3 py-1.5 text-sm font-bold text-ink transition hover:border-brand hover:text-brand"
            >
              + Toevoegen
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
