import Image from "next/image";
import Link from "next/link";

import logoVdm from "../../public/logo/logo-vdm.png";

/**
 * Het officiële logo.
 *
 * Kevin: "Logo is geen officieel logo maar zijn zelfgemaakte vakken met tekst
 * erin." Klopte: hier stond een natekening in SVG. Het echte bestand zat
 * gewoon in het huisstijlpakket dat we al hadden ("LOGO vdm 2022.png" uit
 * HUISSTIJL VDM 2022 map.zip, 845 bij 461, transparant) en staat nu in
 * public/logo.
 *
 * Bewust een statische import en géén controle of het bestand bestaat. Dat
 * laatste stond hier eerst en werkte niet: op Vercel zit public/ niet in de
 * serverbundel, dus op elke dynamisch gerenderde pagina viel hij terug op de
 * natekening en stonden er twee verschillende logo's op één site. Zo faalt de
 * build als het bestand weg is, en dat is een duidelijker signaal.
 *
 * Komt er een SVG uit het pakket, vervang dan de import hierboven.
 */
export function Logo({ className = "h-11 w-auto" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="De Voordeelmarkt – naar de homepage"
      className="inline-flex shrink-0"
    >
      <Image
        src={logoVdm}
        alt=""
        priority
        // Het logo staat in de header, dus hij is altijd klein: een breedte
        // meegeven scheelt Next het uitserveren van een veel te groot plaatje.
        sizes="180px"
        className={`${className} object-contain`}
      />
    </Link>
  );
}

/** De slogan naast het logo, zoals op de huidige site. */
export function Tagline() {
  return (
    <p className="hidden select-none text-xs font-black uppercase leading-tight tracking-tight text-ink lg:block">
      De beste verf
      <br />
      voor de laagste prijs.
    </p>
  );
}
