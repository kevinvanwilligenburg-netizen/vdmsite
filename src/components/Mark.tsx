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
      /*
       * Beeldpunt op 30%, want daar zit zijn gezicht.
       *
       * Stond op 20% met precies de goede reden — er is veel lucht boven zijn
       * hoofd — maar het getal was te laag gekozen. Kevin op de zoekpagina:
       * "je ziet zn gezicht niet", en er stond inderdaad alleen een pluk haar.
       *
       * Nagerekend op het echte beeld (900×1350): zijn gezicht zit op y≈450,
       * dus op 33% van de hoogte. Bij `object-cover` bepaalt het percentage
       * waar het zichtbare strookje begint — in een blok van 1100×192 loopt
       * dat bij 20% van y=239 tot y=396, en dat eindigt net boven zijn kin.
       * Op 30% loopt het van 358 tot 515 en staat zijn gezicht in het midden.
       *
       * Eén waarde voor alle blokken: in een smal vak (leeg mandje, 512 px
       * breed) komt hetzelfde punt op 28% uit, dus 30% valt daar ook goed.
       * Bij een staand vak doet het percentage niets — dan snijdt cover op de
       * breedte.
       */
      className={`${hoogte} w-full rounded-xl object-cover object-[50%_30%] ${className}`}
    />
  );
}
