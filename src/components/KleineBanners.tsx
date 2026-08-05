import Image from "next/image";
import Link from "next/link";

import type { Banner } from "@/lib/banners";

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

  return (
    <section aria-label="Acties" className="grid gap-4 sm:grid-cols-2">
      {tonen.map((banner) => {
        const plaatje = (
          // Vaste verhouding met uitsnede, om dezelfde reden als bij de grote
          // slideshow: de bannergenerator levert 1536×1024 en 1024×1024, en
          // twee banners naast elkaar met elk hun eigen hoogte staat scheef.
          <div className="relative aspect-[2/1] overflow-hidden">
            <picture>
              {banner.mobielUrl && (
                <source media="(max-width: 639px)" srcSet={banner.mobielUrl} />
              )}
              <Image
                src={banner.desktopUrl}
                alt={banner.alt}
                width={960}
                height={480}
                sizes="(max-width: 639px) 100vw, 600px"
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
