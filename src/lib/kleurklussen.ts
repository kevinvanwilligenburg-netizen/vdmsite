import type { Product } from "@/lib/types";

/**
 * Welke verf hoort bij welke klus?
 *
 * De kleurkiezer werkt als een trechter: eerst de kleur, dan wat je ermee
 * gaat doen, dan de verf die daarbij past. Die middelste stap is het
 * verschil met een kale kleurenlijst — een klant die zijn slaapkamer wil
 * verven hoeft niet zelf uit te zoeken of hij muurverf of lak nodig heeft.
 *
 * De trefwoorden matchen op productnaam en de kenmerken uit de feed, niet op
 * categorie: de indeling van Tilroy is daarvoor te grof (alles valt onder
 * "Verf").
 */

export interface Kleurklus {
  id: string;
  label: string;
  toelichting: string;
  icon: string;
  /** Eén hiervan moet voorkomen. */
  bevat: string[];
  /** Hiervan mag er geen enkele voorkomen. */
  bevatNiet?: string[];
}

/**
 * Voorbehandeling hoort niet in de verfkeuze thuis: een klant die zijn muur
 * gaat verven wil muurverf zien, geen voorstrijk. Grondlagen komen bij de
 * toebehoren aan bod, waar ze thuishoren.
 */
const GEEN_AFLAK = ["voorstrijk", "primer", "grondverf", "grondlak", "hechtprimer"];

export const KLEURKLUSSEN: Kleurklus[] = [
  {
    id: "binnenmuur",
    label: "Muren binnen",
    toelichting: "Woonkamer, slaapkamer, hal",
    icon: "roller",
    bevat: ["muurverf", "latex", "wandverf", "binnenmuur"],
    bevatNiet: [...GEEN_AFLAK, "buiten", "gevel", "vloer", "beton"],
  },
  {
    id: "plafond",
    label: "Plafond",
    toelichting: "Strak en mat naar boven",
    icon: "level",
    bevat: ["plafond", "muurverf", "latex"],
    bevatNiet: [...GEEN_AFLAK, "buiten", "gevel", "vloer", "hoogglans"],
  },
  {
    id: "hout-binnen",
    label: "Hout binnen",
    toelichting: "Deuren, trap, plinten, kozijnen",
    icon: "brush",
    bevat: ["binnenlak", "lakverf", "aflak", "zijdeglans", "hoogglans"],
    bevatNiet: [...GEEN_AFLAK, "buiten", "muurverf", "vloer"],
  },
  {
    id: "hout-buiten",
    label: "Hout buiten",
    toelichting: "Schutting, tuinhuis, buitendeur",
    icon: "leaf",
    bevat: ["buitenlak", "beits", "buitenverf", "tuinhuis", "schutting"],
    bevatNiet: [...GEEN_AFLAK, "muurverf", "vloer"],
  },
  {
    id: "gevel",
    label: "Gevel & buitenmuur",
    toelichting: "Steen, stuc en beton buiten",
    icon: "store",
    bevat: ["gevelverf", "buitenmuur", "gevel", "muurverf buiten"],
    bevatNiet: [...GEEN_AFLAK, "hout", "vloer"],
  },
  {
    id: "vloer",
    label: "Vloer & beton",
    toelichting: "Garage, schuur, trap",
    icon: "box",
    bevat: ["vloerverf", "betonverf", "vloercoating", "garagevloer"],
    bevatNiet: GEEN_AFLAK,
  },
  {
    id: "metaal",
    label: "Metaal & radiator",
    toelichting: "Hekwerk, leuning, verwarming",
    icon: "wrench",
    bevat: ["metaallak", "radiatorlak", "radiatorverf", "metaalverf", "hammerite"],
    bevatNiet: [...GEEN_AFLAK, "muurverf"],
  },
];

/** Waar we in zoeken: naam plus de kenmerken die de feed meegeeft. */
function hooiberg(product: Product): string {
  return [
    product.name,
    product.attributes?.subcategorie,
    product.attributes?.verfsoort,
    product.attributes?.toepassing,
    product.attributes?.ondergrond,
    product.shortDescription,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function pastBijKlus(product: Product, klus: Kleurklus): boolean {
  const tekst = hooiberg(product);
  if (klus.bevatNiet?.some((woord) => tekst.includes(woord))) return false;
  return klus.bevat.some((woord) => tekst.includes(woord));
}

/**
 * De mengverven die bij deze klus passen, goedkoopste eerst.
 *
 * Levert een klus niets op, dan geeft de aanroeper alle mengverf terug: een
 * lege stap is voor de klant een doodlopende weg, en een iets te ruime lijst
 * is altijd beter dan geen lijst.
 */
export function verfVoorKlus(producten: Product[], klus: Kleurklus): Product[] {
  const mengbaar = producten.filter(
    (product) => product.colorMixable && product.inStock !== false,
  );
  const passend = mengbaar.filter((product) => pastBijKlus(product, klus));
  const lijst = passend.length > 0 ? passend : mengbaar;
  return [...lijst].sort((a, b) => {
    const foto = Number(Boolean(b.image)) - Number(Boolean(a.image));
    if (foto !== 0) return foto;
    return a.price - b.price;
  });
}
