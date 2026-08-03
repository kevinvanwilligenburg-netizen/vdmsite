"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { WaaierOverzichtItem } from "@/lib/colors";

/**
 * Alle kleurwaaiers, bladerbaar.
 *
 * Eén platte lijst van ~150 collecties op grootte was niet te overzien; dit
 * is het overzicht zoals Klus=r het bouwde, geport naar onze eigen stack
 * (geen dialoog, geen extra pakketten — het is hier een paginadeel):
 * alfabetisch gegroepeerd met plakkende letterkoppen, een A–Z-balk om te
 * springen, zoeken op naam, en per waaier zes stalen — een waaier herken je
 * eerder aan zijn kleuren dan aan zijn naam.
 *
 * Twee lessen van hun kant zitten erin verwerkt: springen gaat met
 * scrollIntoView + scroll-margin (offsetTop rekent vanaf de verkeerde
 * voorouder), en zonder smooth-animatie (die wordt niet overal uitgevoerd,
 * en bij een letterbalk wil je er meteen zijn).
 *
 * Populair en RAL staan vast bovenaan — dat zijn de waaiers waar klanten
 * voor komen; de rest is naslagwerk.
 */
const VOOROP = new Set(["populair", "ral"]);

export function Waaiers({ collections }: { collections: WaaierOverzichtItem[] }) {
  const [zoekterm, setZoekterm] = useState("");

  const { voorop, groepen, letters, aantalWaaiers, aantalKleuren } = useMemo(() => {
    const term = zoekterm.trim().toLowerCase();
    const passend = term
      ? collections.filter((c) => c.name.toLowerCase().includes(term))
      : collections;

    const voorop = passend.filter((c) => VOOROP.has(c.id));
    const rest = [...passend.filter((c) => !VOOROP.has(c.id))].sort((a, b) =>
      a.name.localeCompare(b.name, "nl"),
    );

    const groepen = new Map<string, WaaierOverzichtItem[]>();
    for (const collection of rest) {
      const letter = (collection.name[0] ?? "#").toUpperCase();
      const sleutel = /[A-Z]/.test(letter) ? letter : "#";
      const lijst = groepen.get(sleutel);
      if (lijst) lijst.push(collection);
      else groepen.set(sleutel, [collection]);
    }
    return {
      voorop,
      groepen: [...groepen.entries()].sort(([a], [b]) => a.localeCompare(b)),
      letters: [...groepen.keys()].sort(),
      aantalWaaiers: passend.length,
      aantalKleuren: passend.reduce((som, c) => som + c.count, 0),
    };
  }, [collections, zoekterm]);

  if (collections.length === 0) return null;

  const springNaar = (letter: string) => {
    // Zelf rekenen tegen het venster, zonder smooth: scrollIntoView bleek
    // hier stilletjes niets te doen (zelfde familie als Klus=r's
    // offsetTop-val), en de animatie wordt niet in elke browser uitgevoerd —
    // bij een letterbalk wil je er bovendien meteen zijn. De aftrek houdt de
    // plakkende sitebalk en letterbalk vrij van de kop.
    const kop = document.getElementById(`waaier-letter-${letter}`);
    if (!kop) return;
    // "instant" is niet hetzelfde als weglaten: globals.css zet
    // scroll-behavior smooth op <html>, en dit paginadeel scrollt via de
    // root — dus zonder expliciete behavior wordt de sprong smooth (en
    // scroll-behavior erft niet: Klus=r's geneste dialoogkolom had er
    // daarom geen last van). Kent een oude browser "instant" niet, dan is
    // een TypeError hier een dode knop; dan liever de smooth-variant.
    const top = window.scrollY + kop.getBoundingClientRect().top - 176;
    try {
      window.scrollTo({ top, behavior: "instant" });
    } catch {
      window.scrollTo(0, top);
    }
  };

  const kaart = (collection: WaaierOverzichtItem) => (
    <li key={collection.id}>
      <Link
        href={`/kleurkiezer?waaier=${encodeURIComponent(collection.id)}`}
        className="block rounded-xl border-2 border-ink/10 p-3 transition hover:border-brand"
      >
        <span className="flex gap-1" aria-hidden>
          {collection.preview.map((hex, index) => (
            <span
              key={index}
              className="h-5 flex-1 rounded-sm ring-1 ring-black/10 first:rounded-l-md last:rounded-r-md"
              style={{ backgroundColor: hex }}
            />
          ))}
        </span>
        <span className="mt-2 flex items-baseline justify-between gap-2">
          <span className="truncate font-bold text-ink">{collection.name}</span>
          <span className="shrink-0 text-sm font-semibold text-ink-soft">
            {collection.count.toLocaleString("nl-NL")}
          </span>
        </span>
      </Link>
    </li>
  );

  return (
    <section aria-labelledby="waaiers-titel">
      <h2 id="waaiers-titel" className="text-xl font-black uppercase text-ink sm:text-2xl">
        Onze kleurwaaiers
      </h2>
      <p className="mt-1 text-ink-soft">
        Elke kleur uit deze waaiers mengen we gratis aan, in de verf die jij kiest.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label htmlFor="waaier-zoek" className="sr-only">
          Zoek een kleurwaaier
        </label>
        <input
          id="waaier-zoek"
          type="search"
          value={zoekterm}
          onChange={(event) => setZoekterm(event.target.value)}
          placeholder="Zoek een waaier, Sikkens, Flexa, NCS…"
          className="input max-w-sm"
        />
        <p className="text-sm font-semibold text-ink-soft" aria-live="polite">
          {aantalWaaiers.toLocaleString("nl-NL")} waaiers ·{" "}
          {aantalKleuren.toLocaleString("nl-NL")} kleuren
        </p>
      </div>

      {voorop.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {voorop.map(kaart)}
        </ul>
      )}

      {letters.length > 1 && (
        <nav aria-label="Spring naar letter" className="sticky top-32 z-10 mt-5">
          <div className="flex flex-wrap gap-1 rounded-xl bg-white/95 p-1.5 shadow-sm ring-1 ring-ink/10">
            {letters.map((letter) => (
              <button
                key={letter}
                type="button"
                onClick={() => springNaar(letter)}
                className="min-w-7 rounded-md px-1.5 py-1 text-sm font-black text-ink transition hover:bg-brand-light hover:text-brand"
              >
                {letter}
              </button>
            ))}
          </div>
        </nav>
      )}

      {groepen.map(([letter, lijst]) => (
        <div key={letter}>
          <h3
            id={`waaier-letter-${letter}`}
            className="mt-6 scroll-mt-48 border-b-2 border-ink/10 pb-1 text-lg font-black text-brand"
          >
            {letter}
          </h3>
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {lijst.map(kaart)}
          </ul>
        </div>
      ))}

      {aantalWaaiers === 0 && (
        <p className="mt-6 text-ink-soft">
          Geen waaier gevonden met &ldquo;{zoekterm}&rdquo;. Zoek op merk,
          Sikkens, Flexa, Histor, of kies hierboven Populair.
        </p>
      )}
    </section>
  );
}
