import Link from "next/link";

import { CategoryCard } from "@/components/CategoryCard";
import { Icon } from "@/components/icons";
import { ProductCard } from "@/components/ProductCard";
import { getBanner } from "@/lib/content";
import { popularRalCodes, ralColors } from "@/lib/ral";
import { getCategories, getDeals, getStores } from "@/lib/tilroy";

export const revalidate = 3600;

const HIGHLIGHTS = [
  {
    icon: "tag",
    title: "Elke dag lage prijzen",
    text: "Topkwaliteit voor bodemprijzen, zonder gedoe met spaaracties.",
  },
  {
    icon: "palette",
    title: "Verf mengen in elke kleur",
    text: "140+ RAL-kleuren, gratis gemengd — klaar terwijl je wacht.",
  },
  {
    icon: "truck",
    title: "Vóór 10:00 besteld, vandaag in huis",
    text: "Daarna besteld? Dan bezorgen we morgen. Bezorgen is gratis.",
  },
  {
    icon: "store",
    title: "Click & Collect",
    text: "Liever afhalen? Gratis in een van onze 5 winkels, vaak dezelfde dag.",
  },
];

export default async function HomePage() {
  const [deals, categories, stores, banner] = await Promise.all([
    getDeals(8),
    getCategories(),
    getStores(),
    getBanner("home-hero"),
  ]);
  const swatches = popularRalCodes
    .map((code) => ralColors.find((color) => color.code === code))
    .filter((color): color is NonNullable<typeof color> => Boolean(color));

  const heroTitle = banner?.title ?? "De beste verf voor de laagste prijs.";
  const heroSubtitle =
    banner?.subtitle ??
    "Mengverf in elke RAL-kleur, gereedschap en alles om te klussen. Vóór 10:00 besteld = vandaag bezorgd, of haal gratis af in de winkel.";
  const heroBadge = banner?.badge ?? "Vóór 10:00 besteld, vandaag bezorgd";
  const heroCtaLabel = banner?.ctaLabel ?? "Bekijk de topdeals";
  const heroCtaHref = banner?.ctaHref ?? "#topdeals";

  return (
    <div className="space-y-14">
      {/* Hero (oranje, in de stijl van de actiebanners van devoordeelmarkt.nl) */}
      <section className="overflow-hidden rounded-2xl shadow-card">
        <div
          className="relative bg-gradient-to-br from-brand-bright to-brand"
          style={
            banner?.imageUrl
              ? {
                  backgroundImage: `linear-gradient(100deg, rgba(20,20,20,0.82) 0%, rgba(20,20,20,0.45) 55%, rgba(20,20,20,0.15) 100%), url(${banner.imageUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          <div className="grid items-center gap-8 p-8 sm:p-12 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <p className="inline-block rounded-md bg-ink px-3 py-1.5 text-sm font-black uppercase text-white">
                {heroBadge}
              </p>
              <h1 className="mt-4 text-4xl font-black leading-tight text-white sm:text-5xl">
                {heroTitle}
              </h1>
              <p className="mt-4 max-w-xl text-lg font-semibold text-white/90">
                {heroSubtitle}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href={heroCtaHref} className="btn btn-dark">
                  {heroCtaLabel} →
                </Link>
                <Link
                  href="/kleurkiezer"
                  className="btn bg-white text-ink shadow-sm hover:bg-white/90"
                >
                  Kies je RAL-kleur
                </Link>
              </div>
            </div>
            {!banner?.imageUrl && (
              <div className="relative hidden justify-center lg:flex" aria-hidden>
                <div className="rotate-3 rounded-2xl bg-white p-8 text-center shadow-lift">
                  <p className="text-6xl font-black text-brand">−50%</p>
                  <p className="mt-1 text-lg font-black uppercase text-ink">
                    Tot wel 50% voordeel
                  </p>
                  <p className="text-sm font-semibold text-ink-soft">
                    op honderden artikelen
                  </p>
                </div>
                <div className="absolute -bottom-4 -left-4 -rotate-3 rounded-xl bg-ink px-5 py-3 shadow-lift">
                  <p className="font-black text-white">
                    140+ RAL-kleuren{" "}
                    <span className="text-brand-bright">gratis gemengd</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Zwarte onderbalk, zoals op de actiebanners */}
        <div className="flex items-center justify-center gap-6 bg-ink px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white sm:justify-between sm:px-8">
          <span>Vandaag of morgen bezorgd</span>
          <span className="hidden sm:inline">Gratis afhalen in de winkel</span>
          <span className="hidden md:inline">Verf op kleur gemengd</span>
          <span className="text-brand-bright">devoordeelmarkt.nl</span>
        </div>
      </section>

      {/* USP's */}
      <section aria-label="Waarom De Voordeelmarkt" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {HIGHLIGHTS.map((highlight) => (
          <div key={highlight.title} className="card p-5">
            <span className="inline-flex text-brand" aria-hidden>
              <Icon name={highlight.icon} className="h-8 w-8" strokeWidth={1.8} />
            </span>
            <h2 className="mt-2 font-black text-ink">{highlight.title}</h2>
            <p className="mt-1 text-sm text-ink-soft">{highlight.text}</p>
          </div>
        ))}
      </section>

      {/* Topdeals */}
      <section id="topdeals" aria-labelledby="topdeals-titel">
        <div className="mb-5 flex items-end justify-between">
          <h2 id="topdeals-titel" className="text-2xl font-black uppercase text-ink sm:text-3xl">
            Topdeals van de week
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {deals.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* Duo-banners (oranje + zwart, zoals Kluspas/Profpas op de huidige site) */}
      <section className="grid gap-5 lg:grid-cols-2" aria-label="Uitgelicht">
        <div className="flex flex-col items-start gap-4 rounded-2xl bg-gradient-to-br from-brand-bright to-brand p-8 text-white shadow-card">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-black uppercase tracking-wide">
            Kleurkiezer
          </span>
          <h2 className="text-2xl font-black sm:text-3xl">
            Verf in élke kleur die je wilt
          </h2>
          <p className="font-semibold text-white/90">
            Kies online uit 140+ RAL-kleuren. Wij mengen je verf gratis in de
            winkel — vandaag besteld is vaak vandaag al onderweg.
          </p>
          <div className="flex flex-wrap gap-1.5" aria-hidden>
            {swatches.slice(0, 10).map((color) => (
              <span
                key={color.code}
                title={`RAL ${color.code} ${color.name}`}
                className="h-7 w-7 rounded-md ring-2 ring-white/40"
                style={{ backgroundColor: color.hex }}
              />
            ))}
          </div>
          <Link href="/kleurkiezer" className="btn btn-dark mt-auto">
            Open de kleurkiezer →
          </Link>
        </div>
        <div className="flex flex-col items-start gap-4 rounded-2xl bg-ink p-8 text-white shadow-card">
          <span className="rounded-full bg-brand px-3 py-1 text-xs font-black uppercase tracking-wide">
            Bezorgen of afhalen
          </span>
          <h2 className="text-2xl font-black sm:text-3xl">
            Vandaag besteld, vandaag in huis
          </h2>
          <p className="font-semibold text-white/80">
            Bestel vóór 10:00 en we bezorgen je bestelling vandaag nog — daarna
            morgen. Liever zelf ophalen? Dat kan gratis in Nijverdal,
            Apeldoorn, Deventer, Zutphen en Emmen.
          </p>
          <Link
            href="/winkels"
            className="btn mt-auto bg-brand text-white shadow-sm hover:bg-brand-dark"
          >
            Bekijk onze winkels →
          </Link>
        </div>
      </section>

      {/* Categorieën */}
      <section aria-labelledby="categorieen-titel">
        <h2 id="categorieen-titel" className="mb-5 text-2xl font-black uppercase text-ink sm:text-3xl">
          Shop per categorie
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <CategoryCard key={category.slug} category={category} />
          ))}
        </div>
      </section>

      {/* Winkels */}
      <section aria-labelledby="winkels-titel" className="rounded-2xl bg-brand-light p-8">
        <h2 id="winkels-titel" className="text-2xl font-black uppercase text-ink">
          Gratis afhalen in {stores.length} winkels
        </h2>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Vandaag besteld? Dan staat je bestelling er meestal dezelfde dag nog
          klaar. Je ontvangt een afhaalcode zodra alles klaarstaat.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {stores.map((store) => (
            <Link
              key={store.id}
              href={`/winkels/${store.slug}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-ink shadow-sm transition hover:text-brand"
            >
              <Icon name="pin" className="h-4 w-4 text-brand" /> {store.city}
            </Link>
          ))}
        </div>
      </section>

      {/* SEO-tekst */}
      <section className="max-w-3xl text-ink-soft">
        <h2 className="text-xl font-black text-ink">
          De Voordeelmarkt: de verfdiscounter van Oost-Nederland
        </h2>
        <p className="mt-3 leading-relaxed">
          Bij De Voordeelmarkt draait alles om de beste verf voor de laagste
          prijs. Muurverf, lak, grondverf en beits mengen we gratis op elke
          gewenste RAL-kleur, terwijl je wacht. Daarnaast vind je in onze
          winkels gereedschap, elektra, tuinartikelen en huishoudelijke
          producten — allemaal voor bodemprijzen, elke dag opnieuw.
        </p>
        <p className="mt-3 leading-relaxed">
          Online bestellen is zo gedaan: kies je producten en reken veilig af
          met iDEAL, Bancontact, creditcard of Apple Pay. Bestel je vóór 10:00,
          dan wordt je bestelling vandaag nog bezorgd; daarna komt hij morgen.
          Afhalen kan ook — gratis, in Nijverdal, Apeldoorn, Deventer, Zutphen
          of Emmen.
        </p>
      </section>
    </div>
  );
}
