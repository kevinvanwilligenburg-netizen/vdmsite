import Link from "next/link";

import { Icon } from "@/components/icons";
import { ProductArt } from "@/components/ProductArt";
import { euro } from "@/lib/format";
import type { CompanionProduct } from "@/lib/tilroy";

/**
 * "Hier heb je ook bij nodig": accessoires die echt bij dit product horen —
 * een muurroller bij muurverf, schuurpapier en grondverf bij lak. Met een
 * korte reden erbij, zodat het advies is in plaats van reclame.
 */
export function Companions({
  items,
  variant = "breed",
}: {
  items: CompanionProduct[];
  /**
   * "kolom" zet het blok naast de koopknop in plaats van eronder. Daar hoort
   * het thuis: wie de vloer in zijn mandje legt moet op datzelfde moment zien
   * dat er ondervloer en plinten bij komen kijken, niet pas als hij al langs
   * de omschrijving is gescrold.
   */
  variant?: "breed" | "kolom";
}) {
  if (items.length === 0) return null;
  const kolom = variant === "kolom";

  return (
    <section
      aria-labelledby="erbij-titel"
      className={kolom ? "rounded-xl border-2 border-ink/10 p-4" : "card p-5 sm:p-6"}
    >
      <h2
        id="erbij-titel"
        className={`flex items-center gap-2 font-black text-ink ${
          kolom ? "uppercase" : "text-lg"
        }`}
      >
        <Icon name="check" className="h-5 w-5 text-brand" strokeWidth={3} />
        Hier heb je ook bij nodig
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Zo heb je alles in huis om de klus in één keer goed te doen.
      </p>
      <ul
        className={
          kolom
            ? "mt-3 space-y-1"
            : "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        }
      >
        {items.map(({ product, reason }) => (
          <li key={product.id}>
            <Link
              href={`/product/${product.slug}`}
              className="group flex h-full gap-3 rounded-xl p-2 transition hover:bg-slate-50"
            >
              <span className="h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-black/5">
                <ProductArt
                  icon={product.art.icon}
                  hue={product.art.hue}
                  image={product.image}
                  size="sm"
                  label={product.name}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-sm font-bold text-ink group-hover:text-brand">
                  {product.name}
                </span>
                <span className="mt-0.5 block text-xs text-ink-soft">{reason}</span>
                <span className="mt-1 block font-black text-brand">{euro(product.price)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
