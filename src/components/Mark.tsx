import Image from "next/image";

/**
 * Voordeel Mark, de gezichtsuiting van De Voordeelmarkt.
 *
 * De foto's komen uit de studioshoot, op het oranje van de huisstijl. Die
 * achtergrond loopt door in het vlak waarin hij staat, dus er is geen uitsnede
 * nodig — dat scheelt gedoe met transparantie en het oogt bewust als een
 * fotostrook, niet als een geplakte figuur.
 *
 * Hij mag ook bij minder leuk nieuws staan (een leeg mandje, niets gevonden).
 * Juist daar helpt een gezicht: het maakt van een doodlopende pagina iets waar
 * iemand achter staat.
 */
const POSES = {
  /** Schouderophalend, open handen — bij twijfel of niets gevonden. */
  vragend: "/mark/mark-vragend.jpg",
  /** Verfblik open, geconcentreerd — bij mengverf en bestellen. */
  mengen: "/mark/mark-mengen.jpg",
  /** Rustig staand — algemeen. */
  staand: "/mark/mark-staand.jpg",
} as const;

export type MarkPose = keyof typeof POSES;

export function Mark({
  pose = "staand",
  className = "",
  hoogte = "h-40",
}: {
  pose?: MarkPose;
  className?: string;
  /** Tailwind-hoogte; de breedte volgt de container. */
  hoogte?: string;
}) {
  return (
    <Image
      src={POSES[pose]}
      alt=""
      width={900}
      height={1350}
      // Beeldpunt op ~een vijfde van boven: de studiofoto's hebben veel lucht
      // boven Marks hoofd, en met object-top bleef er in een laag blok alleen
      // een pluk haar over.
      className={`${hoogte} w-full rounded-xl object-cover object-[50%_20%] ${className}`}
    />
  );
}
