import Image from "next/image";
import Link from "next/link";

import { bannerRatio, type Banner } from "@/lib/banners";

/**
 * De strook met kleinere acties, onder de etalage.
 *
 * Vier naast elkaar op een breed scherm, twee naast elkaar op een telefoon —
 * dezelfde vorm als bol, en dat is wat Kevin vroeg ("daaronder banners voor
 * kleinere acties", "en mobiel ook zo").
 *
 * ⚠️ De tekst hoort hier óók bij. Dit onderdeel tekende alleen het plaatje,
 * dus `kop`, `subkop` en `knopLabel` uit de bannertool kwamen op deze plek
 * nooit in beeld — Kevin vulde ze in en zag er niets van terug. Bij de grote
 * banner werden ze wél getekend, en dat verschil was nergens op gebaseerd.
 *
 * Staat er niets klaar, dan staat hier ook niets — geen lege vakken.
 */
export function KleineBanners({ banners }: { banners: Banner[] }) {
  const tonen = banners.slice(0, 4);
  if (tonen.length === 0) return null;

  /*
   * Eén verhouding voor allebei, van de eerste banner.
   *
   * Ze staan naast elkaar; kreeg elk zijn eigen vorm, dan staat het rijtje
   * scheef zodra de twee bestanden niet exact even groot zijn.
   *
   * De vaste 2:1 die hier stond sneed er een derde af: Kevins kleine banners
   * zijn 450×150, dus 3:1. Daardoor liep "20% KORTING OP ALLE HG PRODUCTEN"
   * rechts uit beeld.
   */
  const ratio = bannerRatio(tonen[0].breedte, tonen[0].hoogte, "klein", "desktop");

  return (
    <section aria-label="Acties" className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      {tonen.map((banner) => {
        const plaatje = (
          <>
            <div className="relative overflow-hidden" style={{ aspectRatio: ratio }}>
              <picture>
                {banner.mobielUrl && (
                  <source media="(max-width: 639px)" srcSet={banner.mobielUrl} />
                )}
                <Image
                  src={banner.desktopUrl}
                  alt={banner.alt}
                  width={banner.breedte ?? 960}
                  height={banner.hoogte ?? 480}
                  sizes="(max-width: 639px) 50vw, (max-width: 1023px) 50vw, 320px"
                  // Tekst op een vlakke oranje achtergrond: op 75 gaan de
                  // letterranden rafelen.
                  quality={90}
                  className="h-full w-full object-cover"
                />
              </picture>
            </div>
            {(banner.kop || banner.subkop || banner.knopLabel) && (
              <div className="absolute inset-0 flex items-center bg-gradient-to-r from-ink/80 via-ink/40 to-transparent p-3 sm:p-4">
                <div className="max-w-[72%]">
                  {banner.kop && (
                    <p className="font-kop text-sm leading-tight text-white drop-shadow sm:text-lg">
                      {banner.kop}
                    </p>
                  )}
                  {banner.subkop && (
                    <p className="mt-0.5 text-[11px] font-semibold leading-snug text-white/90 sm:text-xs">
                      {banner.subkop}
                    </p>
                  )}
                  {banner.knopLabel && (
                    <span className="mt-1.5 inline-flex rounded-md bg-brand px-2 py-1 text-[11px] font-black text-white sm:mt-2 sm:px-3 sm:text-xs">
                      {banner.knopLabel}
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        );
        return (
          <div key={banner.id} className="relative overflow-hidden rounded-xl shadow-card">
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
    </section>
  );
}
