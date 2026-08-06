import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ProductCard } from "@/components/ProductCard";
import { actieLoopt, actieStand, getActiepagina, vulBlokken } from "@/lib/actiepagina";

/**
 * Een actiepagina: teksten en producten door elkaar.
 *
 * Inhoud komt uit KV (beheerd in het dashboard), dus altijd vers renderen —
 * een actie gaat aan op een moment dat Kevin kiest, niet wanneer een cache
 * toevallig verloopt.
 */
export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const pagina = await getActiepagina(params.slug);
  if (!pagina) return {};
  return {
    title: pagina.titel,
    description: pagina.intro ?? undefined,
    alternates: { canonical: `/actie/${pagina.slug}` },
    // Een afgelopen actie mag blijven bestaan (een link uit een mailing moet
    // ergens uitkomen) maar hoort niet in Google te staan als lopende actie.
    ...(actieLoopt(pagina) ? {} : { robots: { index: false, follow: true } }),
  };
}

/** Lege regel = alinea, regel met "## " = tussenkop. Zelfde als /info. */
function alineas(tekst: string) {
  return tekst
    .split(/\r?\n\r?\n/)
    .map((blok) => blok.trim())
    .filter(Boolean)
    .map((blok, index) =>
      blok.startsWith("## ") ? (
        <h3 key={index} className="mt-6 text-lg font-black text-ink">
          {blok.slice(3)}
        </h3>
      ) : (
        <p key={index} className="mt-3 leading-relaxed text-ink-soft">
          {blok}
        </p>
      ),
    );
}

export default async function Actiepagina({ params }: Props) {
  const pagina = await getActiepagina(params.slug);
  if (!pagina) notFound();

  const stand = actieStand(pagina);
  const loopt = stand === "loopt";
  const blokken = await vulBlokken(pagina.blokken);
  const datum = (waarde?: string) =>
    waarde
      ? new Date(waarde).toLocaleDateString("nl-NL", { day: "numeric", month: "long" })
      : "";

  return (
    <div className="space-y-10">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: pagina.titel }]} />

      {pagina.bannerUrl && (
        /* Geen vaste verhouding: net als bij de homepagebanners snijdt dat de
           tekst uit het plaatje. De banner bepaalt zelf zijn hoogte. */
        <div className="overflow-hidden rounded-2xl shadow-card">
          <Image
            src={pagina.bannerUrl}
            alt={pagina.bannerAlt || pagina.titel}
            width={1600}
            height={640}
            priority
            sizes="(max-width: 767px) 100vw, 1280px"
            quality={90}
            className="h-auto w-full"
          />
        </div>
      )}

      <header>
        <h1 className="text-3xl font-black uppercase text-ink sm:text-4xl">{pagina.titel}</h1>
        {pagina.intro && (
          <p className="mt-3 max-w-3xl text-lg font-semibold text-ink-soft">{pagina.intro}</p>
        )}
        {/*
          Een afgelopen actie zeggen we hardop. Hem stilletjes tonen met de
          oude prijzen erbij is precies waar een klant boos over belt — en de
          prijzen op de kaarten komen uit de catalogus, dus die zijn dan al
          terug naar normaal terwijl de pagina nog "actie" roept.
        */}
        {stand === "afgelopen" && (
          <p className="mt-4 rounded-lg border-2 border-ink/10 bg-ink/5 px-4 py-3 text-sm font-bold text-ink">
            Deze actie is afgelopen. De artikelen hieronder staan er nog, tegen de
            prijs van nu.
          </p>
        )}
        {/* Een actie die nog moet beginnen is iets heel anders dan een die
            voorbij is. Allebei "afgelopen" noemen — wat hier eerst gebeurde,
            omdat er maar één vlag was — jaagt iemand weg die net op tijd is. */}
        {stand === "nog-niet" && (
          <p className="mt-4 rounded-lg border-2 border-brand/30 bg-brand-light px-4 py-3 text-sm font-bold text-ink">
            Deze actie begint op {datum(pagina.van)}. De prijzen hieronder zijn de
            prijzen van nu.
          </p>
        )}
        {loopt && pagina.tot && (
          <p className="mt-4 text-sm font-bold text-brand-dark">
            Nog geldig tot en met {datum(pagina.tot)}.
          </p>
        )}
      </header>

      {blokken.map((blok, index) => {
        if (blok.soort === "tekst") {
          return (
            <section key={index} className="mx-auto w-full max-w-3xl">
              {blok.kop && <h2 className="text-2xl font-black text-ink">{blok.kop}</h2>}
              {alineas(blok.tekst)}
            </section>
          );
        }
        // Een blok zonder producten (alles uit het assortiment, of een sku die
        // niet meer bestaat) laten we weg in plaats van een lege kop te tonen.
        if (blok.producten.length === 0) return null;
        return (
          <section key={index} aria-labelledby={`blok-${index}`}>
            {blok.kop && (
              <h2 id={`blok-${index}`} className="mb-2 text-2xl font-black uppercase text-ink sm:text-3xl">
                {blok.kop}
              </h2>
            )}
            {blok.tekst && <p className="mb-5 max-w-3xl text-ink-soft">{blok.tekst}</p>}
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {blok.producten.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
