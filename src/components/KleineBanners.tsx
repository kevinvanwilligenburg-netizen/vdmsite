import Image from "next/image";
import Link from "next/link";

import { bannerRatio, type Banner } from "@/lib/banners";

/**
 * Twee kleine actiebanners onder de grote slideshow.
 *
 * Naast elkaar op een breed scherm, onder elkaar op een telefoon. Meer dan
 * twee tonen we niet: dan wordt het een tweede slideshow en duwt het de
 * actieproducten van het scherm, terwijl dít de plek is waar iemand na de
 * grote banner naar het aanbod moet doorlopen.
 *
 * Staat er niets klaar, dan staat hier ook niets — geen lege vakken.
 */
export function KleineBanners({ banners }: { banners: Banner[] }) {
  const tonen = banners.slice(0, 2);
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
    <section aria-label="Acties" className="grid gap-4 sm:grid-cols-2">
      {tonen.map((banner) => {
        const plaatje = (
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
                sizes="(max-width: 639px) 100vw, (max-width: 1279px) 50vw, 640px"
                // Tekst op een vlakke oranje achtergrond: op 75 gaan de
                // letterranden rafelen.
                quality={90}
                className="h-full w-full object-cover"
              />
            </picture>
          </div>
        );
        return (
          <div key={banner.id} className="overflow-hidden rounded-2xl shadow-card">
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
