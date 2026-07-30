import fs from "node:fs";
import path from "node:path";

import Image from "next/image";

/**
 * Het logo van een merk, als we het hebben.
 *
 * De bestanden staan in /public/merken/<slug>.<ext>. Er is geen lijst die
 * bijgehouden moet worden: staat het bestand er, dan verschijnt het logo, en
 * anders valt de pagina terug op de merknaam in letters. Zo kunnen er logo's
 * bij komen zonder dat er code verandert.
 *
 * Het bestaan van het bestand controleren we op de server bij het bouwen van
 * de pagina. Een <img> die 404 geeft levert anders een kapot icoontje op —
 * erger dan geen logo.
 */
const MAP = path.join(process.cwd(), "public", "merken");
const EXTENSIES = [".svg", ".png", ".webp", ".jpg"];

export function merkLogoPad(slug: string): string | null {
  for (const ext of EXTENSIES) {
    const bestand = `${slug}${ext}`;
    try {
      if (fs.existsSync(path.join(MAP, bestand))) return `/merken/${bestand}`;
    } catch {
      // Geen toegang tot de map (bijvoorbeeld in een edge-omgeving): dan
      // gewoon geen logo tonen.
      return null;
    }
  }
  return null;
}

export function MerkLogo({
  slug,
  naam,
  className = "",
}: {
  slug: string;
  naam: string;
  className?: string;
}) {
  const pad = merkLogoPad(slug);
  if (!pad) return null;
  return (
    <Image
      src={pad}
      alt={naam}
      width={240}
      height={120}
      className={`h-14 w-auto object-contain ${className}`}
    />
  );
}
