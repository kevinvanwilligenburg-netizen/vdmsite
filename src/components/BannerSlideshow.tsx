"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { bannerRatio, type Banner } from "@/lib/banners";

/**
 * De actiebanners bovenaan de homepage.
 *
 * Eén banner is gewoon een plaatje: geen bolletjes, geen pijlen, geen timer.
 * Pas vanaf twee schuift hij door.
 *
 * Twee formaten, want een banner van 1920×640 is op een telefoon een streepje
 * van niks. Kevin zet er een vierkante versie bij (1080×1080); staat die er
 * niet, dan gebruiken we de brede.
 */

const WISSEL_MS = 6000;

export function BannerSlideshow({ banners }: { banners: Banner[] }) {
  const [actief, setActief] = useState(0);
  const [pauze, setPauze] = useState(false);
  const aantal = banners.length;
  // Bij minder beweging in de systeeminstellingen staat de slideshow stil.
  // Wie daarom vraagt, heeft er last van — niet alleen bij animaties die wij
  // "subtiel" vinden.
  const [rustig, setRustig] = useState(false);
  const raakStart = useRef<number | null>(null);

  /*
   * Eén verhouding voor de hele slideshow, van de eerste banner.
   *
   * Per banner zijn eigen vorm geven zou netter lijken, maar er staat er
   * telkens maar één in beeld (de rest is `hidden`): dan verspringt de halve
   * homepage bij elke wissel. Kevins banners komen uit hetzelfde sjabloon, dus
   * de eerste is maatgevend voor de rest.
   */
  const eerste = banners[0];
  const ratios = {
    "--banner-mobiel": bannerRatio(
      eerste?.mobielBreedte ?? eerste?.breedte,
      eerste?.mobielHoogte ?? eerste?.hoogte,
      "groot",
      "mobiel",
    ),
    "--banner-desktop": bannerRatio(eerste?.breedte, eerste?.hoogte, "groot", "desktop"),
  } as React.CSSProperties;

  useEffect(() => {
    const vraag = window.matchMedia("(prefers-reduced-motion: reduce)");
    setRustig(vraag.matches);
    const luister = (event: MediaQueryListEvent) => setRustig(event.matches);
    vraag.addEventListener("change", luister);
    return () => vraag.removeEventListener("change", luister);
  }, []);

  useEffect(() => {
    if (aantal < 2 || pauze || rustig) return;
    const timer = window.setInterval(() => {
      setActief((huidig) => (huidig + 1) % aantal);
    }, WISSEL_MS);
    return () => window.clearInterval(timer);
  }, [aantal, pauze, rustig]);

  const ga = useCallback(
    (richting: 1 | -1) => setActief((huidig) => (huidig + richting + aantal) % aantal),
    [aantal],
  );

  if (aantal === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Acties"
      className="relative overflow-hidden rounded-2xl shadow-card"
      style={ratios}
      onMouseEnter={() => setPauze(true)}
      onMouseLeave={() => setPauze(false)}
      // Doorschuiven terwijl iemand met het toetsenbord in de banner staat is
      // hetzelfde als een pagina die onder je muis vandaan beweegt.
      onFocusCapture={() => setPauze(true)}
      onBlurCapture={() => setPauze(false)}
      onTouchStart={(event) => {
        raakStart.current = event.touches[0]?.clientX ?? null;
        setPauze(true);
      }}
      onTouchEnd={(event) => {
        const start = raakStart.current;
        raakStart.current = null;
        setPauze(false);
        if (start === null || aantal < 2) return;
        const afstand = (event.changedTouches[0]?.clientX ?? start) - start;
        // Onder de veertig pixels is het geen veeg maar een tik.
        if (Math.abs(afstand) > 40) ga(afstand < 0 ? 1 : -1);
      }}
    >
      {banners.map((banner, index) => {
        const zichtbaar = index === actief;
        const plaatje = (
          <>
            {/*
              Het kader krijgt de ware verhouding van het bestand (gemeten in
              lib/banners.ts), begrensd tegen uitschieters.

              Hier stond een vaste 3:1, op een telefoon zelfs vierkant. Dat was
              ooit een verdediging tegen de bannergenerator, die 1536×1024
              levert — bijna vierkant boven de homepage. Maar Kevins eigen
              banners zijn 930×450, en die werden er dus voor een derde
              afgesneden: precies de rand waar "20% KORTING" stond. Bij een
              banner met de tekst in het plaatje is bijsnijden geen
              schoonheidsfoutje maar weggelakte informatie.

              De grens uit `bannerRatio` houdt de oude bescherming overeind:
              een gek aangeleverde maat wordt nog steeds bijgesneden.
            */}
            <div className="relative aspect-[var(--banner-mobiel)] overflow-hidden md:aspect-[var(--banner-desktop)]">
              {/* Twee bronnen in één <picture>: de browser kiest, dus er wordt
                  er maar één gedownload. */}
              <picture>
                {banner.mobielUrl && (
                  <source media="(max-width: 767px)" srcSet={banner.mobielUrl} />
                )}
                <Image
                  src={banner.desktopUrl}
                  alt={banner.alt}
                  width={banner.breedte ?? 1920}
                  height={banner.hoogte ?? 640}
                  // De eerste banner staat bovenaan de pagina en is dus het
                  // grootste ding dat de bezoeker als eerste ziet.
                  priority={index === 0}
                  sizes="(max-width: 767px) 100vw, (max-width: 1279px) 100vw, 1280px"
                  // Deze banners zijn tekst op een vlakke oranje achtergrond.
                  // Daar is de standaard 75 te weinig voor: letterranden gaan
                  // rafelen en vlakken krijgen banding.
                  quality={90}
                  className="h-full w-full object-cover"
                />
              </picture>
            </div>
            {/*
              De actietekst ligt eróver, niet erin.

              Een beeldmodel zet prijzen en percentages geregeld verkeerd neer,
              en tekst die in het plaatje zit kun je niet wijzigen zonder een
              nieuwe afbeelding te laten maken. Zo staat er altijd wat er hoort
              te staan, in onze eigen letter, en past het zich aan het scherm
              aan in plaats van mee te schalen tot onleesbaar.

              Het donkere verloop staat er alleen als er tekst is: zonder tekst
              zou het een mooie foto voor niets verduisteren.
            */}
            {(banner.kop || banner.subkop) && (
              <div className="absolute inset-0 flex items-center bg-gradient-to-r from-ink/80 via-ink/45 to-transparent">
                <div className="max-w-[62%] p-5 sm:p-8 lg:p-12">
                  {banner.kop && (
                    <p className="font-kop text-xl leading-tight text-white drop-shadow sm:text-3xl lg:text-5xl">
                      {banner.kop}
                    </p>
                  )}
                  {banner.subkop && (
                    <p className="mt-1.5 text-xs font-semibold text-white/90 sm:mt-3 sm:text-base lg:text-lg">
                      {banner.subkop}
                    </p>
                  )}
                  {banner.knopLabel && (
                    <span className="mt-3 inline-flex rounded-lg bg-brand px-3 py-1.5 text-xs font-black text-white sm:mt-5 sm:px-5 sm:py-2.5 sm:text-sm">
                      {banner.knopLabel}
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        );
        return (
          <div
            key={banner.id}
            // Niet-actieve banners uit de tabvolgorde en uit de schermlezer;
            // anders leest die alle acties achter elkaar voor.
            {...(zichtbaar ? {} : { "aria-hidden": true, inert: true })}
            // `relative` zodat de tekstlaag binnen déze banner valt en niet
            // over de hele slideshow.
            className={zichtbaar ? "relative block" : "hidden"}
          >
            {banner.link ? (
              <Link href={banner.link} className="block">
                {plaatje}
              </Link>
            ) : (
              plaatje
            )}
          </div>
        );
      })}

      {aantal > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 p-3">
          {banners.map((banner, index) => (
            <button
              key={banner.id}
              type="button"
              onClick={() => setActief(index)}
              aria-label={`Actie ${index + 1} van ${aantal}`}
              aria-current={index === actief}
              className={`pointer-events-auto h-2.5 rounded-full ring-1 ring-black/20 transition-all ${
                index === actief ? "w-6 bg-white" : "w-2.5 bg-white/60 hover:bg-white"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
