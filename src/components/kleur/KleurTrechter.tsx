"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { useCart } from "@/components/cart/CartProvider";
import { ColorPicker } from "@/components/ColorPicker";
import { Icon } from "@/components/icons";
import { ProductArt } from "@/components/ProductArt";
import { kleurLabel } from "@/components/kleur/waaier";
import { euro } from "@/lib/format";
import { KLEURKLUSSEN, verfVoorKlus, type Kleurklus } from "@/lib/kleurklussen";
import { baseForColor, PAINT_BASES, pickVariant, sizesOf } from "@/lib/paint-bases";
import { berekenVoorKlus, stapelTekst } from "@/lib/verfberekening";
import type { PaintColor, Product } from "@/lib/types";

type Stap = 1 | 2 | 3 | 4;

/**
 * Snelknoppen voor het oppervlak, per soort klus.
 *
 * Kevin: bij "hout binnen" bood ik slaapkamer 40 m² en woonkamer 70 m² aan,
 * terwijl je daar deuren en kozijnen verft. Een knop die niet over jouw klus
 * gaat, is een knop die je niet gebruikt — en dan blijft het veld leeg en
 * rekent de site niets uit. De maten zijn vuistregels uit de winkel: een
 * binnendeur is met kozijn en aan twee kanten zo'n 4 m².
 */
const SNELMATEN: Record<string, { label: string; waarde: string }[]> = {
  binnenmuur: [
    { label: "Slaapkamer ±40 m²", waarde: "40" },
    { label: "Woonkamer ±70 m²", waarde: "70" },
    { label: "Eén muur ±12 m²", waarde: "12" },
  ],
  plafond: [
    { label: "Klein plafond ±12 m²", waarde: "12" },
    { label: "Woonkamer ±30 m²", waarde: "30" },
    { label: "Hele verdieping ±60 m²", waarde: "60" },
  ],
  "hout-binnen": [
    { label: "1 deur ±4 m²", waarde: "4" },
    { label: "Deur + kozijn ±6 m²", waarde: "6" },
    { label: "Trap ±15 m²", waarde: "15" },
  ],
  "hout-buiten": [
    { label: "1 kozijn ±3 m²", waarde: "3" },
    { label: "Alle kozijnen ±25 m²", waarde: "25" },
    { label: "Schutting ±40 m²", waarde: "40" },
  ],
  gevel: [
    { label: "Eén gevel ±35 m²", waarde: "35" },
    { label: "Voor- en achtergevel ±70 m²", waarde: "70" },
    { label: "Hele woning ±140 m²", waarde: "140" },
  ],
  vloer: [
    { label: "Kamer ±20 m²", waarde: "20" },
    { label: "Garage ±35 m²", waarde: "35" },
    { label: "Hal ±8 m²", waarde: "8" },
  ],
  metaal: [
    { label: "Radiator ±3 m²", waarde: "3" },
    { label: "Hekwerk ±15 m²", waarde: "15" },
    { label: "Garagedeur ±8 m²", waarde: "8" },
  ],
};

const STANDAARD_SNELMATEN = [
  { label: "Klein ±10 m²", waarde: "10" },
  { label: "Gemiddeld ±40 m²", waarde: "40" },
  { label: "Groot ±70 m²", waarde: "70" },
];

const STAPPEN: { nummer: Stap; label: string }[] = [
  { nummer: 1, label: "Kleur" },
  { nummer: 2, label: "Klus" },
  { nummer: 3, label: "Verf" },
  { nummer: 4, label: "Erbij" },
];

/**
 * Kleurkiezer als trechter.
 *
 * Eerst de kleur, dan wat je ermee gaat doen, dan de verf die daarbij hoort,
 * dan wat je verder nodig hebt. Een kale kleurenlijst laat de klant met de
 * moeilijkste vraag zitten — welke verf hoort hierbij? — en die vraag
 * beantwoordt de winkel aan de balie ook.
 *
 * De mengbasis kiezen we zelf op de helderheid van de kleur: een donkere
 * tint kan niet in een lichte basis, en die fout mag een klant niet kunnen
 * maken.
 */
