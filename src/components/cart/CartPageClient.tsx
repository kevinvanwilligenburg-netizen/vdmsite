"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
import { STAAL_PRODUCT_ID } from "@/lib/stalen";
import { TrustpilotWidget } from "@/components/TrustpilotWidget";

export function CartPageClient({ ingelogd = false }: { ingelogd?: boolean } = {}) {
  const { items, subtotal, hydrated, setQty, removeItem } = useCart();

  // Wie op de rest van de site excl. btw kijkt, moet hier niet ineens hogere
  // bedragen zien — dat leest als een prijsverhoging bij het mandje. Regels
  // volgen de gekozen modus; het totaal blijft inclusief, want dat is wat er
  // wordt afgerekend, met de btw als eigen regel ertussen.
  const { modus } = usePrijsModus();
  const toon = (centen: number) =>
    euro(modus === "excl" ? Math.round(centen / (1 + BTW_TARIEF)) : centen);

  /*
   * Hoeveel er van elk artikel te koop zijn.
   *
   * De plusknop hier kende alleen de harde grens van 99. Op de productpagina
   * en in de checkout staat de voorraadrem inmiddels wel, maar een mandje kan
   * een dag oud zijn en hier kun je het aantal gewoon ophogen — dan zit de
   * klant alsnog bij de betaalknop tegen een melding aan te kijken.
   *
   * Eén aanvraag voor het hele mandje, en alle vestigingen opgeteld omdat
   * orders met de hand over de winkels worden verdeeld. Weten we het niet,
   * dan blijft het maximum open; de checkout toetst het daarna nog een keer.
   */
  const skus = items.map((item) => item.sku).filter(Boolean).join(",");
  const [voorraad, setVoorraad] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!skus) return;
    let actief = true;
    fetch(`/api/voorraad/per-sku?skus=${encodeURIComponent(skus)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (actief && data?.perSku) setVoorraad(data.perSku);
      })
      .catch(() => undefined);
    return () => {
      actief = false;
    };
  }, [skus]);

  const maxVoor = (sku: string | undefined) => {
    const aantal = sku ? voorraad[sku] : undefined;
    return typeof aantal === "number" ? Math.max(1, aantal) : 99;
  };

  // Wat de korting op dit mandje waard is; de server rekent het uit de
  // catalogus, niet uit de prijzen die in de winkelwagen zijn blijven staan.
  const {
    bedrag: kluspasKorting,
    mogelijkeKorting,
    regels,
    cadeaus,
    pas,
    staffels,
    staffelKorting,
  } = useKorting(items);
  // De pas bij naam noemen. Er stond hardcoded "Kluspas-korting", ook boven de
  // korting van iemand met een ProfPas — die heeft helemaal geen Kluspas.
  const kortingLabel = pas === "profpas" ? "ProfPas-korting" : "Kluspas-korting";
  // Wat de server over déze regel weet: van/voor en de actienaam. De sleutel
  // is dezelfde als daar, en de kleur telt niet mee — twee kleuren van
  // hetzelfde blik hebben dezelfde prijs en dezelfde actie.
  const regelStand = (item: { productId: string; variantId?: string }) =>
    regels[`${item.productId}:${item.variantId ?? ""}`];

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
                // Kleurtesters zijn een virtueel artikel zonder productpagina;
                // hun regel wijst terug naar de stalenpagina.
                href={item.productId === STAAL_PRODUCT_ID ? "/kleurstalen" : `/product/${item.slug}`}
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
                  telt staat onderaan, en dat komt van de server.

                  De van/voor-prijs komt om diezelfde reden óók van de server
                  (zie /api/korting). Kevin miste hem hier: bij een artikel in
                  de HG-actie stond alleen "€ 7,00 per stuk", zonder dat je zag
                  dat dat een actieprijs was. */}
              <p className="mt-1 text-sm text-ink-soft">
                {toon(item.unitPrice)} per stuk
                {modus === "excl" && " excl. btw"}
                {regelStand(item)?.vanaf && (
                  <>
                    {" "}
                    <span className="line-through">{toon(regelStand(item)!.vanaf!)}</span>
                  </>
                )}
              </p>
              {/* Waaróm het een actieprijs is. Een prijskorting zit al in de
                  stuksprijs en kan dus geen regel in het overzicht krijgen —
                  dat zou dubbel tellen — maar hier hoort hij wel te staan.
                  Een aantal-actie noemt zichzelf bij naam. */}
              {(regelStand(item)?.staffel || regelStand(item)?.actie) && (
                <p className="mt-1">
                  <span className="inline-flex items-center rounded-md bg-brand-actie px-1.5 py-0.5 text-xs font-black uppercase text-white">
                    {regelStand(item)?.staffel ?? "Actieprijs"}
                  </span>
                </p>
              )}
              {/* Zeggen waarom de plusknop niet meer werkt. Zonder die regel
                  lijkt het een storing, en dan belt iemand de winkel. */}
              {item.sku && voorraad[item.sku] !== undefined && item.qty >= maxVoor(item.sku) && (
                <p className="mt-0.5 text-sm font-semibold text-brand-dark">
                  {voorraad[item.sku] <= 0
                    ? "Dit artikel is uitverkocht."
                    : `Hier houdt het op: we hebben er ${voorraad[item.sku]}.`}
                </p>
              )}
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
                disabled={item.qty >= maxVoor(item.sku)}
                onClick={() =>
                  setQty(item.key, Math.min(maxVoor(item.sku), item.qty + 1))
                }
                className="px-3 py-1.5 text-lg font-black text-ink hover:text-brand disabled:opacity-30 disabled:hover:text-ink"
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
        {/*
          Cadeaus als echte regel tussen de artikelen.

          Kevin: "de gratis spullen ook in de winkelwagen anders snappen mensen
          t niet." Alleen een regeltje in het overzicht is te makkelijk te
          missen, en dan zit er straks onaangekondigd een spons in de doos.

          Geen aantalknoppen en geen kruisje: het cadeau hangt aan wat er in de
          wagen ligt. Wie hem kwijt wil, haalt het koopartikel eruit — een
          verwijderknop die na één klik weer terugkomt is erger dan geen knop.
        */}
        {cadeaus.map((cadeau) => (
          <li
            key={cadeau.sku}
            className="card grid grid-cols-[4rem_1fr] items-center gap-x-4 border-2 border-green-700/20 bg-green-50/40 p-4 sm:flex sm:flex-nowrap"
          >
            <span className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-black/5">
              <ProductArt icon="bucket" hue={25} image={cadeau.image} size="sm" label={cadeau.naam} />
            </span>
            <div className="min-w-0 sm:flex-1">
              <p className="font-bold text-ink">
                {cadeau.slug ? (
                  <Link href={`/product/${cadeau.slug}`} className="hover:text-brand">
                    {cadeau.naam}
                  </Link>
                ) : (
                  cadeau.naam
                )}
              </p>
              <p className="mt-1">
                <span className="inline-flex items-center rounded-md bg-brand-actie px-1.5 py-0.5 text-xs font-black uppercase text-white">
                  {cadeau.campagne}
                </span>
              </p>
            </div>
            <span className="hidden w-8 text-center font-bold text-ink-soft sm:block">
              {cadeau.aantal}
            </span>
            <span className="justify-self-end font-black text-green-700 sm:w-24 sm:text-right">
              Gratis
            </span>
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
          {/* Aantal-acties staan bóven het pasvoordeel: die gelden voor
              iedereen, ook zonder account, en zijn meestal het grootste bedrag.
              Ze stapelen niet met de pas — de server kiest per actie het
              gunstigste van de twee. */}
          {staffels.map((staffel) => (
            <div key={staffel.naam} className="flex justify-between">
              <dt className="text-ink-soft">{staffel.naam}</dt>
              <dd className="font-bold text-green-700">− {euro(staffel.korting)}</dd>
            </div>
          ))}
          {/* Ingelogd? Dan is de korting geen belofte meer maar een regel, en
              hoort hij in het totaal te zitten. Kevin: "dan moet je
              kluspaskorting zien als regel en dan totaal het bedrag met
              korting." Een totaal dat hoger is dan wat je straks afrekent,
              laat de klant twijfelen op precies het verkeerde moment. */}
          {ingelogd && kluspasKorting > 0 && (
            <div className="flex justify-between">
              <dt className="text-ink-soft">{kortingLabel}</dt>
              <dd className="font-bold text-green-700">− {euro(kluspasKorting)}</dd>
            </div>
          )}
          {/* Cadeaus: er gaat geen geld af, er komt iets bij. Daarom geen
              minbedrag maar "Gratis". Ze staan óók als regel tussen de
              artikelen — zie hierboven; hier alleen nog als bevestiging in de
              optelling. */}
          {cadeaus.map((cadeau) => (
            <div key={cadeau.sku} className="flex justify-between">
              <dt className="text-ink-soft">{cadeau.naam}</dt>
              <dd className="font-bold text-green-700">Gratis</dd>
            </div>
          ))}
          <div className="flex justify-between">
            <dt className="text-ink-soft">Afhalen in de winkel</dt>
            <dd className="font-bold text-green-700">Gratis</dd>
          </div>
          <div className="flex justify-between border-t border-ink/10 pt-3 text-base">
            <dt className="font-black text-ink">Totaal (incl. btw)</dt>
            <dd className="font-black text-brand">
              {euro(subtotal - staffelKorting - (ingelogd ? kluspasKorting : 0))}
            </dd>
          </div>
        </dl>

        {/* Alleen voor wie nog géén account heeft. Een ingelogde klant kreeg
            hier de uitnodiging om een account te maken voor korting die hij al
            krijgt, en dat leest als een fout in de webshop.

            ⚠️ Op `mogelijkeKorting`, niet op `kluspasKorting`. Dat laatste is
            nul zonder sessie — de server rekent het pasvoordeel alleen voor wie
            is ingelogd — dus deze voorwaarde sprak zichzelf tegen en het blok
            heeft nooit één bezoeker gezien. `mogelijkeKorting` is wat een
            Kluspas op dít mandje zou schelen, aantal-acties er al af. */}
        {mogelijkeKorting > 0 && !ingelogd && (
          <div className="mt-4 rounded-xl bg-brand-light p-4">
            <p className="flex items-center gap-2 font-black text-ink">
              <Icon name="tag" className="h-5 w-5 shrink-0 text-brand" />
              Met een account betaal je {euro(subtotal - staffelKorting - mogelijkeKorting)}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              Dat scheelt <strong className="text-ink">{euro(mogelijkeKorting)}</strong> op
              dit mandje. Een account maken kost niets en gaat met je e-mailadres,
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
            {/* Hetzelfde bedrag als in het Overzicht-blok hierboven. Deze balk
                toonde altijd het kale subtotaal, dus op een telefoon zag je
                een hoger bedrag dan waar je op afrekent. */}
            <p className="text-lg font-black text-ink">
              {euro(subtotal - staffelKorting - (ingelogd ? kluspasKorting : 0))}
            </p>
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
