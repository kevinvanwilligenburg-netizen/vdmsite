import { euro } from "@/lib/format";
import { coveragePerLiter, sizesOf } from "@/lib/paint-bases";
import { GRATIS_VANAF_TEKST } from "@/lib/shipping";
import { STAAL_PRIJS_TEKST } from "@/lib/stalen";
import type { Product } from "@/lib/types";

/**
 * De veelgestelde vragen op een productpagina.
 *
 * Concurrenten vangen de long-tail ("rubbol xd droogtijd", "hoeveel muurverf
 * per m2") met lappen tekst per product. Wij beantwoorden dezelfde vragen,
 * maar dan deterministisch uit de échte specificaties — een vraag verschijnt
 * alleen als de feed het antwoord ook levert. Geen data, geen vraag; een
 * verzonnen droogtijd kost een klant een mislukte klus.
 */

export interface ProductFaq {
  q: string;
  a: string;
}

export function bouwProductFaqs(
  product: Product,
  opties: { testers?: boolean } = {},
): ProductFaq[] {
  const attr = product.attributes ?? {};
  const faqs: ProductFaq[] = [];

  faqs.push({
    q: `Wat kost ${product.name}?`,
    a: `${product.name} kost ${euro(product.price)}${
      product.compareAtPrice
        ? ` in plaats van de adviesprijs van ${euro(product.compareAtPrice)}`
        : ""
    }. ${
      product.pickupOnly
        ? "Afhalen in de winkel is altijd gratis."
        : `Bezorgen is gratis vanaf ${GRATIS_VANAF_TEKST}; afhalen in de winkel is dat altijd.`
    }`,
  });

  faqs.push({
    q: "Hoe snel heb ik dit in huis?",
    a: product.pickupOnly
      ? "Dit artikel halen we niet door de brievenbus: je haalt het af in een van onze winkels. Reken online af en het ligt vandaag nog voor je klaar zodra de winkel open is. Op deze pagina zie je in welke winkels het op voorraad ligt."
      : "Ligt dit artikel in onze webshopvoorraad in Nijverdal, dan bezorgt DHL het de volgende dag. Bestel je vóór 09:00, dan kun je bij het afrekenen kiezen voor bezorging vandaag nog, tegen een toeslag van € 1,25. Ligt het in een van onze andere winkels, dan verstuurt die winkel het met PostNL en heb je het binnen één werkdag. Op deze pagina zie je de actuele voorraad per winkel.",
  });

  if (product.colorMixable) {
    faqs.push({
      q: "Kan ik dit in elke kleur krijgen?",
      // De kleurtester alleen noemen als de dashboard-schakelaar aan staat;
      // anders belooft de FAQ een pagina die niet bestaat.
      a: `Ja. Kies je kleur met de kleurkiezer op deze pagina — je hebt keuze uit meer dan 18.000 kleuren. Onze verfspecialist mengt de verf gratis aan en kiest automatisch de juiste mengbasis bij jouw kleur. ${
        opties.testers
          ? `Twijfel je over de kleur? Bestel eerst een kleurtester van 30 ml (${STAAL_PRIJS_TEKST}); dat bedrag krijg je terug als voucher bij je verf.`
          : "Twijfel je over de kleur? Leg de officiële waaier ernaast in een van onze winkels — onze verfspecialist denkt gratis met je mee."
      }`,
    });
  }

  // Rendement alleen als het in de specificaties staat; de rekensom erbij is
  // precies waar mensen op zoeken ("hoeveel liter voor 20 m2").
  const rendement = coveragePerLiter(product);
  if (rendement) {
    const literVoorTwintig = Math.round((40 / rendement) * 10) / 10;
    faqs.push({
      q: `Hoeveel m² kan ik schilderen met ${product.name}?`,
      a: `Volgens de specificaties ongeveer ${String(rendement).replace(".", ",")} m² per liter, per laag. Voor een muur of oppervlak van 20 m² in twee lagen kom je dus op zo'n ${String(literVoorTwintig).replace(".", ",")} liter. De rekenhulp op deze pagina rekent het exact uit voor jouw oppervlak.`,
    });
  }

  const glans = attr.glans?.trim();
  if (glans) {
    faqs.push({
      q: `Welke glansgraad heeft ${product.name}?`,
      a: `${product.name} heeft glansgraad ${glans.toLowerCase()}. Vuistregel bij het kiezen: hoe meer glans, hoe beter reinigbaar; mat oogt rustiger en verbergt kleine oneffenheden.`,
    });
  }

  // "rubbol xd droogtijd" is precies zo'n zoekopdracht waar de concurrent nu
  // op binnenkomt. Alleen beantwoorden met wat de fabrikant opgeeft; de
  // waarschuwing erbij, want overschilderen mag meestal pas veel later dan
  // stofdroog.
  const droogtijd = attr.droogtijd?.trim();
  if (droogtijd) {
    faqs.push({
      q: `Hoe lang moet ${product.name} drogen?`,
      a: `De opgegeven droogtijd is ${droogtijd.toLowerCase()}. Dat is de tijd tot stofdroog of aanraakdroog; voor een volgende laag heb je meestal langer nodig — lees dat na op de verpakking. Bij lage temperaturen en hoge luchtvochtigheid duurt drogen altijd langer dan opgegeven.`,
    });
  }

  const toepassing = attr.toepassing?.trim();
  if (toepassing) {
    faqs.push({
      q: `Waar gebruik ik ${product.name} voor?`,
      a: `De opgegeven toepassing is: ${toepassing.toLowerCase()}. Twijfel je of het bij jouw klus past? Onze verfspecialist denkt gratis met je mee — in de winkel, via de klusadviseur of telefonisch.`,
    });
  }

  const ondergrond = attr.ondergrond?.trim();
  if (ondergrond) {
    faqs.push({
      q: `Op welke ondergrond kan ${product.name}?`,
      a: `Volgens de specificaties geschikt voor: ${ondergrond.toLowerCase()}. Zorg altijd voor een schone, vetvrije en draagkrachtige ondergrond; kaal of zuigend materiaal vraagt meestal eerst om een grond- of voorstrijklaag.`,
    });
  }

  const maten = sizesOf(product);
  if (maten.length > 1) {
    const isInhoud = maten.some((maat) => /\b(ml|l|liter)\b/i.test(maat));
    faqs.push({
      q: `In welke ${isInhoud ? "inhoud" : "maten"} is ${product.name} verkrijgbaar?`,
      a: `${product.name} is er in ${maten.join(", ")}. De prijs per maat zie je zodra je hierboven een keuze maakt; groter inkopen is per liter vrijwel altijd voordeliger.`,
    });
  }

  if (product.kluspasPrice && product.kluspasPrice < product.price) {
    faqs.push({
      q: "Kan ik korting krijgen op dit artikel?",
      a: "Ja — met een gratis account betaal je de Kluspas-prijs die bij de prijs staat. Die korting wordt bij het afrekenen direct verrekend, ook als je het account tijdens het bestellen aanmaakt.",
    });
  }

  faqs.push({
    q: "Kan ik dit artikel retourneren?",
    a: "Je hebt 14 dagen bedenktijd. Ongebruikte artikelen kun je gratis terugbrengen naar elke winkel. Op kleur gemengde verf is maatwerk en daarvan uitgezonderd.",
  });

  return faqs;
}