export function KleurTrechter({
  initialColors,
  producten,
}: {
  initialColors: PaintColor[];
  producten: Product[];
}) {
  const { addItem } = useCart();
  // De waaierlijst onderaan deze pagina linkt naar ?waaier=<id>. Die waarde
  // komt dus van buiten; de kiezer controleert hem tegen de echte lijst
  // voordat hij hem gebruikt.
  const gevraagdeWaaier = useSearchParams().get("waaier");
  const [stap, setStap] = useState<Stap>(1);
  const [kleur, setKleur] = useState<PaintColor | null>(null);
  const [klus, setKlus] = useState<Kleurklus | null>(null);
  const [verf, setVerf] = useState<Product | null>(null);
  const [maat, setMaat] = useState<string | undefined>();
  const [toegevoegd, setToegevoegd] = useState<string[]>([]);

  // Hoeveel ga je verven? Leeg betekent: nog niet ingevuld, dan tonen we de
  // blikprijzen zoals voorheen.
  const [oppervlak, setOppervlak] = useState("");
  const [lagen, setLagen] = useState(2);

  const klusInvoer = useMemo(() => {
    const m2 = Number(oppervlak.replace(",", "."));
    return Number.isFinite(m2) && m2 > 0 ? { vierkanteMeter: m2, lagen } : null;
  }, [oppervlak, lagen]);

  /*
   * De verflijst, en bij een ingevuld oppervlak wat de klus per verf kost.
   *
   * Zonder die berekening stonden € 12,54 (1 liter) en € 52,30 (5 liter)
   * onder elkaar alsof je ze kon vergelijken; de goedkoopste regel was dan
   * gewoon het kleinste blik. Met een oppervlak sorteren we op wat de muur
   * kost — en dan blijkt de duurdere verf die verder reikt geregeld
   * voordeliger.
   */
  const verven = useMemo(() => {
    const lijst = klus ? verfVoorKlus(producten, klus).slice(0, 8) : [];
    const metBerekening = lijst.map((product) => ({
      product,
      berekening: klusInvoer ? berekenVoorKlus(product, klusInvoer) : null,
    }));
    if (!klusInvoer) return metBerekening;
    return [...metBerekening].sort((a, b) => {
      // Verf zonder berekening (geen bruikbare blikmaten) achteraan.
      if (!a.berekening) return 1;
      if (!b.berekening) return -1;
      return a.berekening.totaal - b.berekening.totaal;
    });
  }, [klus, producten, klusInvoer]);

  const maten = verf ? sizesOf(verf) : [];
  const variant = verf ? pickVariant(verf, maat ?? maten[0], kleur) : undefined;
  const basis = kleur ? baseForColor(kleur.hex) : null;

  // Toebehoren bij deze klus: geen mengverf, wel iets om mee te werken.
  const toebehoren = useMemo(() => {
    if (!klus) return [];
    const termen: Record<string, string[]> = {
      binnenmuur: ["verfroller", "verfbak", "afplaktape", "afdekfolie"],
      plafond: ["verfroller", "verlengsteel", "afdekfolie"],
      "hout-binnen": ["lakkwast", "schuurpapier", "afplaktape", "lakroller"],
      "hout-buiten": ["kwast", "schuurpapier", "afplaktape"],
      gevel: ["blokkwast", "verfroller", "afdekfolie"],
      vloer: ["verfroller", "verlengsteel", "ontvetter"],
      metaal: ["kwast", "schuurpapier", "staalborstel"],
    };
    const lijst = termen[klus.id] ?? ["kwast", "verfroller", "afplaktape"];
    const gekozen: Product[] = [];
    for (const term of lijst) {
      // Mét foto: een bijverkoopkaartje met een grijs plaatje verkoopt niets
      // en laat de rij er kapot uitzien. De andere bijverkooplijsten
      // (winkelwagen, productpagina) eisen dat al; hier ontbrak het.
      const match = producten
        .filter(
          (product) =>
            !product.colorMixable &&
            product.inStock !== false &&
            Boolean(product.image) &&
            !gekozen.some((entry) => entry.id === product.id) &&
            product.name.toLowerCase().includes(term),
        )
        .sort((a, b) => a.price - b.price)[0];
      if (match) gekozen.push(match);
    }
    return gekozen.slice(0, 4);
  }, [klus, producten]);

  function legInMandje(product: Product, variantId?: string) {
    const gekozenVariant = product.variants?.find((entry) => entry.id === variantId);
    addItem({
      key: `${product.id}:${gekozenVariant?.id ?? ""}:${kleur?.key ?? ""}`,
      productId: product.id,
      sku: gekozenVariant?.sku ?? product.sku,
      slug: product.slug,
      name: product.name,
      image: product.image,
      variantId: gekozenVariant?.id,
      variantName: gekozenVariant
        ? gekozenVariant.base
          ? `${gekozenVariant.size ?? gekozenVariant.name} · ${PAINT_BASES[gekozenVariant.base].label}`
          : gekozenVariant.name
        : undefined,
      ...(product.colorMixable && kleur
        ? {
            color: {
              key: kleur.key,
              code: kleur.code,
              name: kleur.name,
              hex: kleur.hex,
              collection: kleur.group,
            },
          }
        : {}),
      unitPrice: gekozenVariant?.price ?? product.price,
      kluspasUnitPrice: product.kluspasPrice,
      icon: product.art.icon,
      hue: product.art.hue,
      pickupOnly: gekozenVariant?.pickupOnly ?? product.pickupOnly,
    });
    setToegevoegd((huidig) => [...huidig, product.id]);
  }

  const etiket = kleur ? kleurLabel(kleur) : null;
  const kleurNaam = etiket?.titel ?? "";

  return (
    <div className="space-y-6">
      {/* Stappenbalk: laat zien waar je bent en waar je terug kunt. */}
      <ol className="flex flex-wrap gap-2">
        {STAPPEN.map((entry) => {
          const bereikbaar =
            entry.nummer === 1 ||
            (entry.nummer === 2 && kleur) ||
            (entry.nummer === 3 && kleur && klus) ||
            (entry.nummer === 4 && kleur && klus && verf);
          const actief = stap === entry.nummer;
          const gedaan = stap > entry.nummer;
          return (
            <li key={entry.nummer}>
              <button
                type="button"
                disabled={!bereikbaar}
                onClick={() => bereikbaar && setStap(entry.nummer)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${
                  actief
                    ? "bg-brand text-white"
                    : gedaan
                      ? "bg-brand-light text-brand hover:bg-brand hover:text-white"
                      : "bg-ink/5 text-ink-soft"
                } disabled:cursor-not-allowed`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                    actief ? "bg-white/20" : gedaan ? "bg-brand text-white" : "bg-ink/10"
                  }`}
                >
                  {gedaan ? <Icon name="check" className="h-3 w-3" strokeWidth={3} /> : entry.nummer}
                </span>
                {entry.label}
              </button>
            </li>
          );
        })}
      </ol>

      {/* Wat er tot nu toe gekozen is, altijd zichtbaar. */}
      {(kleur || klus) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-black/5">
          {kleur && (
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
              <span
                className="h-6 w-6 rounded-md ring-1 ring-black/10"
                style={{ backgroundColor: kleur.hex }}
                aria-hidden
              />
              {kleurNaam}
              {etiket?.onder && (
                <span className="text-xs font-normal text-ink-soft">{etiket.onder}</span>
              )}
              {basis && (
                <span className="text-xs font-normal text-ink-soft">
                  ({PAINT_BASES[basis].label.toLowerCase()})
                </span>
              )}
            </span>
          )}
          {klus && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Icon name={klus.icon} className="h-4 w-4 text-brand" />
              {klus.label}
            </span>
          )}
          {verf && (
            <span className="text-sm font-semibold text-ink">
              {verf.name}
              {variant ? ` · ${variant.size ?? variant.name}` : ""}
            </span>
          )}
        </div>
      )}

      {/* ── Stap 1: kleur ───────────────────────────────────────── */}
      {stap === 1 && (
        <section>
          <h2 className="text-xl font-black uppercase text-ink">Kies je kleur</h2>
          <p className="mb-3 mt-1 text-ink-soft">
            Wij mengen je verf exact op deze kleur aan, gratis.
          </p>
          <ColorPicker
            initialColors={initialColors}
            waaier={gevraagdeWaaier}
            value={kleur?.key ?? null}
            onChange={(gekozen) => {
              setKleur(gekozen);
              setStap(2);
            }}
          />
        </section>
      )}

      {/* ── Stap 2: klus ────────────────────────────────────────── */}
      {stap === 2 && kleur && (
        <section>
          <h2 className="text-xl font-black uppercase text-ink">Wat ga je verven?</h2>
          <p className="mt-1 text-ink-soft">
            Zo weten we welke verf bij je klus hoort — en welke basis we voor
            {" "}
            {kleurNaam} moeten gebruiken.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {KLEURKLUSSEN.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => {
                    setKlus(entry);
                    setVerf(null);
                    setMaat(undefined);
                    setStap(3);
                  }}
                  className="card flex w-full items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-light text-brand">
                    <Icon name={entry.icon} className="h-6 w-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-black text-ink">{entry.label}</span>
                    <span className="block text-sm text-ink-soft">{entry.toelichting}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Stap 3: verf ────────────────────────────────────────── */}
      {stap === 3 && kleur && klus && (
        <section>
          <h2 className="text-xl font-black uppercase text-ink">Kies je verf</h2>
          <p className="mt-1 text-ink-soft">
            Deze verf mengen wij gratis in {kleurNaam}
            {basis ? `, in de ${PAINT_BASES[basis].label.toLowerCase()}` : ""}.
          </p>

          {/*
            Eén vraag, want meer vragen haakt af. Met het oppervlak erbij
            kunnen we per verf uitrekenen wat de klus kost in plaats van wat
            een willekeurig blik kost — en dat is het enige getal waarop je
            twee verven eerlijk vergelijkt.
          */}
          <div className="card mt-4 p-4">
            <label htmlFor="oppervlak" className="block font-black text-ink">
              Hoeveel m² ga je verven?
            </label>
            <p className="mt-0.5 text-sm text-ink-soft">
              Dan rekenen we per verf uit hoeveel je nodig hebt en wat het kost.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                id="oppervlak"
                type="number"
                inputMode="decimal"
                min="1"
                max="2000"
                value={oppervlak}
                onChange={(event) => setOppervlak(event.target.value)}
                placeholder="bijv. 40"
                className="input w-28"
              />
              <span className="text-sm font-semibold text-ink-soft">m²</span>
              {(SNELMATEN[klus.id] ?? STANDAARD_SNELMATEN).map((snel) => (
                <button
                  key={snel.waarde}
                  type="button"
                  onClick={() => setOppervlak(snel.waarde)}
                  className={`rounded-full border-2 px-3 py-1.5 text-sm font-bold transition ${
                    oppervlak === snel.waarde
                      ? "border-brand bg-brand text-white"
                      : "border-ink/10 text-ink hover:border-brand hover:text-brand"
                  }`}
                >
                  {snel.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
              <span>Aantal lagen:</span>
              {[1, 2, 3].map((aantal) => (
                <button
                  key={aantal}
                  type="button"
                  onClick={() => setLagen(aantal)}
                  aria-pressed={lagen === aantal}
                  className={`rounded-lg border-2 px-2.5 py-1 font-bold transition ${
                    lagen === aantal
                      ? "border-brand text-brand"
                      : "border-ink/10 text-ink hover:border-ink/30"
                  }`}
                >
                  {aantal}
                </button>
              ))}
              <span className="text-xs">Twee lagen is gebruikelijk bij dekkend werk.</span>
            </div>
          </div>
          {verven.length === 0 ? (
            <p className="card mt-4 p-6 text-ink-soft">
              Voor deze klus staat geen mengverf online. Loop even binnen — in de
              winkel mengen we vrijwel elke kleur.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {verven.map(({ product, berekening }) => {
                const gekozen = verf?.id === product.id;
                const productMaten = sizesOf(product);
                return (
                  <li key={product.id}>
                    <div
                      className={`card overflow-hidden transition ${
                        gekozen ? "ring-2 ring-brand" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setVerf(product);
                          setMaat(productMaten[0]);
                        }}
                        className="flex w-full items-center gap-3 p-3 text-left"
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
                          <span className="block font-bold text-ink">{product.name}</span>
                          <span className="block text-sm text-ink-soft">{product.brand}</span>
                          {berekening ? (
                            <>
                              <span className="mt-1 block font-black text-brand">
                                {euro(berekening.totaal)}
                                <span className="ml-1.5 text-xs font-bold text-ink-soft">
                                  voor jouw {oppervlak} m²
                                </span>
                              </span>
                              <span className="block text-sm text-ink-soft">
                                {stapelTekst(berekening.blikken)} ·{" "}
                                {euro(berekening.perM2)} per m²
                              </span>
                              <span className="block text-xs text-ink-soft">
                                Je hebt {berekening.benodigdeLiters.toLocaleString("nl-NL")} liter
                                nodig
                                {berekening.rendementBron === "opgave"
                                  ? ` (${berekening.rendement} m² per liter volgens de fabrikant)`
                                  : " (vuistregel; de fabrikant geeft geen rendement op)"}
                              </span>
                            </>
                          ) : (
                            <span className="mt-1 block font-black text-brand">
                              {euro(product.kluspasPrice ?? product.price)}
                              {product.kluspasPrice && (
                                <span className="ml-1 text-[10px] font-bold uppercase">Kluspas</span>
                              )}
                            </span>
                          )}
                        </span>
                      </button>

                      {gekozen && productMaten.length > 0 && (
                        <div className="border-t border-ink/10 p-3">
                          <p className="mb-2 text-xs font-black uppercase text-ink-soft">
                            Welke inhoud?
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {productMaten.map((optie) => (
                              <button
                                key={optie}
                                type="button"
                                onClick={() => setMaat(optie)}
                                aria-pressed={optie === (maat ?? productMaten[0])}
                                className={`rounded-lg border-2 px-3 py-1.5 text-sm font-bold transition ${
                                  optie === (maat ?? productMaten[0])
                                    ? "border-brand bg-brand-light text-brand"
                                    : "border-ink/10 text-ink hover:border-ink/30"
                                }`}
                              >
                                {optie}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              legInMandje(product, variant?.id);
                              setStap(4);
                            }}
                            className="btn btn-primary mt-3 w-full py-2 text-sm"
                          >
                            In winkelwagen — {euro(variant?.price ?? product.price)}
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* ── Stap 4: toebehoren ──────────────────────────────────── */}
      {stap === 4 && verf && (
        <section>
          <h2 className="text-xl font-black uppercase text-ink">Dit heb je er ook bij nodig</h2>
          <p className="mt-1 text-ink-soft">
            Zo heb je alles in huis om {klus?.label.toLowerCase()} in één keer goed te doen.
          </p>
          {toebehoren.length > 0 && (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {toebehoren.map((product) => {
                const isToegevoegd = toegevoegd.includes(product.id);
                return (
                  <li
                    key={product.id}
                    className="card flex items-center gap-3 p-3"
                  >
                    <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-1 ring-black/5">
                      <ProductArt
                        icon={product.art.icon}
                        hue={product.art.hue}
                        image={product.image}
                        size="sm"
                        label={product.name}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 block text-sm font-bold text-ink">
                        {product.name}
                      </span>
                      <span className="block font-black text-brand">
                        {euro(product.kluspasPrice ?? product.price)}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => legInMandje(product)}
                      disabled={isToegevoegd}
                      className="shrink-0 rounded-lg border-2 border-ink/10 px-3 py-1.5 text-sm font-bold text-ink transition hover:border-brand hover:text-brand disabled:border-green-600/30 disabled:text-green-700"
                    >
                      {isToegevoegd ? "In mandje" : "+ Toevoegen"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/winkelwagen" className="btn btn-primary">
              Naar de winkelwagen →
            </Link>
            <button
              type="button"
              onClick={() => {
                setStap(1);
                setKleur(null);
                setKlus(null);
                setVerf(null);
                setMaat(undefined);
                setToegevoegd([]);
              }}
              className="btn border-2 border-ink/10 bg-white text-ink hover:border-brand hover:text-brand"
            >
              Nog een kleur kiezen
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
