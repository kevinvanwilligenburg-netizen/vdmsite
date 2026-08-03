"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import {
  ALLE_WAAIERS,
  bestaandeWaaier,
  kleurLabel,
  waaierNaam,
  type Waaier,
} from "@/components/kleur/waaier";
import type { PaintColor } from "@/lib/types";

// De kiezer opent op de kleuren waar de mengmachine dagelijks op draait.
// Beginnen bij de volledige RAL-waaier betekende scrollen langs 166 tinten
// voordat je bij wit was — en wit is verreweg het meest verkocht.
const STANDAARD_WAAIER = "populair";
/** De waaier waarvan we de kleuren al meegeleverd krijgen (initialColors). */
const MEEGELEVERDE_WAAIER = "ral";
const KAARTJES_PER_KEER = 240;

/** Zwart of wit vinkje op een staal, afhankelijk van hoe donker de kleur is. */
function vinkjeOp(hex: string): string {
  const waarde = (hex ?? "").replace("#", "");
  if (waarde.length < 6) return "#141414";
  const r = parseInt(waarde.slice(0, 2), 16);
  const g = parseInt(waarde.slice(2, 4), 16);
  const b = parseInt(waarde.slice(4, 6), 16);
  if ([r, g, b].some((deel) => Number.isNaN(deel))) return "#141414";
  return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? "#141414" : "#FFFFFF";
}

/**
 * Hoeveel kaartjes er naast elkaar staan. Nodig om met ↑ en ↓ een rij te
 * kunnen springen: het aantal kolommen hangt van de schermbreedte af, dus we
 * meten het aan de kaartjes zelf in plaats van het te gokken.
 */
function kolommenIn(houder: HTMLElement | null): number {
  const kaartjes = houder?.querySelectorAll<HTMLElement>("[data-kaart]");
  if (!kaartjes || kaartjes.length === 0) return 1;
  const bovenkant = kaartjes[0].offsetTop;
  let kolommen = 0;
  for (const kaart of Array.from(kaartjes)) {
    if (kaart.offsetTop !== bovenkant) break;
    kolommen++;
  }
  return Math.max(kolommen, 1);
}

/**
 * De kleurkiezer: zoeken, een waaier kiezen, en dan een kaartje aanklikken.
 *
 * De bron telt tienduizenden kleuren, dus die gaan nooit in één keer naar de
 * browser: per waaier of zoekterm halen we een beperkte set op bij
 * /api/kleuren. De meegegeven `initialColors` (de RAL-waaier) staat er meteen,
 * zodat er bij het openen niets hoeft te laden.
 *
 * Toetsenbord: de waaierrij en het kleurenraster hebben elk één tabstop en
 * werken verder met de pijltjes. Anders staan er honderden waaiers en
 * kleuren tussen het zoekveld en de knop eronder.
 */
