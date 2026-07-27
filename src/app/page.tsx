import Link from "next/link";

import { CategoryCard } from "@/components/CategoryCard";
import { ProductCard } from "@/components/ProductCard";
import { popularRalCodes, ralColors } from "@/lib/ral";
import { getCategories, getProducts, getStores } from "@/lib/tilroy";

const HIGHLIGHTS = [
  {
    icon: "🏷️",
    title: "Elke dag lage prijzen",
    text: "Topkwaliteit voor bodemprijzen, zonder gedoe met spaaracties.",
  },
  {
    icon: "🏬",
    title: "Gratis afhalen",
    text: "Bestel online en haal gratis op in een van onze 6 winkels.",
  },
  {
    icon: "🎨",
    title: "Verf op kleur",
    text: "Meer dan 140 RAL-kleuren, gratis gemengd terwijl je wacht.",
  },
  {
    icon: "🔒",
    title: "Veilig betalen",
    text: "iDEAL, Bancontact, creditcard of Apple Pay via Mollie.",
  },
];

export default async function HomePage() {
  const [products, categories, stores] = await Promise.all([
    getProducts(),
    getCategories(),
    getStores(),
  ]);
  const deals = products
    .filter((product) => product.compareAtPrice && product.compareAtPrice > product.price)
    .slice(0, 4);
  const swatches = popularRalCodes
    .map((code) => ralColors.find((color) => color.code === code))
    .filter((color): color is NonNullable<typeof color> => Boolean(color));

  return (
    <div className="space-y-14">
      {/* Hero */}
      <section className="overflow-hidden rounded-2xl bg-ink text-white">
        <div className="grid items-center gap-8 p-8 sm:p-12 lg:grid-cols-2">
          <div>
            <p className="inline-block -skew-x-6 rounded-md bg-brand px-3 py-1 text-sm font-black uppercase text-white">
              Vandaag besteld, vaak vandaag al klaar
            </p>
            <h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">
              Klussen voor <span className="text-accent">weinig.</span>
            </h1>
            <p className="mt-4 max-w-md text-lg text-white/80">
              Verf gemengd op elke RAL-kleur, gereedschap en alles voor huis &amp;
              tuin. Bestel online, betaal veilig en haal gratis op in de winkel.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="#topdeals" className="btn btn-accent">
                Bekijk de topdeals
              </Link>
              <Link
                href="/kleurkiezer"
                className="btn border-2 border-white/25 text-white hover:border-accent hover:text-accent"
              >
                🎨 Kies je kleur
              </Link>
            </div>
          </div>
          <div className="relative hidden justify-center lg:flex" aria-hidden>
            <div className="rotate-6 rounded-2xl bg-accent p-8 text-center shadow-lift">
              <p className="text-6xl font-black italic text-brand">−50%</p>
              <p className="mt-1 text-lg font-black uppercase text-ink">Tot wel 50% voordeel</p>
              <p className="text-sm font-semibold text-ink/70">op honderden artikelen</p>
            </div>
            <div className="absolute -bottom-4 -left-2 -rotate-3 rounded-xl bg-white px-5 py-3 shadow-lift">
              <p className="font-black text-ink">
                🎨 140+ RAL-kleuren <span className="text-brand">gratis gemengd</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* USP's */}
      <section aria-label="Waarom De Voordeelmarkt" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {HIGHLIGHTS.map((highlight) => (
          <div key={highlight.title} className="card p-5">
            <p className="text-3xl" aria-hidden>
              {highlight.icon}
            </p>
            <h2 className="mt-2 font-black text-ink">{highlight.title}</h2>
            <p className="mt-1 text-sm text-ink-soft">{highlight.text}</p>
          </div>
        ))}
      </section>

      {/* Topdeals */}
      <section id="topdeals" aria-labelledby="topdeals-titel">
        <div className="mb-5 flex items-end justify-between">
          <h2 id="topdeals-titel" className="text-2xl font-black uppercase italic text-ink sm:text-3xl">
            🔥 Topdeals van de week
          </h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {deals.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* Kleurkiezer-banner */}
      <section className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/5">
        <div className="grid items-center gap-6 p-8 lg:grid-cols-[1fr_auto]">
          <div>
            <h2 className="text-2xl font-black uppercase italic text-ink sm:text-3xl">
              Verf in <span className="text-brand">elke kleur</span> die je wilt
            </h2>
            <p className="mt-2 max-w-2xl text-ink-soft">
              Kies uit meer dan 140 RAL-kleuren met onze online kleurkiezer. Wij
              mengen je muurverf of lak gratis in de winkel — staat klaar als jij
              je bestelling komt afhalen.
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5" aria-hidden>
              {swatches.map((color) => (
                <span
                  key={color.code}
                  title={`RAL ${color.code} ${color.name}`}
                  className="h-8 w-8 rounded-md ring-1 ring-black/10"
                  style={{ backgroundColor: color.hex }}
                />
              ))}
            </div>
          </div>
          <Link href="/kleurkiezer" className="btn btn-primary whitespace-nowrap">
            Open de kleurkiezer →
          </Link>
        </div>
      </section>

      {/* Categorieën */}
      <section aria-labelledby="categorieen-titel">
        <h2 id="categorieen-titel" className="mb-5 text-2xl font-black uppercase italic text-ink sm:text-3xl">
          Shop per categorie
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <CategoryCard key={category.slug} category={category} />
          ))}
        </div>
      </section>

      {/* Winkels */}
      <section aria-labelledby="winkels-titel" className="rounded-2xl bg-accent-light p-8">
        <h2 id="winkels-titel" className="text-2xl font-black uppercase italic text-ink">
          Gratis afhalen in {stores.length} winkels
        </h2>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Bestel vóór 16:00 en je bestelling staat meestal dezelfde dag nog voor
          je klaar. Je ontvangt een afhaalcode zodra alles klaarstaat.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {stores.map((store) => (
            <Link
              key={store.id}
              href={`/winkels/${store.slug}`}
              className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ink shadow-sm transition hover:text-brand"
            >
              📍 {store.city}
            </Link>
          ))}
        </div>
      </section>

      {/* SEO-tekst */}
      <section className="prose-sm max-w-3xl text-ink-soft">
        <h2 className="text-xl font-black text-ink">
          De Voordeelmarkt: dé bouwmarkt-discounter van Zeeland
        </h2>
        <p className="mt-3 leading-relaxed">
          Bij De Voordeelmarkt vind je alles voor het klussen in en om het huis
          voor de laagste prijs: muurverf en lak (gemengd op elke gewenste
          RAL-kleur), elektrisch gereedschap, tuinartikelen, verlichting en
          bevestigingsmateriaal. Door slim in te kopen en zonder poespas te
          verkopen, betaal jij elke dag bodemprijzen.
        </p>
        <p className="mt-3 leading-relaxed">
          Online bestellen is zo gedaan: kies je producten, reken veilig af met
          iDEAL, Bancontact, creditcard of Apple Pay en haal je bestelling
          gratis op in de winkel bij jou in de buurt — in Goes, Middelburg,
          Vlissingen, Terneuzen, Zierikzee of Hulst. Vandaag besteld is vaak
          vandaag nog klaar.
        </p>
      </section>
    </div>
  );
}
