"use client";

import Link from "next/link";
import { useState } from "react";

import { useCart } from "@/components/cart/CartProvider";
import { Icon } from "@/components/icons";
import { ProductArt } from "@/components/ProductArt";
import { euro } from "@/lib/format";

/**
 * De klusadviseur op de site.
 *
 * De klant beschrijft de klus in eigen woorden; wij antwoorden met het
 * benodigde aantal liters, de werkvolgorde en een boodschappenlijstje dat in
 * één klik in het mandje kan.
 */

interface AdviesProductDto {
  rol: "verf" | "grondverf" | "gereedschap";
  waarom: string;
  aantal: number;
  inhoud?: string;
  product: {
    id: string;
    slug: string;
    sku: string;
    name: string;
    brand: string;
    price: number;
    kluspasPrice?: number;
    image?: string;
    colorMixable?: boolean;
    art: { icon: string; hue: number };
  };
}

interface AdviesDto {
  samenvatting: string;
  oppervlakM2: number | null;
  berekening: string | null;
  lagen: number;
  litersNodig: number | null;
  grondverfNodig: boolean;
  grondverfReden: string | null;
  stappen: string[];
  producten: AdviesProductDto[];
  aannames: string[];
}

const VOORBEELDEN = [
  "Slaapkamer van 4 bij 3 meter, van donkerblauw naar wit",
  "Twee binnendeuren opnieuw in de lak",
  "Houten schutting van 20 m² behandelen",
  "Radiator in de woonkamer overschilderen",
];

const ROL_LABEL: Record<AdviesProductDto["rol"], string> = {
  verf: "Verf",
  grondverf: "Grondverf",
  gereedschap: "Gereedschap",
};

