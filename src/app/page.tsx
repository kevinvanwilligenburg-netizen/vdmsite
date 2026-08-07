import Link from "next/link";

import { CategoryCard } from "@/components/CategoryCard";
import { Icon } from "@/components/icons";
import { ProductCard } from "@/components/ProductCard";
import { TrustpilotWidget } from "@/components/TrustpilotWidget";
import { KleineBanners } from "@/components/KleineBanners";
import { Etalage } from "@/components/home/Etalage";
import { getBanners } from "@/lib/banners";
import { getBanner } from "@/lib/content";
import { popularRalCodes, ralColors } from "@/lib/ral";
import { getDeals, getMerkEtalage, getNavCategories, getStores } from "@/lib/tilroy";

export const revalidate = 3600;

/**
 * De homepage was de enige pagina zonder canonical. Juist bij een
 * domeinverhuizing telt dat: zonder canonical kan Google een variant met
 * parameters (een campagne-URL, ?fbclid=…) als eigen pagina behandelen en
 * verdeelt de waarde zich over meerdere adressen. De titel staat in de
 * layout; hier alleen het canonieke adres.
 */
export const metadata = {
  alternates: { canonical: "/" },
};

const HIGHLIGHTS = [
  {
    icon: "tag",
    title: "Elke dag lage prijzen",
    text: "Topkwaliteit voor bodemprijzen, zonder gedoe met spaaracties.",
  },
  {
    icon: "palette",
    title: "Verf mengen in elke kleur",
    text: "140+ RAL-kleuren, gratis gemengd, klaar terwijl je wacht.",
  },
  {
    icon: "truck",
    title: "Snel in huis",
    text: "Uit ons webshopmagazijn vóór 09:00 besteld = op werkdagen vandaag bezorgd, anders morgen in huis.",
  },
  {
    icon: "store",
    title: "Click & Collect",
    text: "Liever afhalen? Gratis in een van onze 5 winkels, vaak dezelfde dag.",
  },
];

