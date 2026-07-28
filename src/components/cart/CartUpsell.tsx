"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useCart } from "@/components/cart/CartProvider";
import { ProductArt } from "@/components/ProductArt";
import { euro } from "@/lib/format";

interface Suggestie {
  id: string;
  slug: string;
  sku: string;
  name: string;
  price: number;
  kluspasPrice?: number;
  image?: string;
  art: { icon: string; hue: number };
  waarom: string;
}

/**
 * Bijverkoop in de winkelwagen.
 *
 * De suggesties worden opgehaald op basis van wat er werkelijk in de wagen
 * ligt, met de reden erbij. Eerder stond hier een vaste lijst goedkope
 * artikelen: bij een blik beits kreeg de klant houtbouten en
 * staaldraadklemmen aangeboden, wat niets verkoopt en onnozel oogt.
 */
export function CartUpsell() {
  const { items, addItem, hydrated } = useCart();
  const [suggesties, setSuggesties] = useState<Suggestie[]>([]);
  const [toegevoegd, setToegevoegd] = useState<string[]>([]);

  // Sleutel van de mandje-inhoud: alleen opnieuw ophalen als er echt iets
  // anders in ligt, niet bij elke aantalwijziging.
  const inhoud = items
    .map((item) => item.productId)
    .sort()
    .join(",");

  useEffect(() => {
    if (!hydrated || inhoud === "") {
      setSuggesties([]);
      return;
    }
    let afgebroken = false;
    fetch("/api/bijverkoop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: inhoud.split(",") }),
    })
      .then((response) => (response.ok ? response.json() : { producten: [] }))
      .then((data: { producten?: Suggestie[] }) => {
        if (!afgebroken) setSuggesties(data.producten ?? []);
      })
      .catch(() => {
        // Bijverkoop is meegenomen, niet essentieel: stilhouden bij een fout.
      });
    return () => {
      afgebroken = true;
    };
  }, [inhoud, hydrated]);

  if (!hydrated || items.length === 0) return null;

  const inCart = new Set(items.map((item) => item.productId));
  const zichtbaar = suggesties.filter((product) => !inCart.has(product.id)).slice(0, 4);
  if (zichtbaar.length === 0) return null;

  return (
    <section aria-labelledby="upsell-titel" className="card p-5">
      <h2 id="upsell-titel" className="font-black text-ink">
        Hier heb je dit ook bij nodig
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Passend bij wat er in je mandje ligt — bezorgen en afhalen blijven gratis.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {zichtbaar.map((product) => {
          const isToegevoegd = toegevoegd.includes(product.id);
          return (
            <li
              key={product.id}
              className="flex items-center gap-3 rounded-xl border-2 border-ink/10 p-3"
            >
              <Link
                href={`/product/${product.slug}`}
                className="h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-1 ring-black/5"
              >
                <ProductArt
                  icon={product.art.icon}
                  hue={product.art.hue}
                  image={product.image}
                  size="sm"
                  label={product.name}
                />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/product/${product.slug}`}
                  className="line-clamp-1 font-bold text-ink hover:text-brand"
                >
                  {product.name}
                </Link>
                <p className="line-clamp-1 text-xs text-ink-soft">{product.waarom}</p>
                <p className="text-sm font-black text-brand">
                  {euro(product.kluspasPrice ?? product.price)}
                  {product.kluspasPrice && (
                    <span className="ml-1 text-[10px] font-bold uppercase">Kluspas</span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  addItem({
                    key: `${product.id}::`,
                    productId: product.id,
                    sku: product.sku,
                    slug: product.slug,
                    name: product.name,
                    unitPrice: product.price,
                    kluspasUnitPrice: product.kluspasPrice,
                    icon: product.art.icon,
                    hue: product.art.hue,
                    image: product.image,
                  });
                  setToegevoegd((huidig) => [...huidig, product.id]);
                }}
                disabled={isToegevoegd}
                className="shrink-0 rounded-lg border-2 border-ink/10 px-3 py-1.5 text-sm font-bold text-ink transition hover:border-brand hover:text-brand disabled:border-green-600/30 disabled:text-green-700"
              >
                {isToegevoegd ? "In mandje" : "+ Toevoegen"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
