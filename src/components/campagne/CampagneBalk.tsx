import Link from "next/link";

import { campagneRaakt, campagneStand, getCampagnes, type Campagne } from "@/lib/campagnes";
import type { Product } from "@/lib/types";

/**
 * De lopende acties, daar waar de klant de artikelen ziet.
 *
 * Kevin op de merkpagina van Led's light: "ik mis hier ook de actie uitingen."
 * En terecht — die pagina vertelde wél dat 28 artikelen in de aanbieding zijn
 * en dat de kortingen tot 24% lopen, maar niet dat er 5 halen, 3 betalen op
 * staat. Dat is precies de actie waar de folder mee schermt.
 *
 * De aankondiging stond alleen op /actie. Wie via Google of het menu op een
 * merkpagina binnenkomt, kwam daar nooit langs.
 *
 * Alleen wat écht loopt. Een balk die "5 halen, 3 betalen" belooft terwijl de
 * staffelmotor niets doet, is precies het soort belofte waar deze reparatie
 * over ging.
 */
export async function CampagneBalk({
  producten,
  merk,
}: {
  /** De artikelen op deze pagina; bepaalt welke acties erbij horen. */
  producten: Product[];
  /** Merknaam, voor acties die op merk lopen maar hier geen artikel raken. */
  merk?: string;
}) {
  const campagnes = await getCampagnes();
  const naam = merk?.trim().toLowerCase();

  const passend = campagnes.filter((campagne) => {
    if (campagneStand(campagne) !== "loopt") return false;
    if (naam && (campagne.merken ?? []).some((m) => m.toLowerCase() === naam)) return true;
    return producten.some((product) => campagneRaakt(campagne, product));
  });

  if (passend.length === 0) return null;

  return (
    <section aria-label="Lopende acties" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      {passend.map((campagne) => (
        <Kaart key={campagne.id} campagne={campagne} />
      ))}
    </section>
  );
}

function Kaart({ campagne }: { campagne: Campagne }) {
  return (
    <Link
      href={`/actie/${campagne.id}`}
      className="group flex flex-1 items-center gap-4 rounded-2xl bg-brand-actie p-4 text-white transition hover:brightness-110 sm:min-w-72"
    >
      {/* De kop groot, want dat is waar de klant op reageert: "50%",
          "5 halen, 3 betalen". De uitleg eronder in gewone tekst. */}
      <span className="text-xl font-black uppercase leading-none sm:text-2xl">
        {campagne.kop}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold leading-snug">{campagne.waarop}</span>
        {campagne.klein && (
          <span className="block text-xs text-white/80">{campagne.klein}</span>
        )}
      </span>
      <span
        className="shrink-0 text-lg transition group-hover:translate-x-0.5"
        aria-hidden
      >
        →
      </span>
    </Link>
  );
}
