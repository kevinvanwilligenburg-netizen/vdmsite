"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { HOOFDRUBRIEKEN } from "@/lib/rubrieken";
import type { MenuCategory } from "@/lib/tilroy";

/**
 * Hoofdmenu met uitklappaneel per categorie.
 *
 * De vorige balk schoof horizontaal: bij negen categorieën liep hij ruim
 * 300 pixels buiten een laptopscherm, compleet met scrollbalk, en de laatste
 * items waren onvindbaar. Elke categorie opent nu een paneel met de soorten
 * en de merken die er werkelijk in zitten — zo ziet een klant het
 * assortiment zonder eerst te moeten klikken.
 *
 * Niet álle categorieën staan in de balk. Met tien stuks plus de twee knoppen
 * is er 1.195 pixels nodig; op een laptop van 1024 valt de Kleurkiezer dan
 * buiten beeld, en bij een wrappende balk staat er één categorie eenzaam op
 * een tweede regel. Daarom vijf vaste rubrieken en daarachter "Alle
 * categorieën", met de rest in het paneel — dezelfde oplossing die Gamma
 * gebruikt. Voeg hier niets aan toe zonder na te meten op 1024 pixels.
 *
 * Openen gaat met de muis (hover) én met het toetsenbord (focus, Escape om
 * te sluiten). De categorie zelf blijft een gewone link, dus wie het paneel
 * niet gebruikt komt gewoon op de categoriepagina uit.
 */
/** Sleutel voor het paneel met alle categorieën; geen categorie-slug. */
const ALLES = "__alles__";

/**
 * Welke rubrieken vast in de balk staan, komt uit de catalogus
 * (HOOFDRUBRIEKEN). Sinds de indeling van Tilroy wordt gevolgd zijn er 58
 * categorieën; die passen niet op één regel, dus staat de rest achter
 * "Alle categorieën".
 */

