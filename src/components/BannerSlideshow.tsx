"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Banner } from "@/lib/banners";

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
            {/* Twee bronnen in één <picture>: de browser kiest, dus er wordt
                er maar één gedownload. */}
            <picture>
              {banner.mobielUrl && (
                <source media="(max-width: 767px)" srcSet={banner.mobielUrl} />
              )}
              <Image
                src={banner.desktopUrl}
                alt={banner.alt}
                width={1920}
                height={640}
                // De eerste banner staat bovenaan de pagina en is dus het
                // grootste ding dat de bezoeker als eerste ziet.
                priority={index === 0}
                sizes="(max-width: 767px) 100vw, 1200px"
                className="h-auto w-full"
              />
            </picture>
          </>
        );
        return (
          <div
            key={banner.id}
            // Niet-actieve banners uit de tabvolgorde en uit de schermlezer;
            // anders leest die alle acties achter elkaar voor.
            {...(zichtbaar ? {} : { "aria-hidden": true, inert: true })}
            className={zichtbaar ? "block" : "hidden"}
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