export default async function HomePage() {
  const [deals, sikkens, categories, stores, banner, banners] = await Promise.all([
    getDeals(8),
    getMerkEtalage("Sikkens", 4),
    // Dezelfde selectie als het menu: rubrieken die groot genoeg zijn en écht
    // een rubriek. Op de volledige lijst stond "Euromat" — een leverancier —
    // als kaart tussen Verf en Beits en Gereedschap.
    getNavCategories(12),
    getStores(),
    getBanner("home-hero"),
    getBanners(),
  ]);
  const swatches = popularRalCodes
    .map((code) => ralColors.find((color) => color.code === code))
    .filter((color): color is NonNullable<typeof color> => Boolean(color));

  const heroTitle = banner?.title ?? "De beste verf voor de laagste prijs.";
  const heroSubtitle =
    banner?.subtitle ??
    "Mengverf in elke kleur, gereedschap en alles om te klussen. Gratis bezorgd of gratis afgehaald in de winkel, en verf mengen we gratis.";
  // Groot bovenaan, klein in het rijtje eronder. Het dashboard kent dat
  // onderscheid nog niet, dus tot die tijd is alles groot en blijft het rijtje
  // leeg — beter een lege plek dan een kleine banner op een grote plaats.
  const groteBanners = banners.filter((item) => item.formaat === "groot");
  const tegelBanners = banners.filter((item) => item.formaat === "tegel");
  const kleineBanners = banners.filter((item) => item.formaat === "klein");

  const heroCtaLabel = banner?.ctaLabel ?? "Bekijk de topdeals";
  const heroCtaHref = banner?.ctaHref ?? "#topdeals";

  return (
    <div className="space-y-14">
      {/*
        De indeling die Kevin wil: bovenaan de grote bannerslideshow, daaronder
        plek voor twee kleine banners, en dan meteen de actieproducten.

        De oranje hero die hier stond is eruit. Die was zelf een actiebanner in
        de stijl van de oude site, en twee actiebanners boven elkaar vechten om
        dezelfde aandacht.

        Wat er wél moest blijven: de h1. Zonder die kop heeft de belangrijkste
        pagina van de winkel geen onderwerp meer voor Google, en dat merk je
        pas als de posities al weg zijn. Daarom hieronder een smalle regel in
        plaats van het hele oranje blok.
      */}
      {/* De etalage: grote banner links, vier tegels rechts, en daaronder de
          strook met kleinere acties. De indeling die Kevin wilde, naar het
          voorbeeld van bol — en met opzet dezelfde vorm op een telefoon.

          Ze horen bij elkaar en staan daarom in één blok. Los in het
          `space-y-14`-ritme van de pagina zat er 56 px lucht tussen, en dat
          leest als twee losse dingen met een gat. Naar buiten toe houdt het
          blok die ruimte wél, want daaronder begint iets anders. */}
      <div className="space-y-2 sm:space-y-3">
        <Etalage
          groteBanners={groteBanners}
          tegelBanners={tegelBanners}
          producten={deals}
        />
        <KleineBanners banners={kleineBanners} />
      </div>
      {/* Smalle titelregel in plaats van het oranje heroblok: de homepage
          houdt zo een h1 en een zin die zegt wat we verkopen, zonder een
          tweede actiebanner naast die van Kevin. */}
      <section className="text-center">
        <h1 className="text-2xl font-black leading-tight text-ink sm:text-3xl">{heroTitle}</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-ink-soft sm:text-base">{heroSubtitle}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Link href={heroCtaHref} className="btn btn-primary">{heroCtaLabel} →</Link>
          <Link href="/kleurkiezer" className="btn border-2 border-ink/10 bg-white text-ink hover:border-brand hover:text-brand">Kies je RAL-kleur</Link>
        </div>
      </section>

      <TrustpilotWidget variant="carousel" className="py-1" />

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

      {/* Sikkens: het merk waar mensen speciaal voor komen, maar dat nooit in
          de aanbiedingen staat omdat er geen korting op zit. */}
      {sikkens.length >= 2 && (
        <section aria-labelledby="sikkens-titel">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                id="sikkens-titel"
                className="text-2xl font-black uppercase text-ink sm:text-3xl"
              >
                Sikkens bij De Voordeelmarkt
              </h2>
              <p className="mt-1 text-ink-soft">
                Professionele verf uit onze eigen winkel, gratis gemengd in elke
                kleur die je wilt.
              </p>
            </div>
            <Link
              href="/merk/sikkens"
              className="text-sm font-bold text-brand hover:underline"
            >
              Alle Sikkens →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {sikkens.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

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
            winkel, vóór 09:00 besteld is op werkdagen vandaag al onderweg.
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
            Snel in huis of zelf ophalen
          </h2>
          <p className="font-semibold text-white/80">
            Ligt je artikel in ons webshopmagazijn in Nijverdal, dan bezorgt DHL
            het op werkdagen vandaag nog bij bestelling vóór 09:00. Andere artikelen sturen
            we met PostNL binnen één werkdag. Ophalen kan altijd gratis.
          </p>
          <Link
            href="/winkels"
            className="btn mt-auto bg-brand text-white shadow-sm hover:bg-brand-dark"
          >
            Bekijk onze winkels →
          </Link>
        </div>
      </section>

      {/* Klusadvies: de vraag die klanten aan de balie stellen, nu ook online */}
      <section
        aria-labelledby="klusadvies-titel"
        className="flex flex-col items-start gap-4 rounded-2xl border-2 border-brand/20 bg-brand-light p-8 lg:flex-row lg:items-center lg:gap-8"
      >
        <div className="flex-1">
          <span className="rounded-full bg-brand px-3 py-1 text-xs font-black uppercase tracking-wide text-white">
            Nieuw
          </span>
          <h2
            id="klusadvies-titel"
            className="mt-3 text-2xl font-black uppercase text-ink sm:text-3xl"
          >
            Hoeveel verf heb ik nodig?
          </h2>
          <p className="mt-2 max-w-2xl font-semibold text-ink-soft">
            Beschrijf je klus in gewone taal, &ldquo;slaapkamer van 4 bij 3 meter, van
            donkerblauw naar wit&rdquo; en wij rekenen uit hoeveel liter je nodig hebt, of er
            grondverf bij moet en welke kwast of roller erbij hoort. In één klik in je mandje.
          </p>
        </div>
        <Link
          href="/klusadvies"
          className="btn shrink-0 bg-brand text-white shadow-sm hover:bg-brand-dark"
        >
          Bereken mijn klus →
        </Link>
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
          producten, allemaal voor bodemprijzen, elke dag opnieuw.
        </p>
        <p className="mt-3 leading-relaxed">
          Online bestellen is zo gedaan: kies je producten en reken veilig af
          met iDEAL, Bancontact, creditcard of Apple Pay. Artikelen uit ons
          webshopmagazijn in Nijverdal bezorgen we bij bestelling vóór 09:00
          (op werkdagen) dezelfde dag nog; de rest sturen we binnen één werkdag met PostNL.
          Afhalen kan ook, gratis, in Nijverdal, Apeldoorn, Deventer, Zutphen
          of Emmen.
        </p>
      </section>
    </div>
  );
}
