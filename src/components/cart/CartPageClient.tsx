"use client";

import Link from "next/link";

import { useCart } from "@/components/cart/CartProvider";
import { useKorting } from "@/components/cart/useKorting";
import { BezorgBelofte } from "@/components/BezorgBelofte";
import { Icon } from "@/components/icons";
import { Mark } from "@/components/Mark";
import { ProductArt } from "@/components/ProductArt";
import { usePrijsModus } from "@/components/prijs/PrijsWeergave";
import { euro } from "@/lib/format";
import { BTW_TARIEF } from "@/lib/factuur";
import { GRATIS_VANAF_TEKST } from "@/lib/shipping";
import { TrustpilotWidget } from "@/components/TrustpilotWidget";

export function CartPageClient() {
  const { items, subtotal, hydrated, setQty, removeItem } = useCart();

  // Wie op de rest van de site excl. btw kijkt, moet hier niet ineens hogere
  // bedragen zien — dat leest als een prijsverhoging bij het mandje. Regels
  // volgen de gekozen modus; het totaal blijft inclusief, want dat is wat er
  // wordt afgerekend, met de btw als eigen regel ertussen.
  const { modus } = usePrijsModus();
  const toon = (centen: number) =>
    euro(modus === "excl" ? Math.round(centen / (1 + BTW_TARIEF)) : centen);

  // Wat de korting op dit mandje waard is; de server rekent het uit de
  // catalogus, niet uit de prijzen die in de winkelwagen zijn blijven staan.
  const kluspasKorting = useKorting(items);

  if (!hydrated) {
    return <p className="py-16 text-center text-ink-soft">Winkelwagen laden…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="card mx-auto max-w-lg overflow-hidden text-center">
        {/* Mark mag ook bij een lege pagina staan; juist daar helpt een
            gezicht meer dan een grijs karretje. */}
        <Mark pose="vragend" hoogte="h-48" className="rounded-none" />
        <div className="p-8">
          <h2 className="text-xl font-black text-ink">Je winkelwagen is leeg</h2>
          <p className="mt-2 text-ink-soft">
            Ontdek onze topdeals en vul je winkelwagen met voordeel.
          </p>
          <Link href="/" className="btn btn-primary mt-6">
            Verder winkelen
          </Link>
        </div>
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
              {/* Bewust geen pasprijs per regel: die zou uit de opgeslagen
                  winkelwagen komen en dus kunnen verouderen. Het bedrag dat
                  telt staat onderaan, en dat komt van de server. */}
              <p className="mt-1 text-sm text-ink-soft">
                {toon(item.unitPrice)} per stuk
                {modus === "excl" && " excl. btw"}
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
              {toon(item.unitPrice * item.qty)}
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
            <dt className="text-ink-soft">
              Subtotaal{modus === "excl" && " (excl. btw)"}
            </dt>
            <dd className="font-semibold">{toon(subtotal)}</dd>
          </div>
          {modus === "excl" && (
            <div className="flex justify-between">
              <dt className="text-ink-soft">Btw ({Math.round(BTW_TARIEF * 100)}%)</dt>
              <dd className="font-semibold">
                {euro(subtotal - Math.round(subtotal / (1 + BTW_TARIEF)))}
              </dd>
            </div>
          )}
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
              Met een account betaal je {euro(subtotal - kluspasKorting)}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              Dat scheelt <strong className="text-ink">{euro(kluspasKorting)}</strong> op
              dit mandje. Een account maken kost niets en gaat met je e-mailadres —
              geen wachtwoord.
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

        {/*
          Vertrouwen op het beslismoment: wanneer komt het, en kan ik betalen
          zoals ik gewend ben? Dat stond nergens, terwijl dit de plek is waar
          de klant twijfelt — de betaaliconen en de levertijd horen bij de
          afrekenknop, niet in de footer twee schermen lager.
        */}
        <ul className="mt-5 space-y-1.5 border-t border-ink/10 pt-4 text-sm text-ink-soft">
          <li className="flex items-start gap-2">
            <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-green-700" strokeWidth={3} />
            <BezorgBelofte soort="usp" />
          </li>
          <li className="flex items-start gap-2">
            <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-green-700" strokeWidth={3} />
            Gratis bezorgd vanaf {GRATIS_VANAF_TEKST} · afhalen altijd gratis
          </li>
          <li className="flex items-start gap-2">
            <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-green-700" strokeWidth={3} />
            14 dagen bedenktijd, terugbrengen mag in elke winkel
          </li>
        </ul>
        <div className="mt-3 grid grid-cols-8 gap-1.5" aria-label="Betaalmethoden">
          {["ideal", "bancontact", "klarna", "visa", "mastercard", "applepay", "googlepay", "paypal"].map(
            (methode) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={methode}
                src={`/betaalmethoden/${methode}.svg`}
                alt={methode}
                className="h-6 w-full rounded border border-ink/10 bg-white object-contain p-1"
                loading="lazy"
              />
            ),
          )}
        </div>
        <p className="mt-2 text-xs text-ink-soft">Veilig betalen via Mollie</p>
        <div className="mt-3 rounded-lg bg-slate-50 p-2">
          <TrustpilotWidget variant="micro" />
        </div>
      </aside>

      {/*
        Op een telefoon staat het Overzicht-blok ónder de artikelen: wie drie
        dingen in de wagen heeft, moet voorbij drie kaarten scrollen voordat
        er ergens "Afrekenen" staat. Deze balk houdt totaal en knop in beeld;
        vanaf lg staat de zijkolom naast de lijst en is hij overbodig.
      */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div>
            <p className="text-xs text-ink-soft">Totaal (incl. btw)</p>
            <p className="text-lg font-black text-ink">{euro(subtotal)}</p>
          </div>
          <Link href="/afrekenen" className="btn btn-primary flex-1 max-w-56">
            Afrekenen →
          </Link>
        </div>
      </div>
      {/* Ruimte zodat de vaste balk de Trustpilot-strook niet afdekt. */}
      <div className="h-20 lg:hidden" aria-hidden />
    </div>
  );
}