export function Klusadviseur() {
  const { addItem } = useCart();
  const [vraag, setVraag] = useState("");
  const [bezig, setBezig] = useState(false);
  const [advies, setAdvies] = useState<AdviesDto | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [toegevoegd, setToegevoegd] = useState<string[]>([]);

  async function vraagAdvies(tekst: string) {
    if (tekst.trim().length < 5 || bezig) return;
    setBezig(true);
    setFout(null);
    setToegevoegd([]);
    try {
      const response = await fetch("/api/klusadvies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vraag: tekst }),
      });
      const data = (await response.json()) as { advies?: AdviesDto; error?: string };
      if (!response.ok || !data.advies) {
        setFout(data.error ?? "Er ging iets mis. Probeer het zo nog eens.");
        setAdvies(null);
      } else {
        setAdvies(data.advies);
      }
    } catch {
      setFout("We konden het advies niet ophalen. Controleer je verbinding.");
      setAdvies(null);
    } finally {
      setBezig(false);
    }
  }

  function leginMandje(entry: AdviesProductDto) {
    addItem(
      {
        key: `${entry.product.id}::`,
        productId: entry.product.id,
        sku: entry.product.sku,
        slug: entry.product.slug,
        name: entry.product.name,
        unitPrice: entry.product.price,
        kluspasUnitPrice: entry.product.kluspasPrice,
        icon: entry.product.art.icon,
        hue: entry.product.art.hue,
        image: entry.product.image,
      },
      entry.aantal,
    );
    setToegevoegd((huidig) => [...huidig, entry.product.id]);
  }

  function allesInMandje() {
    if (!advies) return;
    for (const entry of advies.producten) {
      if (!toegevoegd.includes(entry.product.id)) leginMandje(entry);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void vraagAdvies(vraag);
        }}
        className="rounded-2xl border-2 border-ink/10 bg-white p-4 sm:p-6"
      >
        <label htmlFor="klusvraag" className="block text-sm font-bold text-ink">
          Wat ga je doen?
        </label>
        <textarea
          id="klusvraag"
          value={vraag}
          onChange={(event) => setVraag(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void vraagAdvies(vraag);
            }
          }}
          rows={3}
          maxLength={600}
          placeholder="Bijvoorbeeld: ik wil mijn slaapkamer van 4 bij 3 meter van donkerblauw naar wit schilderen"
          className="mt-2 w-full resize-none rounded-xl border-2 border-ink/10 px-4 py-3 text-ink outline-none transition focus:border-brand"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={bezig || vraag.trim().length < 5}
            className="rounded-xl bg-brand px-6 py-3 font-black uppercase text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            {bezig ? "Even rekenen…" : "Bereken mijn klus"}
          </button>
          <p className="text-sm text-ink-soft">Gratis en vrijblijvend.</p>
        </div>
      </form>

      {!advies && !bezig && (
        <div className="flex flex-wrap gap-2">
          {VOORBEELDEN.map((voorbeeld) => (
            <button
              key={voorbeeld}
              type="button"
              onClick={() => {
                setVraag(voorbeeld);
                void vraagAdvies(voorbeeld);
              }}
              className="rounded-full border-2 border-ink/10 px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand"
            >
              {voorbeeld}
            </button>
          ))}
        </div>
      )}

      {fout && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 font-semibold text-red-700">
          {fout}
        </p>
      )}

      {advies && (
        <div className="space-y-6">
          <section className="rounded-2xl border-2 border-brand/20 bg-brand/5 p-4 sm:p-6">
            <h2 className="text-lg font-black uppercase text-ink">Ons advies</h2>
            <p className="mt-2 text-ink">{advies.samenvatting}</p>

            {(advies.litersNodig || advies.oppervlakM2) && (
              <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                {advies.oppervlakM2 !== null && (
                  <div className="rounded-xl bg-white p-3">
                    <dt className="text-xs font-bold uppercase text-ink-soft">Oppervlak</dt>
                    <dd className="text-xl font-black text-ink">
                      {advies.oppervlakM2.toLocaleString("nl-NL", { maximumFractionDigits: 1 })} m²
                    </dd>
                  </div>
                )}
                <div className="rounded-xl bg-white p-3">
                  <dt className="text-xs font-bold uppercase text-ink-soft">Lagen</dt>
                  <dd className="text-xl font-black text-ink">{advies.lagen}</dd>
                </div>
                {advies.litersNodig !== null && (
                  <div className="rounded-xl bg-white p-3">
                    <dt className="text-xs font-bold uppercase text-ink-soft">Verf nodig</dt>
                    <dd className="text-xl font-black text-brand">
                      {advies.litersNodig.toLocaleString("nl-NL", { maximumFractionDigits: 1 })} liter
                    </dd>
                  </div>
                )}
              </dl>
            )}

            {advies.berekening && (
              <p className="mt-3 text-sm text-ink-soft">Zo rekenen wij: {advies.berekening}.</p>
            )}

            {advies.grondverfNodig && advies.grondverfReden && (
              <p className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                <Icon name="bulb" className="h-5 w-5 shrink-0" />
                <span>
                  <strong>Grondverf nodig.</strong> {advies.grondverfReden}
                </span>
              </p>
            )}
          </section>

          {advies.producten.length > 0 && (
            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-black uppercase text-ink">Dit heb je nodig</h2>
                <button
                  type="button"
                  onClick={allesInMandje}
                  className="rounded-xl border-2 border-brand px-4 py-2 text-sm font-black uppercase text-brand transition hover:bg-brand hover:text-white"
                >
                  Alles in mijn mandje
                </button>
              </div>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {advies.producten.map((entry) => {
                  const isToegevoegd = toegevoegd.includes(entry.product.id);
                  return (
                    <li
                      key={entry.product.id}
                      className="flex gap-4 rounded-2xl border-2 border-ink/10 bg-white p-3"
                    >
                      <Link
                        href={`/product/${entry.product.slug}`}
                        className="w-20 shrink-0 overflow-hidden rounded-xl"
                      >
                        <ProductArt
                          icon={entry.product.art.icon}
                          hue={entry.product.art.hue}
                          image={entry.product.image}
                          size="sm"
                          label={entry.product.name}
                        />
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-xs font-bold uppercase text-brand">
                          {ROL_LABEL[entry.rol]}
                          {entry.aantal > 1 &&
                            ` · ${entry.aantal}×${entry.inhoud ? ` ${entry.inhoud}` : ""}`}
                        </span>
                        <Link
                          href={`/product/${entry.product.slug}`}
                          className="line-clamp-2 font-bold text-ink hover:text-brand"
                        >
                          {entry.product.name}
                        </Link>
                        <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">{entry.waarom}</p>
                        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                          <span className="font-black text-ink">{euro(entry.product.price)}</span>
                          <button
                            type="button"
                            onClick={() => leginMandje(entry)}
                            disabled={isToegevoegd}
                            className="rounded-lg border-2 border-ink/10 px-3 py-1.5 text-sm font-bold text-ink transition hover:border-brand hover:text-brand disabled:border-green-600/30 disabled:text-green-700"
                          >
                            {isToegevoegd ? "In mandje" : "+ Toevoegen"}
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {advies.producten.some((entry) => entry.product.colorMixable) && (
                <p className="mt-3 text-sm text-ink-soft">
                  De verf in dit lijstje mengen wij gratis in elke kleur.{" "}
                  <Link href="/kleurkiezer" className="font-bold text-brand hover:underline">
                    Kies je kleur in de kleurkiezer
                  </Link>
                  .
                </p>
              )}
            </section>
          )}

          {advies.stappen.length > 0 && (
            <section className="rounded-2xl border-2 border-ink/10 bg-white p-4 sm:p-6">
              <h2 className="text-lg font-black uppercase text-ink">Zo pak je het aan</h2>
              <ol className="mt-3 space-y-2">
                {advies.stappen.map((stap, index) => (
                  <li key={stap} className="flex gap-3 text-ink">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-black text-white">
                      {index + 1}
                    </span>
                    <span>{stap}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {advies.aannames.length > 0 && (
            <section className="rounded-2xl bg-ink/5 p-4 text-sm text-ink-soft">
              <h2 className="font-bold text-ink">Waar we van uitgaan</h2>
              <ul className="mt-2 list-inside list-disc space-y-1">
                {advies.aannames.map((aanname) => (
                  <li key={aanname}>{aanname}</li>
                ))}
              </ul>
              <p className="mt-3">
                Klopt er iets niet? Pas je vraag aan en reken opnieuw, of{" "}
                <Link href="/klantenservice" className="font-bold text-brand hover:underline">
                  vraag het onze mensen in de winkel
                </Link>
                .
              </p>
            </section>
          )}

          <button
            type="button"
            onClick={() => {
              setAdvies(null);
              setVraag("");
              setToegevoegd([]);
            }}
            className="text-sm font-bold text-ink-soft underline hover:text-brand"
          >
            Nieuwe klus berekenen
          </button>
        </div>
      )}
    </div>
  );
}
