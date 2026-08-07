import Image from "next/image";
import Link from "next/link";

import { BannerSlideshow } from "@/components/BannerSlideshow";
import { ProductArt } from "@/components/ProductArt";
import { bannerRatio, type Banner } from "@/lib/banners";
import { euro } from "@/lib/format";
import type { Product } from "@/lib/types";

/**
 * De etalage bovenaan de homepage: grote banner links, vier tegels rechts.
 *
 * Kevin wil de indeling van bol: "banner grote links dan rechts producten en
 * daaronder banners voor kleinere acties", en "mobiel ook zo". Dat laatste is
 * het eigenlijke punt — op een telefoon staat bij bol dezelfde vorm, alleen
 * kleiner: de banner blijft links staan en de tegels blijven ernaast. Zou de
 * banner op mobiel over de volle breedte gaan, dan is de eerste helft van het
 * scherm één plaatje en moet je scrollen voordat je iets kunt kopen.
 *
 * Vandaar één raster voor alle schermen: twee kolommen, de banner in de
 * linker, vier tegels in de rechter. Alleen de maten verschillen.
 *
 * De tegels komen bij voorkeur uit de bannertool (`formaat: "tegel"`), zodat
 * Kevin er zelf een actie kan neerzetten. Kent het dashboard dat formaat nog
 * niet, of staan er minder dan vier klaar, dan vullen actieproducten uit de
 * catalogus de rest aan. Zo staat er nooit een gat.
 */
export function Etalage({
  groteBanners,
  tegelBanners,
  producten,
}: {
  groteBanners: Banner[];
  tegelBanners: Banner[];
  producten: Product[];
}) {
  const tegels = tegelBanners.slice(0, 4);
  const aanvullen = producten.slice(0, 4 - tegels.length);

  // Geen banner? Dan is een halve etalage erger dan geen: dan krijgen de
  // producten gewoon de volle breedte in het blok eronder.
  if (groteBanners.length === 0 && tegels.length === 0) return null;

  return (
    <section aria-label="Uitgelicht" className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-[1.1fr_1fr]">
      <BannerSlideshow banners={groteBanners} vullend />
      {/* Vier tegels in een blok van twee bij twee, op elk scherm. Zo houdt de
          rechterkolom dezelfde vorm als de banner ernaast. */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {tegels.map((banner) => (
          <TegelBanner key={banner.id} banner={banner} />
        ))}
        {aanvullen.map((product) => (
          <TegelProduct key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

function TegelBanner({ banner }: { banner: Banner }) {
  const ratio = bannerRatio(banner.breedte, banner.hoogte, "tegel", "desktop");
  const inhoud = (
    <>
      <div className="relative overflow-hidden" style={{ aspectRatio: ratio }}>
        <picture>
          {banner.mobielUrl && <source media="(max-width: 639px)" srcSet={banner.mobielUrl} />}
          <Image
            src={banner.desktopUrl}
            alt={banner.alt}
            width={banner.breedte ?? 600}
            height={banner.hoogte ?? 600}
            sizes="(max-width: 639px) 25vw, (max-width: 1023px) 25vw, 300px"
            quality={90}
            className="h-full w-full object-cover"
          />
        </picture>
      </div>
      {/* Dezelfde afspraak als bij de grote banner: de tekst ligt eróver en
          zit niet in het plaatje, zodat Kevin hem in de tool kan wijzigen. */}
      {(banner.kop || banner.subkop) && (
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-ink/80 via-ink/25 to-transparent p-2.5 sm:p-3">
          <div>
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
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="relative overflow-hidden rounded-xl shadow-card">
      {banner.link ? (
        <Link href={banner.link} className="block">
          {inhoud}
        </Link>
      ) : (
        inhoud
      )}
    </div>
  );
}

/**
 * Een actieproduct als tegel.
 *
 * Bewust niet de gewone ProductCard: die heeft varianten, een kluspasblok en
 * een knop, en dat is drie keer te veel voor een vak van een kwart scherm. Wat
 * hier telt is: wat is het, wat kost het, en hoeveel scheelt het.
 */
function TegelProduct({ product }: { product: Product }) {
  const korting =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round((1 - product.price / product.compareAtPrice) * 100)
      : 0;

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-xl bg-white shadow-card transition hover:shadow-lg"
    >
      {korting > 0 && (
        <span className="absolute left-1.5 top-1.5 z-10 rounded-md bg-brand-actie px-1.5 py-0.5 text-[11px] font-black text-white">
          −{korting}%
        </span>
      )}
      <div className="aspect-square">
        <ProductArt
          icon={product.art.icon}
          hue={product.art.hue}
          image={product.image}
          size="sm"
          label={product.name}
        />
      </div>
      <div className="flex flex-1 flex-col justify-between p-2 sm:p-2.5">
        {/* Twee regels en dan afkappen: anders duwt één lange titel de prijs
            uit het vak en staan de vier tegels niet meer gelijk. */}
        <p className="line-clamp-2 text-[11px] font-bold leading-snug text-ink group-hover:text-brand sm:text-xs">
          {product.name}
        </p>
        <p className="mt-1 flex items-baseline gap-1.5">
          <span className="text-sm font-black text-brand sm:text-base">{euro(product.price)}</span>
          {korting > 0 && product.compareAtPrice && (
            <span className="text-[11px] text-ink-soft line-through">
              {euro(product.compareAtPrice)}
            </span>
          )}
        </p>
      </div>
    </Link>
  );
}
