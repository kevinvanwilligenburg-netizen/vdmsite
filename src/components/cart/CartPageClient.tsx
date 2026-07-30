"use client";

import Link from "next/link";

import { useCart } from "@/components/cart/CartProvider";
import { Icon } from "@/components/icons";
import { ProductArt } from "@/components/ProductArt";
import { euro } from "@/lib/format";

export function CartPageClient() {
  const { items, subtotal, hydrated, setQty, removeItem } = useCart();

  /*
   * Wat de Kluspas op dit mandje scheelt.
   *
   * De winkelwagen is waar de klant besluit, en juist daar stond niets over
   * de pas — het pasnummer kon pas een stap later, bij het afrekenen, en tot
   * dat moment leek het alsof er geen voordeel was. Nu staat het bedrag er,
   * ook zonder ingevuld nummer.
   */
  const kluspasKorting = items.reduce(
    (som, item) =>
      som +
      (item.kluspasUnitPrice && item.kluspasUnitPrice < item.unitPrice
        ? (item.unitPrice - item.kluspasUnitPrice) * item.qty
        : 0),
    0,
  );

  if (!hydrated) {
    return <p className="py-16 text-center text-ink-soft">Winkelwagen laden…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="card mx-auto max-w-lg p-10 text-center">
        <span className="inline-flex text-ink/30" aria-hidden>
          <Icon name="cart" className="h-16 w-16" strokeWidth={1.5} />
        </span>
        <h2 className="mt-4 text-xl font-black text-ink">Je winkelwagen is leeg</h2>
        <p className="mt-2 text-ink-soft">
          Ontdek onze topdeals en vul je winkelwagen met voordeel.
        </p>
        <Link href="/" className="btn btn-primary mt-6">
          Verder winkelen
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <ul className="space-y-3">
        {items.map((item) => (
          /*
            Op een telefoon staat alles op twee regels: foto en tekst boven,
            aantal-prijs-verwijderen daaronder over de volle breedte. In één
            wrappende rij vocht de titel om ruimte met de aantalknoppen en werd
            "Pattex Schilderskit Premium" over drie regels afgebroken, terwijl
            de prijs los onder de foto belandde.

            `sm:contents` laat de knoppenrij vanaf een tablet weer oplossen in
            de omringende flexrij, zodat die opzet ongewijzigd blijft.
          */
          <li
            key={item.key}
            className="card grid grid-cols-[4rem_1fr] items-start gap-x-4 gap-y-3 p-4 sm:flex sm:flex-nowrap sm:items-center"
          >
            <span className="h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-black/5">
              <ProductArt
                icon={item.icon}
                hue={item.hue}
                image={item.image}
                size="sm"
                label={item.name}
              />
            </span>
            <div className="min-w-0 sm:flex-1">
              <Link
                href={`/product/${item.slug}`}
                className="font-bold text-ink hover:text-brand"
              >
                {item.name}
              </Link>
              {item.variantName && (
                <p className="text-sm text-ink-soft">{item.variantName}</p>
              )}
              {item.color && (
                <p className="flex items-center gap-1.5 text-sm text-ink-soft">
                  <span
                    className="inline-block h-3.5 w-3.5 shrink-0 rounded-sm ring-1 ring-black/10"
                    style={{ backgroundColor: item.color.hex }}
                    aria-hidden
                  />
                  {[item.color.code, item.color.name].filter(Boolean).join(" ")}
                </p>
              )}
              <p className="mt-1 text-sm text-ink-soft">
                {euro(item.unitPrice)} per stuk
                {item.kluspasUnitPrice && item.kluspasUnitPrice < item.unitPrice && (
                  <span className="ml-1.5 whitespace-nowrap font-bold text-brand">
                    · met pas {euro(item.kluspasUnitPrice)}
                  </span>
                )}
              </p>
            </div>
            <div className="col-span-2 flex items-center justify-between gap-3 sm:contents">
            <div className="inline-flex items-center rounded-lg border-2 border-ink/10">
              <button
                type="button"
                aria-label={`Aantal van ${item.name} verlagen`}
                onClick={() => setQty(item.key, item.qty - 1)}
                className="px-3 py-1.5 text-lg font-black text-ink hover:text-brand"
              >
                −
              </button>
              <span className="w-8 text-center font-bold">{item.qty}</span>
              <button
                type="button"
                aria-label={`Aantal van ${item.name} verhogen`}
                onClick={() => setQty(item.key, item.qty + 1)}
                className="px-3 py-1.5 text-lg font-black text-ink hover:text-brand"
              >
                +
              </button>
            </div>
            <p className="ml-auto font-black text-ink sm:ml-0 sm:w-24 sm:text-right">
              {euro(item.unitPrice * item.qty)}
            </p>
            <button
              type="button"
              aria-label={`${item.name} verwijderen`}
              onClick={() => removeItem(item.key)}
              className="shrink-0 text-ink-soft transition hover:text-brand"
            >
              <Icon name="x" className="h-5 w-5" />
            </button>
            </div>
          </li>
        ))}
      </ul>

      <aside className="card h-fit p-6">
        <h2 className="text-lg font-black text-ink">Overzicht</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-soft">Subtotaal</dt>
            <dd className="font-semibold">{euro(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-soft">Afhalen in de winkel</dt>
            <dd className="font-bold text-green-700">Gratis</dd>
          </div>
          <div className="flex justify-between border-t border-ink/10 pt-3 text-base">
            <dt className="font-black text-ink">Totaal (incl. btw)</dt>
            <dd className="font-black text-brand">{euro(subtotal)}</dd>
          </div>
        </dl>

        {kluspasKorting > 0 && (
          <div className="mt-4 rounded-xl bg-brand-light p-4">
            <p className="flex items-center gap-2 font-black text-ink">
              <Icon name="tag" className="h-5 w-5 shrink-0 text-brand" />
              Met een Kluspas betaal je {euro(subtotal - kluspasKorting)}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              Dat scheelt <strong className="text-ink">{euro(kluspasKorting)}</strong> op
              dit mandje. Vul je pasnummer in bij het afrekenen — de winkel controleert
              je pas bij het verwerken.
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              Nog geen pas? Vraag hem gratis aan in een van onze winkels.
            </p>
          </div>
        )}
        <Link href="/afrekenen" className="btn btn-primary mt-6 w-full">
          Afrekenen →
        </Link>
        <Link
          href="/"
          className="mt-3 block text-center text-sm font-semibold text-ink-soft hover:text-brand"
        >
          Verder winkelen
        </Link>
      </aside>
    </div>
  );
}
