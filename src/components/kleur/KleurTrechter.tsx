"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useCart } from "@/components/cart/CartProvider";
import { ColorPicker } from "@/components/ColorPicker";
import { Icon } from "@/components/icons";
import { ProductArt } from "@/components/ProductArt";
import { euro } from "@/lib/format";
import { KLEURKLUSSEN, verfVoorKlus, type Kleurklus } from "@/lib/kleurklussen";
import { baseForColor, PAINT_BASES, pickVariant, sizesOf } from "@/lib/paint-bases";
import type { PaintColor, Product } from "@/lib/types";

type Stap = 1 | 2 | 3 | 4;

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
  const [stap, setStap] = useState<Stap>(1);
  const [kleur, setKleur] = useState<PaintColor | null>(null);
  const [klus, setKlus] = useState<Kleurklus | null>(null);
  const [verf, setVerf] = useState<Product | null>(null);
  const [maat, setMaat] = useState<string | undefined>();
  const [toegevoegd, setToegevoegd] = useState<string[]>([]);

  const verven = useMemo(
    () => (klus ? verfVoorKlus(producten, klus).slice(0, 8) : []),
    [klus, producten],
  );

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
      const match = producten
        .filter(
          (product) =>
            !product.colorMixable &&
            product.inStock !== false &&
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
    });
    setToegevoegd((huidig) => [...huidig, product.id]);
  }

  const kleurNaam = kleur ? [kleur.code, kleur.name].filter(Boolean).join(" · ") : "";

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
          <h2 className="mb-3 text-xl font-black uppercase text-ink">Kies je kleur</h2>
          <ColorPicker
            initialColors={initialColors}
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
          {verven.length === 0 ? (
            <p className="card mt-4 p-6 text-ink-soft">
              Voor deze klus staat geen mengverf online. Loop even binnen — in de
              winkel mengen we vrijwel elke kleur.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {verven.map((product) => {
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
                          <span className="mt-1 block font-black text-brand">
                            {euro(product.kluspasPrice ?? product.price)}
                            {product.kluspasPrice && (
                              <span className="ml-1 text-[10px] font-bold uppercase">Kluspas</span>
                            )}
                          </span>
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
