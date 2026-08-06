import { discountPct } from "@/lib/format";

/**
 * De kortingsvlag op een productfoto.
 *
 * Kevin: *"kan je bij de foto's percentage korting laten zien bij producten in
 * de actie?"*
 *
 * Twee soorten korting, en dat verschil moet je zien:
 *
 *  - **Actie** — een lopende Tilroy-promotie. De doorgestreepte prijs is wat
 *    het artikel vorige week écht kostte, de korting loopt af op een datum, en
 *    iedereen krijgt hem. Dat is nieuws, en dat mag schreeuwen.
 *  - **Adviesprijs** — wij zitten altijd onder de adviesprijs van de fabrikant.
 *    Ook waar, maar het is geen actie: het staat er al jaren en het verandert
 *    niet. Bij sommige artikelen is dat verschil 56%.
 *
 * Die twee zagen er tot nu toe identiek uit. Een klant die "−56%" naast
 * "−20%" ziet staan, leest de echte actie als de mindere aanbieding. Daarom
 * krijgt de actie de rode actiekleur uit de huisstijlgids (PMS 2347) plus het
 * woord "actie", en blijft de adviesprijs-vlag ingetogen.
 *
 * ⚠️ Onder de EU-prijsregels moet een doorgestreepte prijs de laagste prijs
 * van de afgelopen 30 dagen zijn. Bij een actie klopt dat (de standaardprijs
 * gold tot gisteren); bij de adviesprijs is dat een ander verhaal. Dat is
 * precies waarom die twee hier uit elkaar worden gehouden en waarom de
 * adviesprijs-vlag niet op de grote productfoto komt.
 */
export function KortingBadge({
  prijs,
  vanaf,
  actie = false,
  formaat = "klein",
}: {
  prijs: number;
  /** De doorgestreepte prijs, in centen. */
  vanaf: number | undefined;
  /** Loopt er een echte actie op dit product? */
  actie?: boolean;
  formaat?: "klein" | "groot";
}) {
  if (!vanaf || vanaf <= prijs) return null;
  const percentage = discountPct(prijs, vanaf);
  // Onder de 3% is het afrondingsruis en gaat er een vlag op een foto voor
  // een euro korting. Dat maakt de vlag ongeloofwaardig op de plekken waar er
  // wél iets te halen valt.
  if (percentage < 3) return null;

  const groot = formaat === "groot";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-black text-white shadow ${
        actie ? "bg-brand-actie" : "bg-ink/70"
      } ${groot ? "px-3 py-1.5 text-base" : "px-2 py-1 text-sm"}`}
    >
      −{percentage}%
      {actie && <span className={groot ? "text-sm font-bold" : "text-[10px] font-bold"}>actie</span>}
    </span>
  );
}
