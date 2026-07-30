import { euro } from "@/lib/format";
import type { Product } from "@/lib/types";

/**
 * De inhoud van een merkpagina, afgeleid uit het assortiment zelf.
 *
 * Een merkpagina die voor elk merk dezelfde zin toont ("X artikelen van <merk>
 * bij De Voordeelmarkt") is voor Google hetzelfde als geen pagina: veertig
 * URL's met één woord verschil. Wat een merkpagina wél onderscheidt is wat er
 * feitelijk ligt — in welke rubrieken, in welke maten, hoeveel ervan
 * mengbaar is, en wat het goedkoopste en duurste artikel is. Die cijfers
 * verschillen per merk vanzelf, en ze kloppen altijd omdat ze uit de catalogus
 * komen.
 */

export interface MerkFeiten {
  aantal: number;
  vanaf: number;
  tot: number;
  /** Rubrieken waarin dit merk zit, grootste eerst. */
  rubrieken: { slug: string; naam: string; aantal: number }[];
  /** Maten die vaak voorkomen; zegt bij verf meer dan bij schroeven. */
  maten: string[];
  mengbaar: number;
  inAanbieding: number;
  /** Grootste korting ten opzichte van de adviesprijs, in procenten. */
  hoogsteKorting: number;
}

export function merkFeiten(products: Product[]): MerkFeiten {
  const perRubriek = new Map<string, { naam: string; aantal: number }>();
  const maatTeller = new Map<string, number>();
  let mengbaar = 0;
  let inAanbieding = 0;
  let hoogsteKorting = 0;

  for (const product of products) {
    const naam = product.attributes?.hoofdgroep ?? product.attributes?.subcategorie;
    if (naam) {
      const bestaand = perRubriek.get(product.category);
      if (bestaand) bestaand.aantal++;
      else perRubriek.set(product.category, { naam, aantal: 1 });
    }
    for (const maat of (product.attributes?.inhoud ?? "").split("|")) {
      const schoon = maat.trim();
      if (schoon) maatTeller.set(schoon, (maatTeller.get(schoon) ?? 0) + 1);
    }
    if (product.colorMixable) mengbaar++;
    if (product.compareAtPrice && product.compareAtPrice > product.price) {
      inAanbieding++;
      const korting = Math.round((1 - product.price / product.compareAtPrice) * 100);
      if (korting > hoogsteKorting) hoogsteKorting = korting;
    }
  }

  const prijzen = products.map((product) => product.price);

  return {
    aantal: products.length,
    vanaf: Math.min(...prijzen),
    tot: Math.max(...prijzen),
    rubrieken: [...perRubriek.entries()]
      .map(([slug, { naam, aantal }]) => ({ slug, naam, aantal }))
      .sort((a, b) => b.aantal - a.aantal),
    maten: [...maatTeller.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([maat]) => maat),
    mengbaar,
    inAanbieding,
    hoogsteKorting,
  };
}

/**
 * De openingsalinea. Bewust opgebouwd uit de feiten hierboven, zodat hij per
 * merk verschilt zonder dat er iets verzonnen wordt.
 */
export function merkInleiding(naam: string, feiten: MerkFeiten): string {
  const rubriek = feiten.rubrieken[0];
  const delen: string[] = [];

  delen.push(
    feiten.rubrieken.length === 1 && rubriek
      ? `${naam} bij De Voordeelmarkt: ${feiten.aantal} ${
          feiten.aantal === 1 ? "artikel" : "artikelen"
        } in ${rubriek.naam.toLowerCase()}.`
      : `${naam} bij De Voordeelmarkt: ${feiten.aantal} artikelen, verdeeld over ${feiten.rubrieken.length} rubrieken.`,
  );

  delen.push(
    feiten.vanaf === feiten.tot
      ? `De prijs is ${euro(feiten.vanaf)}.`
      : `Prijzen lopen van ${euro(feiten.vanaf)} tot ${euro(feiten.tot)}.`,
  );

  if (feiten.mengbaar > 0) {
    delen.push(
      feiten.mengbaar === feiten.aantal
        ? "Alles is mengbaar in elke kleur; onze verfspecialist maakt hem gratis aan."
        : `Daarvan ${feiten.mengbaar === 1 ? "is er één" : `zijn er ${feiten.mengbaar}`} mengbaar in elke kleur, gratis aangemaakt door onze verfspecialist.`,
    );
  }

  if (feiten.inAanbieding > 0 && feiten.hoogsteKorting >= 10) {
    delen.push(
      `${feiten.inAanbieding} ${
        feiten.inAanbieding === 1 ? "artikel staat" : "artikelen staan"
      } in de aanbieding, met kortingen tot ${feiten.hoogsteKorting}% op de adviesprijs.`,
    );
  }

  return delen.join(" ");
}

/** Vragen die bij dit merk horen, met antwoorden uit de eigen gegevens. */
export function merkVragen(
  naam: string,
  feiten: MerkFeiten,
): { q: string; a: string }[] {
  const vragen: { q: string; a: string }[] = [
    {
      q: `Wat kost ${naam} bij De Voordeelmarkt?`,
      a:
        feiten.vanaf === feiten.tot
          ? `Elk artikel van ${naam} kost hier ${euro(feiten.vanaf)}.`
          : `${naam} begint bij ${euro(feiten.vanaf)} en loopt tot ${euro(
              feiten.tot,
            )}. Met een account krijg je daar nog korting op.`,
    },
    {
      q: `Welke ${naam}-artikelen hebben jullie?`,
      a:
        feiten.rubrieken.length === 0
          ? `We voeren ${feiten.aantal} artikelen van ${naam}.`
          : `We voeren ${feiten.aantal} artikelen van ${naam}, vooral in ${feiten.rubrieken
              .slice(0, 3)
              .map((rubriek) => `${rubriek.naam.toLowerCase()} (${rubriek.aantal})`)
              .join(", ")}.`,
    },
    {
      q: `Kan ik ${naam} vandaag nog ophalen?`,
      a: "Ligt het artikel in een van onze vijf winkels op voorraad, dan staat je bestelling er binnen twee uur klaar. Op de productpagina zie je per winkel wat er ligt.",
    },
  ];

  if (feiten.mengbaar > 0) {
    vragen.splice(2, 0, {
      q: `Mengen jullie ${naam} in elke kleur?`,
      a: `Ja. ${feiten.mengbaar} van onze ${naam}-artikelen zijn mengbaar in meer dan 18.000 kleuren. Aanmengen kost niets; onze verfspecialist kiest automatisch de juiste basis bij jouw kleur.`,
    });
  }

  return vragen;
}