export function MegaMenu({ categories }: { categories: MenuCategory[] }) {
  /*
   * De vaste rubrieken, met een vangnet.
   *
   * De slugs komen uit Tilroy en die kan van indeling wisselen — bij de
   * overgang naar de hoofdgroepen veranderden ze van naam naar groepscode.
   * Zonder vangnet was de balk dan leeg geweest zonder foutmelding. Vinden we
   * er te weinig, dan vallen we terug op de grootste rubrieken; een menu met
   * de verkeerde volgorde is te overzien, een leeg menu niet.
   */
  const gekozen = HOOFDRUBRIEKEN.map((alternatieven) => {
    for (const naam of alternatieven) {
      const gevonden = categories.find(
        (category) =>
          category.name.trim().toLocaleLowerCase("nl") === naam.toLocaleLowerCase("nl"),
      );
      if (gevonden) return gevonden;
    }
    return undefined;
  })
    .filter((category): category is MenuCategory => Boolean(category))
    // Twee plekken kunnen op hetzelfde uitkomen als de indeling schuift.
    .filter((category, index, rij) => rij.findIndex((c) => c.slug === category.slug) === index);
  const inBalk =
    gekozen.length >= 4
      ? gekozen
      : [...categories].sort((a, b) => b.count - a.count).slice(0, 6);
  const [open, setOpen] = useState<string | null>(null);
  const sluitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const annuleerSluiten = useCallback(() => {
    if (sluitTimer.current) {
      clearTimeout(sluitTimer.current);
      sluitTimer.current = null;
    }
  }, []);

  // Kort uitstel bij het weggaan: anders klapt het paneel dicht zodra de
  // muis de ruimte tussen de knop en het paneel kruist.
  const sluitStraks = useCallback(() => {
    annuleerSluiten();
    sluitTimer.current = setTimeout(() => setOpen(null), 120);
  }, [annuleerSluiten]);

  useEffect(() => () => annuleerSluiten(), [annuleerSluiten]);

  useEffect(() => {
    if (!open) return;
    const opToets = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("keydown", opToets);
    return () => document.removeEventListener("keydown", opToets);
  }, [open]);

  // Bij een klik in het paneel navigeert de site zonder de pagina te herladen;
  // de header blijft dus staan, en daarmee bleef ook het uitgeklapte paneel
  // over de nieuwe pagina hangen. De klant zag zijn categoriepagina niet en
  // dacht dat er niets gebeurde. Sluiten zodra het pad wijzigt.
  const pad = usePathname();
  useEffect(() => {
    setOpen(null);
    annuleerSluiten();
  }, [pad, annuleerSluiten]);

  // En meteen bij de klik zelf: wie op de pagina klikt waar hij al staat,
  // wijzigt het pad niet en zou het paneel anders open houden.
  const sluitNu = useCallback(() => {
    annuleerSluiten();
    setOpen(null);
  }, [annuleerSluiten]);

  return (
    <nav
      ref={navRef}
      aria-label="Hoofdmenu"
      className="relative hidden bg-ink text-white lg:block"
      onMouseLeave={sluitStraks}
      onBlur={(event) => {
        // Sluit zodra de focus het hele menu verlaat.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(null);
        }
      }}
    >
      {/*
        De categorieën en de twee knoppen staan in aparte flex-groepen.
        Met `ml-auto` op de knoppen binnen één wrappende rij slokt die marge
        de vrije ruimte op en springen ze naar een tweede regel, ook als
        alles ruim past.
      */}
      <div className="container-page flex items-center justify-between gap-4 py-1 text-sm font-bold">
        <div className="flex items-center gap-x-0.5">
          {inBalk.map((category) => {
          const isOpen = open === category.slug;
          const heeftPaneel = category.soorten.length > 0 || category.merken.length > 0;
          return (
            <div key={category.slug} className="static">
              <Link
                href={`/categorie/${category.slug}`}
                onClick={sluitNu}
                aria-expanded={heeftPaneel ? isOpen : undefined}
                onMouseEnter={() => {
                  annuleerSluiten();
                  setOpen(heeftPaneel ? category.slug : null);
                }}
                onFocus={() => {
                  annuleerSluiten();
                  setOpen(heeftPaneel ? category.slug : null);
                }}
                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1.5 transition ${
                  isOpen ? "bg-white/10 text-brand-bright" : "hover:text-brand-bright"
                }`}
              >
                {category.menuLabel ?? category.name}
                {heeftPaneel && (
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 opacity-60" aria-hidden>
                    <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                )}
                </Link>
              </div>
            );
          })}

          {/* Alles wat niet in de balk past, in één paneel. */}
          <div className="static">
            <button
              type="button"
              aria-expanded={open === ALLES}
              onMouseEnter={() => {
                annuleerSluiten();
                setOpen(ALLES);
              }}
              onFocus={() => {
                annuleerSluiten();
                setOpen(ALLES);
              }}
              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1.5 transition ${
                open === ALLES ? "bg-white/10 text-brand-bright" : "hover:text-brand-bright"
              }`}
            >
              Alle categorieën
              <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 opacity-60" aria-hidden>
                <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* Acties in het rood, naast de categorieën. Rood is in de
              huisstijlgids het actiekleur (PMS 2347) en het is de enige knop
              in deze balk die er niet uitziet als navigatie — dat is precies
              de bedoeling. */}
          <Link
            href="/actie"
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-actie px-3 py-1.5 font-black text-white transition hover:brightness-110"
          >
            Acties
          </Link>
          <Link
            href="/klusadvies"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition hover:text-brand-bright"
          >
            <Icon name="bulb" className="h-4 w-4" /> Klusadvies
          </Link>
          <Link
            href="/kleurkiezer"
            className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-white transition hover:bg-brand-dark"
          >
            <Icon name="palette" className="h-4 w-4" /> Kleurkiezer
          </Link>
        </div>
      </div>

      {open === ALLES && (
        <div
          onMouseEnter={annuleerSluiten}
          onMouseLeave={sluitStraks}
          className="absolute inset-x-0 top-full z-50 border-t-2 border-brand bg-white text-ink shadow-lift"
        >
          <div className="container-page py-6">
            <p className="text-xs font-black uppercase tracking-wide text-ink-soft">
              Het hele assortiment
            </p>
            <ul className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/categorie/${category.slug}`}
                    onClick={sluitNu}
                    className="flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 font-semibold text-ink transition hover:bg-brand-light hover:text-brand"
                  >
                    <span className="truncate">{category.name}</span>
                    <span className="shrink-0 text-xs font-normal text-ink-soft">
                      {category.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {inBalk.map((category) => {
        if (open !== category.slug) return null;
        if (category.soorten.length === 0 && category.merken.length === 0) return null;
        return (
          <div
            key={category.slug}
            onMouseEnter={annuleerSluiten}
            onMouseLeave={sluitStraks}
            className="absolute inset-x-0 top-full z-50 border-t-2 border-brand bg-white text-ink shadow-lift"
          >
            <div className="container-page grid gap-8 py-6 md:grid-cols-[1.2fr_1fr_1fr]">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-ink-soft">
                  Soorten
                </p>
                <ul className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                  {category.soorten.map((soort) => (
                    <li key={soort.label}>
                      <Link
                        href={soort.href}
                        onClick={sluitNu}
                        className="flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 font-semibold text-ink transition hover:bg-brand-light hover:text-brand"
                      >
                        <span className="truncate">{soort.label}</span>
                        <span className="shrink-0 text-xs font-normal text-ink-soft">
                          {soort.count}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/categorie/${category.slug}`}
                  onClick={sluitNu}
                  className="mt-3 inline-block px-2 text-sm font-bold text-brand hover:underline"
                >
                  Alles in {category.name.toLowerCase()} ({category.count}) →
                </Link>
              </div>

              {category.merken.length > 0 && (
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-ink-soft">
                    Merken
                  </p>
                  <ul className="mt-3 space-y-1">
                    {category.merken.map((merk) => (
                      <li key={merk.label}>
                        <Link
                          href={merk.href}
                          onClick={sluitNu}
                          className="flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 font-semibold text-ink transition hover:bg-brand-light hover:text-brand"
                        >
                          <span className="truncate">{merk.label}</span>
                          <span className="shrink-0 text-xs font-normal text-ink-soft">
                            {merk.count}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/merken"
                    onClick={sluitNu}
                    className="mt-3 inline-block px-2 text-sm font-bold text-brand hover:underline"
                  >
                    Alle merken →
                  </Link>
                </div>
              )}

              {/*
                `self-start` is hier geen detail: zonder die regel rekt dit
                vak mee met de hoogste kolom van het paneel, en dan staat er
                onder de knop een half scherm leeg oranje.

                De categorie-slug wordt niet meer op "verf" vergeleken — sinds
                de indeling van Tilroy komt is er geen categorie die zo heet,
                maar wel Lakken, Muurverf en Speciaalverven. Nu kijken we of er
                mengverf in de rubriek zit; dat is precies wanneer de
                kleurkiezer nut heeft.
              */}
              <div className="self-start overflow-hidden rounded-2xl bg-brand-light">
                <div className="p-5">
                  <p className="text-sm font-black uppercase text-ink">
                    {category.mengverf ? "Verf in elke kleur" : "Weet je het niet zeker?"}
                  </p>
                  <p className="mt-1 text-sm text-ink-soft">
                    {category.mengverf
                      ? "Kies je kleur online; onze verfspecialist mengt hem gratis aan."
                      : "Vertel wat je gaat doen en Mark rekent uit wat je nodig hebt."}
                  </p>
                  <Link
                    href={category.mengverf ? "/kleurkiezer" : "/klusadvies"}
                    onClick={sluitNu}
                    className="btn btn-primary mt-4 py-2 text-sm"
                  >
                    {category.mengverf ? "Open de kleurkiezer" : "Naar het klusadvies"}
                  </Link>
                </div>
                {/* Mark sluit het vak af; de oranje achtergrond van de shoot
                    loopt door in het vlak, dus er is geen uitsnede nodig. */}
                <Image
                  src={category.mengverf ? "/mark/mark-mengen.jpg" : "/mark/mark-vragend.jpg"}
                  alt=""
                  width={900}
                  height={1350}
                  className="h-40 w-full object-cover object-top"
                />
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
