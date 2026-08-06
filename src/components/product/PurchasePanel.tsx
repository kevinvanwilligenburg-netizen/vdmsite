"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useCart } from "@/components/cart/CartProvider";
import { Icon } from "@/components/icons";
import { useGekozenVariant } from "@/components/product/GekozenVariant";
import { KleurVenster } from "@/components/kleur/KleurVenster";
import { kleurLabel } from "@/components/kleur/waaier";
import { Price } from "@/components/Price";
import { PaintCalculator } from "@/components/product/PaintCalculator";
import { Voorraadmelding } from "@/components/product/Voorraadmelding";
import {
  coveragePerLiter,
  hasBases,
  PAINT_BASES,
  pickVariant,
  sizesInLiters,
  sizesOf,
} from "@/lib/paint-bases";
import { euro } from "@/lib/format";
import { STAAL_PRIJS_TEKST } from "@/lib/stalen";
import type { PaintColor, Product } from "@/lib/types";

export function PurchasePanel({
  product,
  colors,
  testersActief = false,
}: {
  product: Product;
  colors: PaintColor[];
  /** Staat de kleurtester open? Kevin zet die aan in het dashboard. */
  testersActief?: boolean;
}) {
  const { addItem } = useCart();

  const variants = product.variants ?? [];
  const basesInPlay = hasBases(product);
  const sizes = sizesOf(product);
  const [size, setSize] = useState<string | undefined>(sizes[0]);
  const [variantId, setVariantId] = useState<string | undefined>(variants[0]?.id);
  const [qty, setQtyState] = useState(1);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState<PaintColor | null>(null);
  const [vensterOpen, setVensterOpen] = useState(false);
  // 100% wit is bij Sikkens een écht artikel met eigen voorraad en prijs —
  // vaak goedkoper dan gemengd. Het staat standaard aan omdat wit veruit het
  // meest verkocht wordt; wie een kleur kiest zet het vanzelf uit.
  const [witGekozen, setWitGekozen] = useState(true);

  // ?kleur= uit de kleurkiezer pas na hydration lezen, zodat de pagina
  // volledig statisch gerenderd kan blijven (belangrijk voor SEO).
  // Ondersteunt keys ("ral:9010", "hub:…") én kale RAL-codes ("9010").
  useEffect(() => {
    if (!product.colorMixable) return;
    const preselect = new URLSearchParams(window.location.search).get("kleur");
    if (!preselect) return;

    const local =
      colors.find((candidate) => candidate.key === preselect) ??
      colors.find((candidate) => candidate.key === `ral:${preselect}`);
    if (local) {
      setColor(local);
      return;
    }

    // Kleur uit een merkenwaaier: opzoeken bij de server. Een sleutel
    // ("hub:akzo:…", uit de Shopping-feed) gaat via ?key= — als zoektekst
    // matcht hij nergens op en landde de klant zonder kleur, met de
    // wit-prijs in beeld terwijl de feed de mengprijs beloofde.
    let active = true;
    const opzoeken = preselect.includes(":")
      ? `/api/kleuren?key=${encodeURIComponent(preselect)}`
      : `/api/kleuren?q=${encodeURIComponent(preselect)}&collection=alle&limit=1`;
    fetch(opzoeken)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const found = data?.colors?.[0];
        if (active && found) setColor(found);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [product.colorMixable, colors]);

  // Bij mengverf volgt de basis (en dus het exacte blik) uit de gekozen kleur;
  // de klant kiest alleen de inhoud. Anders is de variant een gewone keuze.
  const activeVariant = basesInPlay
    ? pickVariant(product, size, color)
    : variants.find((variant) => variant.id === variantId);

  // Het fabriekswit-artikel bij de gekozen inhoud, als dat bestaat en op
  // voorraad is. Zit aan de maat, niet aan de basis.
  const witVariant = basesInPlay
    ? variants.find((variant) => (variant.size ?? variant.name) === size && variant.wit)
    : undefined;
  const wit = witVariant?.wit && witVariant.wit.inStock ? witVariant.wit : undefined;
  const wit100 = Boolean(wit && witGekozen && !color);

  /**
   * Wit bij mengverf zonder fabriekswit-artikel.
   *
   * Kevin: "ik mis hier dat je direct 100% wit kan kiezen, dat moet bij alle
   * mengverf." Klopt, en de reden dat het er niet stond is de voorraad: alleen
   * Sikkens heeft in Tilroy een écht wit artikel naast de mengbare broer.
   * Gemeten op de hele feed (5.102 regels): Sikkens 44 gekoppelde witten,
   * Fitex 0 van 343, Drenth 0 van 77, Histor 0 van 67, Flexa 0 van 19.
   * Die witten bestáán daar simpelweg niet als apart blik.
   *
   * Wit is bij die merken dus geen ander artikel maar een mengkleur, en dat
   * kan de klant nu met één klik kiezen in plaats van via de waaier. Wel met
   * het eerlijke bijschrift: gemengd, niet uit voorraad.
   */
  const witGemengd = useMemo(
    () =>
      product.colorMixable && !wit
        ? colors.find((kleur) => kleur.key === "ral:9010") ??
          colors.find((kleur) => /\b9010\b/.test(kleur.code ?? "")) ??
          null
        : null,
    [product.colorMixable, wit, colors],
  );
  const witGemengdGekozen = Boolean(witGemengd && color?.key === witGemengd.key);


  // Uitverkocht op het niveau waar de klant naar kijkt: de gekozen maat als
  // de feed die per maat kent, anders het product als geheel. Uitverkochte
  // maten blijven in de lijst staan — wie op "2,5 L" zoekt moet zien dat we
  // hem voeren — maar zijn niet bestelbaar.
  const maatUitverkocht = wit100
    ? !wit
    : activeVariant
      ? activeVariant.inStock === false
      : product.inStock === false;

  /*
   * Kost een donkere kleur meer dan een lichte?
   *
   * Bij muurverf wel: de donkere basis is een duurder blik. "Gratis gemengd"
   * klopt dan nog steeds voor het mengen zelf, maar het leest als "elke kleur
   * kost hetzelfde" — en dat is niet zo. We zeggen het alleen waar het waar
   * is, en noemen het prijsverschil waar dat er is.
   */
  const basisPrijsVerschilt = useMemo(() => {
    const vanMaat = variants.filter(
      (variant) => (variant.size ?? variant.name) === (size ?? sizes[0]) && variant.base,
    );
    const prijzen = new Set(vanMaat.map((variant) => variant.kluspasPrice ?? variant.price));
    return prijzen.size > 1;
  }, [variants, size, sizes]);

  // Vertel het voorraadblok welk exact artikel de klant nu voor zich heeft:
  // dezelfde sku die straks in de winkelwagen belandt. Zonder dit toonde de
  // voorraad de optelsom van alle maten samen — 2,5 L "op voorraad" terwijl
  // alleen de 250 ml ergens lag.
  const { zet: zetGekozenSku } = useGekozenVariant();
  const gekozenSku = wit100 && wit ? wit.sku : activeVariant?.sku ?? product.sku;

  /*
   * Is er nog iets anders te koop op deze pagina?
   *
   * Zo ja, dan is "uitverkocht" een eigenschap van de gekozen maat en niet van
   * het product — en dan hoort het seintje-formulier hier, want StockList
   * toont het alleen bij een product dat overal op is.
   *
   * `wit` is bij een uitverkocht wit-artikel undefined (zie boven), dus de sku
   * komt uit `witVariant`: zonder dat zouden we een melding aanmaken voor het
   * basisartikel dat gewoon op voorraad ligt.
   */
  const andereMaatWelLeverbaar = wit100
    ? activeVariant?.inStock !== false
    : variants.some((variant) => variant !== activeVariant && variant.inStock !== false);
  const uitverkochteSku = wit100
    ? (witVariant?.wit?.sku ?? gekozenSku)
    : (activeVariant?.sku ?? product.sku);

  /*
   * Hoeveel er van dít artikel te koop zijn.
   *
   * Kevin legde er tien in zijn mandje terwijl er acht lagen. De checkout
   * houdt dat inmiddels tegen, maar dat is te laat: dan heb je je bestelling
   * al samengesteld en loop je bij de betaalknop tegen een melding aan.
   *
   * Alle vestigingen bij elkaar, want orders worden met de hand over de
   * winkels verdeeld. Antwoordt de hub niet, dan blijft het maximum open —
   * een storing bij ons mag geen bestellingen tegenhouden van artikelen die
   * er gewoon liggen. De checkout controleert het daarna sowieso nog een keer
   * tegen de dan actuele voorraad.
   */
  const [voorraadMax, setVoorraadMax] = useState<number | null>(null);
  useEffect(() => {
    if (!gekozenSku) return;
    let actief = true;
    setVoorraadMax(null);
    fetch(`/api/voorraad?skus=${encodeURIComponent(gekozenSku)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!actief || !data?.live) return;
        const totaal = (data.stores ?? []).reduce(
          (som: number, rij: { qty?: number }) => som + (Number(rij.qty) || 0),
          0,
        );
        setVoorraadMax(totaal);
      })
      .catch(() => undefined);
    return () => {
      actief = false;
    };
  }, [gekozenSku]);

  // Bovengrens: wat er ligt, anders de oude harde grens van 99.
  const maxAantal = voorraadMax === null ? 99 : Math.max(1, voorraadMax);

  // Wisselt de klant naar een maat waar er minder van zijn, dan zakt het
  // aantal mee. Anders staat er 10 terwijl er 2 kunnen.
  useEffect(() => {
    setQtyState((huidig) => Math.min(huidig, maxAantal));
  }, [maxAantal]);

  useEffect(() => {
    zetGekozenSku(gekozenSku ?? null);
  }, [gekozenSku, zetGekozenSku]);

  // Maat en verpakking als twee keuzes: de unieke maten in de volgorde van de
  // feed (die staat al op grootte), en daarbinnen de verpakkingen.
  const maten = useMemo(() => {
    const gezien: string[] = [];
    for (const variant of variants) {
      const maat = variant.size ?? variant.name;
      if (maat && !gezien.includes(maat)) gezien.push(maat);
    }
    return gezien;
  }, [variants]);

  const actieveMaat = activeVariant?.size ?? activeVariant?.name;
  const verpakkingenVanMaat = variants.filter(
    (variant) => (variant.size ?? variant.name) === actieveMaat,
  );

  // "Kies je inhoud" klopt voor blikken verf, niet voor bouten van 70 mm.
  const maatLabel = variants.some((variant) => /\b(ml|l|liter)\b/i.test(variant.size ?? ""))
    ? "Kies je inhoud"
    : "Kies je maat";
  // Prijs, adviesprijs en Kluspas-prijs horen bij de gekozen maat. Namen we
  // die van het product, dan stond bij 2,5 liter de Kluspas-korting van het
  // blik van 500 ml.
  const unitPrice = wit100 && wit ? wit.price : activeVariant?.price ?? product.price;
  const compareAtPrice =
    wit100 && wit
      ? wit.compareAtPrice
      : activeVariant
        ? activeVariant.compareAtPrice
        : product.compareAtPrice;
  const kluspasPrice =
    wit100 && wit
      ? wit.kluspasPrice
      : activeVariant
        ? activeVariant.kluspasPrice
        : product.kluspasPrice;
  const activeBase = activeVariant?.base;
  const coverage = coveragePerLiter(product);

  const cartKey = useMemo(
    () => `${product.id}:${activeVariant?.id ?? ""}:${wit100 ? "wit" : color?.key ?? ""}`,
    [product.id, activeVariant?.id, color, wit100],
  );

  function handleAdd() {
    if (product.colorMixable && !wit100 && !color) {
      setError("Kies eerst een kleur voor deze mengverf.");
      setVensterOpen(true);
      return;
    }
    setError(null);
    addItem(
      {
        key: cartKey,
        productId: product.id,
        // De sku van de gekozen variant; daarmee checkt de checkout of de
        // artikelen in de afhaalwinkel liggen. Bij 100% wit is dat de sku van
        // het wit-artikel zelf — dan boekt de kassa de juiste voorraad af.
        sku: wit100 && wit ? wit.sku : activeVariant?.sku ?? product.sku,
        slug: product.slug,
        name: product.name,
        image: product.image,
        variantId: wit100 ? witVariant?.id : activeVariant?.id,
        variantName: wit100
          ? `${witVariant?.size ?? witVariant?.name} · 100% Wit`
          : activeBase
            ? `${activeVariant?.size ?? activeVariant?.name} · ${PAINT_BASES[activeBase].label}`
            : activeVariant?.name,
        color: wit100
          ? {
              key: "wit",
              code: "100% Wit",
              name: "100% Wit, direct uit voorraad",
              hex: "#FFFFFF",
            }
          : color
            ? {
                key: color.key,
                code: color.code,
                name: color.name,
                hex: color.hex,
                collection: color.group,
              }
            : undefined,
        unitPrice,
        kluspasUnitPrice: kluspasPrice,
        icon: product.art.icon,
        hue: product.art.hue,
        ...(activeVariant?.pickupOnly ?? product.pickupOnly
          ? { pickupOnly: activeVariant?.pickupOnly ?? product.pickupOnly }
          : {}),
      },
      qty,
    );
    setAdded(true);
    window.setTimeout(() => setAdded(false), 4000);
  }

  return (
    <div className="min-w-0 space-y-5">
      <Price
        price={unitPrice}
        compareAtPrice={compareAtPrice}
        kluspasPrice={kluspasPrice}
        size="lg"
      />

      {basesInPlay ? (
        sizes.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-sm font-bold text-ink">Kies je inhoud</legend>
            <div className="flex flex-wrap gap-2">
              {sizes.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSize(option)}
                  aria-pressed={option === size}
                  className={`rounded-lg border-2 px-4 py-2 text-sm font-bold transition ${
                    option === size
                      ? "border-brand bg-brand-light text-brand"
                      : "border-ink/10 text-ink hover:border-ink/30"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>
        )
      ) : (
        variants.length > 0 && (
          <div className="space-y-4">
            <fieldset>
              <legend className="mb-2 text-sm font-bold text-ink">{maatLabel}</legend>
              <div className="flex flex-wrap gap-2">
                {maten.map((maat) => {
                  // Uitverkochte maten blijven staan en blijven aanklikbaar:
                  // de klant mag zien dat we die maat voeren, en krijgt er dan
                  // een seintje op. Alleen doorstrepen zonder uitleg maakt de
                  // pagina stiller dan nodig.
                  const vanMaat = variants.filter(
                    (variant) => (variant.size ?? variant.name) === maat,
                  );
                  const uitverkocht =
                    vanMaat.length > 0 && vanMaat.every((variant) => variant.inStock === false);
                  return (
                    <button
                      key={maat}
                      type="button"
                      onClick={() => {
                        // Bij het wisselen van maat de eerste verpakking van die
                        // maat kiezen; de vorige bestaat er misschien niet in.
                        const eerste = vanMaat[0];
                        if (eerste) setVariantId(eerste.id);
                      }}
                      aria-pressed={maat === actieveMaat}
                      className={`rounded-lg border-2 px-4 py-2 text-sm font-bold transition ${
                        maat === actieveMaat
                          ? "border-brand bg-brand-light text-brand"
                          : uitverkocht
                            ? "border-ink/10 text-ink-soft hover:border-ink/30"
                            : "border-ink/10 text-ink hover:border-ink/30"
                      }`}
                    >
                      {maat}
                      {uitverkocht && (
                        <span className="ml-1.5 text-xs font-semibold text-ink-soft">
                          uitverkocht
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Bestaat deze maat in meerdere verpakkingen, dan is dat een
                tweede keuze. Anders zou de klant tientallen knoppen krijgen
                waarin maat en aantal door elkaar lopen. */}
            {verpakkingenVanMaat.length > 1 && (
              <fieldset>
                <legend className="mb-2 text-sm font-bold text-ink">Aantal per verpakking</legend>
                <div className="flex flex-wrap gap-2">
                  {/* Net als bij de maten: uitverkocht blijft staan en blijft
                      aanklikbaar (dan krijg je het seintje-formulier), maar het
                      moet er wél op staan. Bij HG Strijkspray staan hier twee
                      keer "500 ml" — twee Tilroy-artikelen met dezelfde naam,
                      waarvan er één op is. Zonder dit woordje klikt de klant op
                      de duurdere en ontdekt hij pas bij de knop dat die niet
                      te koop is. */}
                  {verpakkingenVanMaat.map((variant) => {
                    const op = variant.inStock === false;
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => setVariantId(variant.id)}
                        aria-pressed={variant.id === variantId}
                        className={`rounded-lg border-2 px-4 py-2 text-sm font-bold transition ${
                          variant.id === variantId
                            ? "border-brand bg-brand-light text-brand"
                            : op
                              ? "border-ink/10 text-ink-soft hover:border-ink/30"
                              : "border-ink/10 text-ink hover:border-ink/30"
                        }`}
                      >
                        {variant.packaging ?? variant.name}
                        <span className="ml-2 font-normal text-ink-soft">
                          {euro(variant.price)}
                        </span>
                        {op && (
                          <span className="ml-1.5 text-xs font-semibold text-ink-soft">
                            uitverkocht
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}
          </div>
        )
      )}

      {product.colorMixable && (
        <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-black/5">
          <p className="inline-flex items-center gap-1.5 text-sm font-bold text-ink">
            <Icon name="palette" className="h-4 w-4 text-brand" /> Jouw kleur{" "}
            <span className="font-normal text-ink-soft">
              {basisPrijsVerschilt
                ? "(mengen is gratis; donkere kleuren gaan in een duurdere basis)"
                : "(gratis gemengd door onze verfspecialist)"}
            </span>
          </p>

          {(wit || witGemengd) && (
            /* Wit staat als eigen knop naast de kiezer, niet als kleur erin.
               Bij Sikkens is het een écht artikel met eigen voorraad en vaak
               een lagere prijs; bij de andere merken is het een mengkleur die
               je hier met één klik pakt in plaats van via de waaier. */
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={wit ? wit100 : witGemengdGekozen}
                onClick={() => {
                  if (wit) {
                    setWitGekozen(true);
                    setColor(null);
                  } else if (witGemengd) {
                    setWitGekozen(false);
                    setColor(witGemengd);
                  }
                  setError(null);
                }}
                className={`rounded-lg border-2 px-3 py-2.5 text-left transition ${
                  (wit ? wit100 : witGemengdGekozen)
                    ? "border-brand bg-brand-light"
                    : "border-ink/10 hover:border-brand"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-bold text-ink">
                  <span className="h-4 w-4 shrink-0 rounded-full border border-ink/20 bg-white" aria-hidden />
                  {/* "100% wit" is wit zó uit het blik, ongemengd — daarom is
                      het bij Sikkens een eigen artikel met eigen voorraad en
                      prijs. Wat we bij de andere merken doen is wit mengen in
                      de lichte basis, en dat is iets anders. Het zo noemen was
                      een naamfout van mij; Kevin: "is geen 100% wit, noem het
                      gewoon wit". */}
                  {wit ? "100% Wit" : "Wit"}
                </span>
                {/* Geen prijs in dit blok. De prijs bovenaan volgt de keuze al
                    (zie `unitPrice`), en die staat er mét Kluspas. Zetten we
                    hier de brutoprijs van het witte artikel bij, dan las de
                    klant "€ 20,85" met daaronder "€ 21,95" — alsof wit duurder
                    was dan wat er net boven stond. */}
                <span className="mt-0.5 block text-xs text-ink-soft">
                  {wit ? "direct uit voorraad" : "gratis gemengd"}
                </span>
              </button>
              <button
                type="button"
                aria-pressed={wit ? !wit100 : Boolean(color) && !witGemengdGekozen}
                onClick={() => {
                  setWitGekozen(false);
                  setVensterOpen(true);
                }}
                className={`rounded-lg border-2 px-3 py-2.5 text-left transition ${
                  (wit ? !wit100 : Boolean(color) && !witGemengdGekozen)
                    ? "border-brand bg-brand-light"
                    : "border-ink/10 hover:border-brand"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-bold text-ink">
                  <Icon name="palette" className="h-4 w-4 shrink-0 text-brand" />
                  Andere kleur
                </span>
                <span className="mt-0.5 block text-xs text-ink-soft">
                  {basisPrijsVerschilt ? "prijs volgt de basis" : "gratis gemengd"}
                </span>
              </button>
            </div>
          )}

          {!wit100 &&
            (color ? (
            <div className="mt-3 flex items-center gap-3">
              <span
                className="h-11 w-11 shrink-0 rounded-lg ring-1 ring-black/10"
                style={{ backgroundColor: color.hex }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">
                  {kleurLabel(color).titel}
                </p>
                <p className="truncate text-xs text-ink-soft">{kleurLabel(color).onder}</p>
              </div>
              <button
                type="button"
                onClick={() => setVensterOpen(true)}
                className="shrink-0 rounded-lg border-2 border-ink/10 px-3 py-2 text-sm font-bold text-ink transition hover:border-brand hover:text-brand"
              >
                Wijzig
              </button>
            </div>
            ) : wit || witGemengd ? null : (
            /* Eén duidelijke ingang naar het venster. De hele waaier hier
               uitklappen duwde de bestelknop van het scherm. */
            <button
              type="button"
              onClick={() => setVensterOpen(true)}
              className="mt-3 flex w-full items-center justify-between gap-3 rounded-lg border-2 border-brand bg-white px-4 py-3 text-left font-bold text-brand transition hover:bg-brand-light"
            >
              Kies je kleur
              <Icon name="palette" className="h-5 w-5 shrink-0" />
            </button>
            ))}

          {color && activeBase && (
            <p className="mt-2 text-xs text-ink-soft">
              Wordt gemengd in de{" "}
              <strong className="font-semibold text-ink">
                {PAINT_BASES[activeBase].label.toLowerCase()}
              </strong>{" "}
, dat kiezen wij voor je.
            </p>
          )}
          {!color && !wit100 && basesInPlay && (
            <p className="mt-2 text-xs text-ink-soft">
              De juiste mengbasis kiezen wij automatisch bij jouw kleur.
            </p>
          )}

          <KleurVenster
            open={vensterOpen}
            onClose={() => setVensterOpen(false)}
            initialColors={colors}
            huidige={color}
            onKies={(next) => {
              setColor(next);
              setWitGekozen(false);
              setError(null);
            }}
          />

          {/* Kleurtwijfel is dé reden om níét te bestellen; de tester haalt
              die weg en kost per saldo niets (bedrag terug als voucher).
              Staat de tester in het dashboard uit, dan wijzen we naar de
              waaier in de winkel — geen link naar een pagina die er niet is. */}
          <p className="mt-3 border-t border-black/5 pt-3 text-xs text-ink-soft">
            {testersActief ? (
              <>
                Twijfel je over de kleur?{" "}
                <Link
                  href={
                    color
                      ? `/kleurstalen?kleur=${encodeURIComponent(color.key)}`
                      : "/kleurstalen"
                  }
                  className="font-bold text-brand hover:underline"
                >
                  Bestel eerst een kleurtester ({STAAL_PRIJS_TEKST})
                </Link>{" "}
, het bedrag krijg je terug als voucher bij je verf.
              </>
            ) : (
              <>
                Twijfel je over de kleur? In onze vijf winkels liggen de
                officiële waaiers, en onze verfspecialist denkt gratis met je mee.
              </>
            )}
          </p>
        </div>
      )}

      {coverage && (
        <PaintCalculator
          coveragePerLiter={coverage}
          sizesInLiters={sizesInLiters(product).length > 0 ? sizesInLiters(product) : [1]}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-lg border-2 border-ink/10">
          <button
            type="button"
            aria-label="Aantal verlagen"
            onClick={() => setQtyState((current) => Math.max(1, current - 1))}
            className="px-3 py-2 text-lg font-black text-ink hover:text-brand"
          >
            −
          </button>
          <span className="w-10 text-center font-bold" aria-live="polite">
            {qty}
          </span>
          <button
            type="button"
            aria-label="Aantal verhogen"
            disabled={qty >= maxAantal}
            onClick={() => setQtyState((current) => Math.min(maxAantal, current + 1))}
            className="px-3 py-2 text-lg font-black text-ink hover:text-brand disabled:opacity-30 disabled:hover:text-ink"
          >
            +
          </button>
        </div>
        {/* Zeggen wanneer je aan het plafond zit, en waarom. Een plusknop die
            niets doet zonder uitleg leest als een storing. Pas tonen als het
            bijna raakt: bij tweehonderd op voorraad hoeft niemand dit te
            weten. */}
        {voorraadMax !== null && voorraadMax <= 25 && qty >= maxAantal && (
          <p className="w-full text-sm font-semibold text-ink-soft" aria-live="polite">
            {voorraadMax === 1
              ? "Dit is de laatste die we hebben."
              : `Meer dan ${voorraadMax} hebben we er niet liggen.`}
          </p>
        )}
        {/* Nul-voorraad is niet bestelbaar (beslissing Kevin). De pagina zei
            al "Nu even uitverkocht", maar de knop werkte gewoon door — en de
            checkout rekende af voor iets dat nergens ligt. Dit hangt aan de
            gekozen maat: 250 ml kan op zijn terwijl 2,5 L er staat. */}
        <button
          type="button"
          id="koop-knop"
          onClick={handleAdd}
          disabled={maatUitverkocht}
          className="btn btn-primary flex-1 scroll-mt-32 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
        >
          {maatUitverkocht ? "Tijdelijk uitverkocht" : "In winkelwagen"}
        </button>
      </div>

      {/*
        Uitverkochte maat: bied hier het seintje aan.

        Kevin: "geen out of stock notificatie". Het aanmeldformulier bestond al,
        maar hing onder het voorraadblok en verscheen alleen als het HÉLE
        product overal op was. Koos je een verpakking die op is terwijl een
        andere er nog ligt, dan stond er een uitgeschakelde knop en verder
        niets — de klant heeft dan geen enkele volgende stap.

        Alleen bij dit maat-geval, want bij een volledig uitverkocht product
        toont StockList hem al; twee formulieren op één pagina is erger dan
        geen.
      */}
      {maatUitverkocht && andereMaatWelLeverbaar && (
        <Voorraadmelding
          sku={uitverkochteSku}
          slug={product.slug}
          naam={product.name}
          maat={actieveMaat}
        />
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-brand-light px-4 py-3 text-sm font-semibold text-brand-dark">
          {error}
        </p>
      )}
      {added && (
        <p role="status" className="rounded-lg bg-green-50 px-4 py-3 text-sm font-semibold text-green-800 ring-1 ring-green-200">
          Toegevoegd aan je winkelwagen ·{" "}
          <Link href="/winkelwagen" className="underline">
            Bekijk winkelwagen
          </Link>
        </p>
      )}

      {/*
        Hier hoort te staan waarom je dit bij óns koopt en niet bij de
        Gamma of bol. Bezorgtarieven, betaalmethodes en een toeslag voor
        same-day zijn dat niet: die heeft iedereen, en een toeslag is geen
        voordeel maar een kostenpost. Die staan nu waar ze horen — bij de
        levertijd en in de checkout.

        Wat wél alleen van ons is: we mengen gratis aan, er staat een
        verfspecialist achter de balie, en je kunt in vijf winkels terecht om
        het op te halen, te vragen of terug te brengen.
      */}
      <ul className="space-y-1.5 border-t border-ink/10 pt-4 text-sm text-ink-soft">
        {[
          product.colorMixable
            ? "Gratis aangemengd in elke kleur, ruim 18.000 kleuren, door onze verfspecialist"
            : "Verf, gereedschap en bevestiging onder één dak, je klus in één bestelling",
          "Advies van een verfspecialist, en gratis afhalen in onze 5 winkels",
          "14 dagen bedenktijd, gratis terug te brengen naar elke winkel",
        ].map((usp) => (
          <li key={usp} className="flex items-start gap-2">
            <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-green-700" strokeWidth={3} />
            {usp}
          </li>
        ))}
      </ul>
    </div>
  );
}
