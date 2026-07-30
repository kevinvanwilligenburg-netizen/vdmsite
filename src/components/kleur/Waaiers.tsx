import Link from "next/link";

import { waaierNaam } from "@/components/kleur/waaier";
import type { ColorCollection } from "@/lib/colors";

/**
 * Alle kleurwaaiers als bladerbare lijst.
 *
 * Ze zaten alleen in een keuzelijst binnen de kleurkiezer, en dan zie je niet
 * wát er te kiezen valt: dat we naast RAL ook Sikkens, Flexa, Histor,
 * Benjamin Moore en NCS mengen is precies het argument om hier te bestellen
 * in plaats van bij de bouwmarkt. Een lijst met aantallen laat dat in één
 * oogopslag zien — en levert per waaier een eigen ingang op.
 *
 * De grote waaiers eerst; de lange staart van kleine collecties staat
 * daaronder en is even goed bereikbaar.
 */
export function Waaiers({ collections }: { collections: ColorCollection[] }) {
  if (collections.length === 0) return null;
  const gesorteerd = [...collections].sort((a, b) => b.count - a.count);

  return (
    <section aria-labelledby="waaiers-titel">
      <h2 id="waaiers-titel" className="text-xl font-black uppercase text-ink sm:text-2xl">
        Onze kleurwaaiers
      </h2>
      <p className="mt-1 text-ink-soft">
        Elke kleur uit deze waaiers mengen we gratis aan, in de verf die jij
        kiest.
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {gesorteerd.map((collection) => (
          <li key={collection.id}>
            <Link
              href={`/kleurkiezer?waaier=${encodeURIComponent(collection.id)}#kleuren`}
              className="flex items-baseline justify-between gap-3 rounded-xl border-2 border-ink/10 px-4 py-2.5 transition hover:border-brand hover:text-brand"
            >
              <span className="truncate font-bold text-ink">{waaierNaam(collection)}</span>
              <span className="shrink-0 text-sm font-semibold text-ink-soft">
                {collection.count.toLocaleString("nl-NL")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
