import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";
import { getLopendeActies } from "@/lib/actiepagina";
import { campagneStand, getCampagnes, type Campagne } from "@/lib/campagnes";
import { brandSlug, getProducts } from "@/lib/tilroy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Acties en aanbiedingen",
  description:
    "Alle lopende acties van De Voordeelmarkt op een rij: korting op verf, ijzerwaren en gereedschap.",
  alternates: { canonical: "/actie" },
};

const datum = (waarde: string) =>
  new Date(waarde).toLocaleDateString("nl-NL", { day: "numeric", month: "long" });

/**
 * Eén actiekaart.
 *
 * Het percentage is het grootste op de kaart, want dat is waar iemand op
 * scant. Daaronder pas waaróp, en daaronder de looptijd. Een kaart die met
 * "Alle Mack, Benson en Hofftech" begint laat de klant lezen; een kaart die
 * met "50%" begint laat hem kijken.
 */
function Actiekaart({ campagne, aantal }: { campagne: Campagne; aantal: number }) {
  const stand = campagneStand(campagne);
  const merk = campagne.merken?.[0];
  const href = campagne.href ?? (merk && aantal > 0 ? `/merk/${brandSlug(merk)}` : undefined);
  // Percentages zijn kort en mogen enorm; "5 halen, 3 betalen" moet passen.
  const kort = campagne.kop.length <= 5;

  const inhoud = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={`font-black leading-none text-white ${kort ? "text-5xl sm:text-6xl" : "text-2xl sm:text-3xl"}`}
        >
          {campagne.kop}
        </span>
        {stand === "nog-niet" && (
          <span className="shrink-0 rounded-md bg-white/20 px-2 py-1 text-xs font-bold text-white">
            vanaf {datum(campagne.van)}
          </span>
        )}
      </div>
      <p className="mt-3 font-bold leading-snug text-white">{campagne.waarop}</p>
      {campagne.klein && (
        <p className="mt-1 text-sm font-semibold text-white/80">{campagne.klein}</p>
      )}
      <p className="mt-auto pt-4 text-xs font-semibold text-white/70">
        Tot en met {datum(campagne.tot)}
        {aantal > 0 && ` · ${aantal} artikelen`}
      </p>
      {href && (
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-black text-white underline-offset-4 group-hover:underline">
          Bekijken <Icon name="chevron-right" className="h-4 w-4" />
        </span>
      )}
    </>
  );

  const stijl =
    "group flex min-h-[13rem] flex-col rounded-2xl bg-brand-actie p-5 shadow-card transition";

  return href ? (
    <Link href={href} className={`${stijl} hover:-translate-y-0.5 hover:shadow-lift`}>
      {inhoud}
    </Link>
  ) : (
    <div className={stijl}>{inhoud}</div>
  );
}

export default async function ActieOverzicht() {
  const [campagnes, paginas, producten] = await Promise.all([
    getCampagnes(),
    getLopendeActies(),
    getProducts(),
  ]);

  // Aantal artikelen per campagne, zodat de kaart concreet is in plaats van
  // een belofte. Nul betekent: dat merk staat (nog) niet in de catalogus —
  // dan geen knop, want die zou naar een lege pagina gaan.
  const perMerk = new Map<string, number>();
  for (const product of producten) {
    const merk = (product.brand ?? "").trim().toLowerCase();
    if (merk) perMerk.set(merk, (perMerk.get(merk) ?? 0) + 1);
  }
  const telling = (campagne: Campagne) =>
    (campagne.merken ?? []).reduce((som, merk) => som + (perMerk.get(merk.toLowerCase()) ?? 0), 0);

  const lopen = campagnes.filter((c) => campagneStand(c) === "loopt");
  const komen = campagnes.filter((c) => campagneStand(c) === "nog-niet");

  return (
    <div className="space-y-10">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Acties" }]} />

      <header>
        <h1 className="text-3xl font-black uppercase text-ink sm:text-4xl">Acties</h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-soft">
          Alles wat er nu in de aanbieding is. De korting is al in de prijs
          verwerkt — je hoeft niets in te vullen, en hij geldt voor iedereen.
        </p>
      </header>

      {lopen.length > 0 && (
        <section aria-labelledby="loopt-nu">
          <h2 id="loopt-nu" className="sr-only">
            Nu geldig
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lopen.map((campagne) => (
              <Actiekaart key={campagne.id} campagne={campagne} aantal={telling(campagne)} />
            ))}
          </div>
        </section>
      )}

      {komen.length > 0 && (
        <section aria-labelledby="binnenkort">
          {/* Geplande acties tonen we bewust. De uitingen gaan eerder de deur
              uit dan de actie ingaat; een klant die dan kijkt en niets ziet,
              denkt dat het niet klopt. */}
          <h2 id="binnenkort" className="mb-4 text-2xl font-black uppercase text-ink sm:text-3xl">
            Binnenkort
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {komen.map((campagne) => (
              <Actiekaart key={campagne.id} campagne={campagne} aantal={telling(campagne)} />
            ))}
          </div>
        </section>
      )}

      {paginas.length > 0 && (
        <section aria-labelledby="uitgelicht">
          <h2 id="uitgelicht" className="mb-4 text-2xl font-black uppercase text-ink sm:text-3xl">
            Uitgelicht
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {paginas.map((actie) => (
              <li key={actie.slug}>
                <Link
                  href={`/actie/${actie.slug}`}
                  className="card block h-full p-5 transition hover:border-brand"
                >
                  <h3 className="font-black text-ink">{actie.titel}</h3>
                  {actie.intro && <p className="mt-1 text-sm text-ink-soft">{actie.intro}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lopen.length === 0 && komen.length === 0 && paginas.length === 0 && (
        <div className="card p-6">
          <p className="text-ink-soft">
            Er loopt op dit moment geen actie. In onze{" "}
            <Link href="/#topdeals" className="font-bold text-brand hover:underline">
              topdeals
            </Link>{" "}
            staan wel altijd artikelen met voordeel.
          </p>
        </div>
      )}

      <p className="text-sm text-ink-soft">
        Acties gelden zolang de voorraad strekt en zijn niet te combineren met de
        Kluspas- of ProfPas-korting — de actieprijs is al de laagste prijs.
      </p>
    </div>
  );
}
