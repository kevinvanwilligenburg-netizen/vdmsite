import Link from "next/link";

import { ProductArt } from "@/components/ProductArt";
import type { Product } from "@/lib/types";

/**
 * Dit artikel in een andere kleur, als kiezer bij de prijs.
 *
 * Spuitbussen, glitterlak en dat soort artikelen zijn in de kassa per kleur
 * een eigen product; er is geen kleurkiezer zoals bij mengverf. Zonder deze
 * rij loopt de groene bus dood en ziet niemand dat er ook goud, koper en
 * zilver is.
 *
 * Boven de prijs en niet onderaan de pagina, want dat is waar een klant een
 * kleurkeuze verwacht — Kevin: "kan je ook in deze kleuren boven de prijs met
 * kleine vierkant als een soort variant kiezer?", met bol als voorbeeld.
 *
 * Elk vierkant is gewoon een link naar dat product. Geen keuzemenu dat state
 * bijhoudt: het zijn losse artikelen met een eigen prijs, voorraad en
 * bestelnummer, en dat verzwijgen zou de voorraadmelding en de bezorgbelofte
 * op het verkeerde artikel laten slaan.
 */
export function KleurBroers({
  huidige,
  broers,
}: {
  huidige: Product;
  broers: Product[];
}) {
  if (broers.length === 0) return null;
  const kleurVan = (product: Product) =>
    product.attributes?.kleur?.trim() || product.name;

  return (
    <section aria-labelledby="kleurkeuze-titel">
      <p id="kleurkeuze-titel" className="text-sm font-bold text-ink">
        Kies je kleur:{" "}
        <span className="font-semibold text-ink-soft">{kleurVan(huidige)}</span>
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {[huidige, ...broers].map((product) => {
          const isHuidige = product.id === huidige.id;
          const kleur = kleurVan(product);
          return (
            <li key={product.id}>
              {/* Het huidige artikel blijft in de rij staan zodat de klant ziet
                  wélke van de kleuren hij nu bekijkt, maar is geen link naar
                  zichzelf. */}
              {isHuidige ? (
                <span
                  aria-current="true"
                  title={kleur}
                  className="block h-12 w-12 overflow-hidden rounded-lg ring-2 ring-brand ring-offset-2"
                >
                  <ProductArt
                    icon={product.art.icon}
                    hue={product.art.hue}
                    image={product.image}
                    size="sm"
                    label={kleur}
                  />
                </span>
              ) : (
                <Link
                  href={`/product/${product.slug}`}
                  title={kleur}
                  aria-label={`Bekijk in ${kleur}`}
                  className="block h-12 w-12 overflow-hidden rounded-lg ring-1 ring-ink/15 transition hover:ring-2 hover:ring-brand"
                >
                  <ProductArt
                    icon={product.art.icon}
                    hue={product.art.hue}
                    image={product.image}
                    size="sm"
                    label={kleur}
                  />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