export function ColorPicker({
  initialColors,
  value,
  onChange,
  waaier: gevraagdeWaaier,
  fill = false,
}: {
  initialColors: PaintColor[];
  value?: string | null;
  onChange: (color: PaintColor) => void;
  /** Waaier die vooraf gekozen moet zijn. Komt van buiten, dus wordt gecontroleerd. */
  waaier?: string | null;
  /** In een venster de beschikbare hoogte vullen; anders een vaste maximumhoogte. */
  fill?: boolean;
}) {
  const veldId = useId();
  const [query, setQuery] = useState("");
  const [waaier, setWaaier] = useState(STANDAARD_WAAIER);
  const [waaiers, setWaaiers] = useState<Waaier[]>([]);
  const [colors, setColors] = useState<PaintColor[]>(initialColors);
  const [total, setTotal] = useState(initialColors.length);
  const [loading, setLoading] = useState(false);
  const [waaierFocus, setWaaierFocus] = useState(0);
  const [kleurFocus, setKleurFocus] = useState(0);

  const laatsteVraag = useRef(0);
  const waaierRij = useRef<HTMLDivElement | null>(null);
  const kleurRaster = useRef<HTMLDivElement | null>(null);
  // Zodra iemand zelf een waaier aanklikt, mag de waaier uit de URL het niet
  // meer overnemen.
  const zelfGekozen = useRef(false);

  // De waaierlijst één keer ophalen; die is klein genoeg om in zijn geheel op
  // te halen (namen en aantallen, geen kleuren).
  useEffect(() => {
    let actief = true;
    fetch("/api/kleuren?meta=1")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (actief && Array.isArray(data?.collections)) setWaaiers(data.collections);
      })
      .catch(() => undefined);
    return () => {
      actief = false;
    };
  }, []);

  // De gevraagde waaier pas overnemen als we de lijst hebben: hij komt uit de
  // URL en mag dus niet zomaar geloofd worden.
  useEffect(() => {
    if (zelfGekozen.current || waaiers.length === 0) return;
    const gecontroleerd = bestaandeWaaier(gevraagdeWaaier, waaiers);
    if (gecontroleerd) setWaaier(gecontroleerd);
  }, [gevraagdeWaaier, waaiers]);

  // Kleuren ophalen bij een andere zoekterm of waaier.
  useEffect(() => {
    const term = query.trim();
    // Alleen de meegeleverde waaier kan zonder ophalen; de kiezer opent op
    // Populair en die tien kleuren komen wél van de server.
    if (term === "" && waaier === MEEGELEVERDE_WAAIER) {
      setColors(initialColors);
      setTotal(initialColors.length);
      setLoading(false);
      return;
    }

    const vraag = ++laatsteVraag.current;
    setLoading(true);
    // Typen krijgt een adempauze; op een waaier klikken hoort direct te reageren.
    const timer = window.setTimeout(
      () => {
        const params = new URLSearchParams();
        if (term) params.set("q", term);
        params.set("collection", waaier);
        params.set("limit", String(KAARTJES_PER_KEER));
        fetch(`/api/kleuren?${params.toString()}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (vraag !== laatsteVraag.current) return;
            setColors(Array.isArray(data?.colors) ? data.colors : []);
            setTotal(typeof data?.total === "number" ? data.total : 0);
          })
          .catch(() => {
            if (vraag === laatsteVraag.current) {
              setColors([]);
              setTotal(0);
            }
          })
          .finally(() => {
            if (vraag === laatsteVraag.current) setLoading(false);
          });
      },
      term ? 250 : 0,
    );

    return () => window.clearTimeout(timer);
  }, [query, waaier, initialColors]);

  const totaalAantal = useMemo(
    () => waaiers.reduce((som, entry) => som + entry.count, 0),
    [waaiers],
  );

  // Wie "sikkens" typt zoekt een waaier: dan filtert de rij mee. Levert dat
  // niets op, dan blijft de hele rij staan — een lege rij helpt niemand.
  const waaierKnoppen = useMemo(() => {
    const term = query.trim().toLowerCase();
    let zichtbaar = waaiers;
    if (term) {
      const gevonden = waaiers.filter((entry) =>
        waaierNaam(entry).toLowerCase().includes(term),
      );
      if (gevonden.length > 0) {
        const actief = waaiers.find((entry) => entry.id === waaier);
        zichtbaar =
          actief && !gevonden.some((entry) => entry.id === actief.id)
            ? [actief, ...gevonden]
            : gevonden;
      }
    }
    return [
      { id: ALLE_WAAIERS, name: "Alle waaiers", count: totaalAantal },
      ...zichtbaar,
    ];
  }, [waaiers, query, waaier, totaalAantal]);

  /*
   * Chips voor de waaiers waar het meeste op gekozen wordt, de rest in een
   * keuzelijst.
   *
   * De hele rij stond in één horizontaal schuivend vak. Met ruim honderd
   * waaiers betekende dat slepen naar rechts om iets te vinden waarvan je
   * niet weet of het er staat — en op een aanraakscherm vecht dat schuiven
   * met het scrollen van de pagina. De acht grootste dekken verreweg de
   * meeste keuzes; wie iets anders zoekt typt de naam (de chips filteren
   * mee) of pakt de lijst.
   */
  const CHIPS_ZICHTBAAR = 8;
  const { chips } = useMemo(() => {
    // "Alle waaiers" staat in de keuzelijst en hoeft er niet ook nog als knop
    // bij; die plek gaat naar een waaier waar iemand echt op klikt.
    const zonderAlles = waaierKnoppen.filter((entry) => entry.id !== ALLE_WAAIERS);
    const zoekt = query.trim().length > 0;
    // Tijdens het zoeken zijn de treffers juist het antwoord: dan alles tonen
    // wat matcht (dat zijn er per definitie weinig).
    if (zoekt) return { chips: zonderAlles };
    const eerste = zonderAlles.slice(0, CHIPS_ZICHTBAAR);
    const rest = zonderAlles.slice(CHIPS_ZICHTBAAR);
    // De gekozen waaier hoort zichtbaar te zijn, ook als hij achteraan staat.
    const actief = rest.find((entry) => entry.id === waaier);
    return { chips: actief ? [...eerste, actief] : eerste };
  }, [waaierKnoppen, waaier, query]);

  /*
   * De keuzelijst met álle waaiers, op alfabet en met een zoekveldje.
   *
   * Een gewone <select> kan niet zoeken, en met 150 waaiers scrol je je suf
   * langs een lijst op grootte — dan moet je weten hoe groot "Trimetal Colour
   * Index 2" is om hem te vinden. Op naam gesorteerd staat alles waar je het
   * zoekt, en wie de naam half weet typt hem.
   */
  const [lijstOpen, setLijstOpen] = useState(false);
  const [lijstZoek, setLijstZoek] = useState("");
  const lijstRef = useRef<HTMLDivElement | null>(null);

  const alleWaaiersOpNaam = useMemo(() => {
    const alles = [
      { id: ALLE_WAAIERS, name: "Alle waaiers", count: totaalAantal },
      ...waaiers,
    ];
    return [...alles].sort((a, b) =>
      waaierNaam(a).localeCompare(waaierNaam(b), "nl", { sensitivity: "base" }),
    );
  }, [waaiers, totaalAantal]);

  const lijstTreffers = useMemo(() => {
    const term = lijstZoek.trim().toLowerCase();
    if (!term) return alleWaaiersOpNaam;
    return alleWaaiersOpNaam.filter((entry) =>
      waaierNaam(entry).toLowerCase().includes(term),
    );
  }, [alleWaaiersOpNaam, lijstZoek]);

  // Buiten de lijst klikken sluit hem; anders blijft hij over de kleuren staan.
  useEffect(() => {
    if (!lijstOpen) return;
    const buitenom = (event: MouseEvent) => {
      if (!lijstRef.current?.contains(event.target as Node)) setLijstOpen(false);
    };
    const opToets = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLijstOpen(false);
    };
    document.addEventListener("mousedown", buitenom);
    document.addEventListener("keydown", opToets);
    return () => {
      document.removeEventListener("mousedown", buitenom);
      document.removeEventListener("keydown", opToets);
    };
  }, [lijstOpen]);

  // De actieve waaier in beeld schuiven; met honderden waaiers staat hij
  // anders buiten het zichtbare stuk van de rij.
  useEffect(() => {
    const houder = waaierRij.current;
    const knop = houder?.querySelector<HTMLElement>('[data-actief="ja"]');
    if (!houder || !knop) return;
    const doel = knop.offsetLeft - houder.clientWidth / 2 + knop.clientWidth / 2;
    houder.scrollTo({ left: Math.max(0, doel), behavior: "smooth" });
  }, [waaier, waaierKnoppen]);

  // Nieuwe resultaten: de tabstop terug naar het eerste kaartje.
  useEffect(() => {
    setKleurFocus(0);
  }, [colors]);

  function kiesWaaier(id: string) {
    zelfGekozen.current = true;
    setWaaier(id);
  }

  function verplaatsIn(
    houder: HTMLElement | null,
    selector: string,
    naar: number,
    aantal: number,
    zet: (index: number) => void,
  ) {
    const begrensd = Math.max(0, Math.min(naar, aantal - 1));
    zet(begrensd);
    houder?.querySelectorAll<HTMLElement>(selector)[begrensd]?.focus();
  }

  function opWaaierToets(event: React.KeyboardEvent<HTMLDivElement>) {
    const aantal = waaierKnoppen.length;
    const stap =
      event.key === "ArrowRight"
        ? waaierFocus + 1
        : event.key === "ArrowLeft"
          ? waaierFocus - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? aantal - 1
              : null;
    if (stap === null) return;
    event.preventDefault();
    verplaatsIn(waaierRij.current, "[data-waaier]", stap, aantal, setWaaierFocus);
  }

  function opKleurToets(event: React.KeyboardEvent<HTMLDivElement>) {
    const aantal = colors.length;
    if (aantal === 0) return;
    const kolommen = kolommenIn(kleurRaster.current);
    const stap =
      event.key === "ArrowRight"
        ? kleurFocus + 1
        : event.key === "ArrowLeft"
          ? kleurFocus - 1
          : event.key === "ArrowDown"
            ? kleurFocus + kolommen
            : event.key === "ArrowUp"
              ? kleurFocus - kolommen
              : event.key === "Home"
                ? 0
                : event.key === "End"
                  ? aantal - 1
                  : null;
    if (stap === null) return;
    event.preventDefault();
    verplaatsIn(kleurRaster.current, "[data-kaart]", stap, aantal, setKleurFocus);
  }

  const aanHetLaden = loading && colors.length === 0;

  return (
    <div className={`flex w-full min-w-0 flex-col gap-3 ${fill ? "h-full min-h-0" : ""}`}>
      <div className="relative">
        <label className="sr-only" htmlFor={`${veldId}-zoek`}>
          Zoek een kleur op naam, code of waaier
        </label>
        <Icon
          name="search"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
        />
        <input
          id={`${veldId}-zoek`}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Zoek op kleurnaam, code of waaier"
          className="input pl-9"
        />
      </div>

      {/* Waaiers als knoppen die netjes doorlopen op een tweede regel.
          Radiogroep, want het is één keuze uit een reeks — en zo werken de
          pijltjes zoals een schermlezer aankondigt. */}
      <div
        ref={waaierRij}
        role="radiogroup"
        aria-label="Kleurwaaier"
        onKeyDown={opWaaierToets}
        className="relative -mx-1 flex flex-wrap items-center gap-2 px-1 pb-1"
      >
        {waaiers.length === 0
          ? Array.from({ length: 4 }).map((_, index) => (
              <span
                key={index}
                aria-hidden
                className="h-9 w-32 shrink-0 animate-pulse rounded-full bg-ink/5"
              />
            ))
          : chips.map((entry, index) => {
              const actief = entry.id === waaier;
              return (
                <button
                  key={entry.id}
                  type="button"
                  data-waaier
                  data-actief={actief ? "ja" : "nee"}
                  role="radio"
                  aria-checked={actief}
                  tabIndex={index === waaierFocus ? 0 : -1}
                  onFocus={() => setWaaierFocus(index)}
                  onClick={() => kiesWaaier(entry.id)}
                  /*
                    Op een telefoon zijn zeven waaierknoppen vijf regels hoog,
                    en dan blijft er van het kleurenraster nog anderhalve rij
                    over. Daar staan de kleuren voor niets. Vanaf de derde
                    knop dus pas zichtbaar op een breder scherm; op mobiel
                    loopt alles via de keuzelijst ernaast.
                  */
                  className={`shrink-0 whitespace-nowrap rounded-full border-2 px-4 py-1.5 text-sm font-bold transition ${
                    index >= 2 && !actief ? "hidden sm:inline-flex" : "inline-flex"
                  } ${
                    actief
                      ? "border-brand bg-brand text-white"
                      : "border-ink/10 bg-white text-ink hover:border-brand hover:text-brand"
                  }`}
                >
                  {waaierNaam(entry)}{" "}
                  <span className={actief ? "font-normal text-white/80" : "font-normal text-ink-soft"}>
                    {entry.count.toLocaleString("nl-NL")}
                  </span>
                </button>
              );
            })}

        {/* De overige waaiers in een lijst in plaats van achter een
            schuifbalk: honderd namen wegslepen naar rechts vindt niemand, en
            op een telefoon vecht dat schuiven met het scrollen van de pagina. */}
        {waaiers.length > 0 && (
          <div ref={lijstRef} className="relative">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={lijstOpen}
              onClick={() => {
                setLijstOpen((open) => !open);
                setLijstZoek("");
              }}
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink/10 bg-white px-4 py-1.5 text-sm font-bold text-ink transition hover:border-brand hover:text-brand"
            >
              Alle waaiers ({waaiers.length})
              <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 opacity-60" aria-hidden>
                <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>

            {lijstOpen && (
              <div
                role="listbox"
                aria-label="Kies een kleurwaaier"
                className="absolute left-0 top-full z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border-2 border-ink/10 bg-white shadow-lift"
              >
                <div className="border-b border-ink/10 p-2">
                  <input
                    autoFocus
                    value={lijstZoek}
                    onChange={(event) => setLijstZoek(event.target.value)}
                    placeholder="Zoek een waaier…"
                    aria-label="Zoek een waaier"
                    className="input w-full py-1.5 text-sm"
                  />
                </div>
                <ul className="max-h-72 overflow-y-auto py-1">
                  {lijstTreffers.length === 0 && (
                    <li className="px-3 py-2 text-sm text-ink-soft">Geen waaier gevonden.</li>
                  )}
                  {lijstTreffers.map((entry) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={entry.id === waaier}
                        onClick={() => {
                          kiesWaaier(entry.id);
                          setLijstOpen(false);
                        }}
                        className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-brand-light ${
                          entry.id === waaier ? "font-black text-brand" : "font-semibold text-ink"
                        }`}
                      >
                        <span className="truncate">{waaierNaam(entry)}</span>
                        <span className="shrink-0 text-xs font-normal text-ink-soft">
                          {entry.count.toLocaleString("nl-NL")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div
        ref={kleurRaster}
        role="listbox"
        aria-label="Kleuren"
        aria-busy={loading}
        onKeyDown={opKleurToets}
        /*
          `content-start` en `auto-rows-max` zijn hier geen opmaak maar de
          reparatie: zonder die twee verdeelt het raster zijn hoogte over álle
          rijen. Bij 166 kleuren in vijf kolommen zijn dat 34 rijen, en dan
          eisen de tussenruimtes alleen al meer ruimte dan het vak hoog is —
          waarna elke rij op 3 pixels uitkomt. De kleurvlakken stonden er dus
          wel, als grijze streepjes van drie pixels, en niemand zag een kleur.
          Met deze twee houden de rijen hun eigen hoogte en scrollt het vak.
        */
        className={`grid min-w-0 auto-rows-max content-start grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 ${
          fill ? "min-h-0 flex-1" : "max-h-[30rem]"
        } ${loading && colors.length > 0 ? "opacity-60" : ""}`}
      >
        {aanHetLaden &&
          Array.from({ length: 10 }).map((_, index) => (
            <span
              key={index}
              aria-hidden
              className="h-[6.75rem] animate-pulse rounded-xl bg-ink/5"
            />
          ))}

        {colors.map((color, index) => {
          const gekozen = value === color.key;
          const { titel, onder } = kleurLabel(color);
          const omschrijving = [titel, onder].filter(Boolean).join(", ");
          return (
            <button
              key={color.key}
              type="button"
              data-kaart
              role="option"
              aria-selected={gekozen}
              aria-label={omschrijving}
              tabIndex={index === kleurFocus ? 0 : -1}
              onFocus={() => setKleurFocus(index)}
              onClick={() => onChange(color)}
              className={`flex flex-col overflow-hidden rounded-xl border-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                gekozen
                  ? "border-brand shadow-lift"
                  : "border-ink/10 hover:border-ink/40 hover:shadow-card"
              }`}
            >
              <span
                className="flex h-14 w-full items-center justify-center"
                // Het vinkje krijgt zwart of wit mee, want op een donker staal
                // is een zwart vinkje niet te zien.
                style={{ backgroundColor: color.hex, color: vinkjeOp(color.hex) }}
                aria-hidden
              >
                {gekozen && <Icon name="check" className="h-6 w-6" strokeWidth={3} />}
              </span>
              <span className="block min-w-0 px-2 py-1.5">
                <span className="block truncate text-sm font-bold text-ink">{titel}</span>
                <span className="block truncate text-xs text-ink-soft">{onder}</span>
              </span>
            </button>
          );
        })}

        {!loading && colors.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-ink-soft">
            Geen kleuren gevonden. Zoek op een kleurnaam, een code (bijvoorbeeld
            9010) of de naam van een waaier.
          </p>
        )}
      </div>

      <p role="status" className="text-xs text-ink-soft">
        {loading
          ? "Kleuren laden…"
          : total > colors.length
            ? `${colors.length} van ${total.toLocaleString("nl-NL")} kleuren getoond — zoek op naam of code om te verfijnen.`
            : `${colors.length.toLocaleString("nl-NL")} ${colors.length === 1 ? "kleur" : "kleuren"}. De kleuren op je scherm zijn een indicatie.`}
      </p>
    </div>
  );
}
