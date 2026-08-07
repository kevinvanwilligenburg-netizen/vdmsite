import { DASHBOARD_API_URL } from "@/lib/site";

/**
 * Actiebanners voor de homepage.
 *
 * Kevin beheert ze in het dashboard (/banners) en dat serveert ze hier uit.
 * De volgorde in het antwoord is de volgorde van de slideshow.
 *
 * Geen banners, of het dashboard even niet bereikbaar: dan geen slideshow. Een
 * homepage zonder actiebanner is een homepage; een homepage met een kapotte
 * afbeelding erboven is een winkel waar niemand meer iets van gelooft.
 */

export interface Banner {
  id: string;
  desktopUrl: string;
  /** Vierkante variant voor telefoons; leeg = desktopafbeelding gebruiken. */
  mobielUrl?: string;
  /** Waar de banner heen linkt; leeg = niet klikbaar. */
  link?: string;
  alt: string;
  /**
   * Tekst óver de banner, in onze eigen letters.
   *
   * Bewust niet in de afbeelding gebakken. Twee redenen: een beeldmodel zet
   * prijzen en percentages geregeld verkeerd neer ("-40%" terwijl de actie 50%
   * is), en een tekst die in het plaatje zit kun je niet wijzigen zonder een
   * nieuwe afbeelding te laten maken. Zo staat er altijd wat er hoort te
   * staan, in Muller Black, en is het in twee tellen aan te passen.
   *
   * Alles optioneel: staat er niets, dan is de banner gewoon een plaatje.
   */
  kop?: string;
  subkop?: string;
  knopLabel?: string;
  /**
   * Waar de banner op de homepage terechtkomt.
   *
   * - `groot`  de slideshow links in de etalage
   * - `tegel`  het blokje rechts ernaast (vier stuks, vierkant)
   * - `klein`  de strook met kleinere acties eronder
   *
   * ⚠️ EXTERN CONTRACT — het dashboard stuurt dit mee. Kent het `tegel` nog
   * niet, dan blijven de vier plekken rechts gevuld met actieproducten uit de
   * catalogus; er ontstaat dus nooit een gat. Zodra Kevin er een tegel
   * neerzet, wint die van het product.
   */
  formaat: "groot" | "tegel" | "klein";
  /**
   * Ware afmetingen van de desktopafbeelding, uit de bestandsheader.
   *
   * Hiervóór stond de verhouding hard in de opmaak: 3:1 voor de grote banner,
   * 2:1 voor de kleine, en op telefoons zelfs vierkant. Kevins bestanden zijn
   * 930×450 (2,07:1) en 450×150 (3:1), dus met `object-cover` sneed de site er
   * een derde af — precies de rand waar "20% KORTING" staat. Bij een banner
   * met tekst in het plaatje is bijsnijden geen schoonheidsfoutje maar
   * weggelakte informatie.
   *
   * Daarom meten we het bestand en zetten we het kader op diezelfde
   * verhouding. Lukt meten niet, dan blijft de oude vaste verhouding staan.
   */
  breedte?: number;
  hoogte?: number;
  /** Idem voor de telefoonvariant, als dat een ander bestand is. */
  mobielBreedte?: number;
  mobielHoogte?: number;
}

/**
 * Breedte en hoogte uit de eerste bytes van een afbeelding.
 *
 * We halen alleen de kop op (64 kB), niet het hele bestand: de afmetingen
 * staan bij PNG, JPEG en WebP vooraan. Serveert de opslag geen 206, dan komt
 * het hele bestand binnen en werkt het nog steeds — alleen minder zuinig.
 */
function leesAfmetingen(buf: Buffer): { breedte: number; hoogte: number } | undefined {
  const groot = (breedte: number, hoogte: number) =>
    breedte > 0 && hoogte > 0 ? { breedte, hoogte } : undefined;

  // PNG: IHDR staat altijd op dezelfde plek.
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return groot(buf.readUInt32BE(16), buf.readUInt32BE(20));
  }

  // GIF: little-endian, direct achter de signature.
  if (buf.length > 10 && buf.toString("ascii", 0, 3) === "GIF") {
    return groot(buf.readUInt16LE(6), buf.readUInt16LE(8));
  }

  // WebP: drie varianten (lossy, lossless, extended) met elk hun eigen kop.
  if (buf.length > 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const soort = buf.toString("ascii", 12, 16);
    if (soort === "VP8 ") return groot(buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff);
    if (soort === "VP8L") {
      const bits = buf.readUInt32LE(21);
      return groot((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
    }
    if (soort === "VP8X") {
      return groot(
        1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)),
        1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)),
      );
    }
  }

  // JPEG: door de segmenten lopen tot een SOF-marker. C4/C8/CC zijn geen SOF.
  if (buf.length > 4 && buf.readUInt16BE(0) === 0xffd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return groot(buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5));
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }

  return undefined;
}

async function afmetingenVan(url: string): Promise<{ breedte: number; hoogte: number } | undefined> {
  try {
    const res = await fetch(url, {
      headers: { Range: "bytes=0-65535" },
      // Een blob-URL wijzigt nooit van inhoud: een nieuwe banner is een nieuwe
      // URL. De afmetingen mogen dus lang blijven staan.
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return undefined;
    return leesAfmetingen(Buffer.from(await res.arrayBuffer()));
  } catch {
    // Meten is een verbetering, geen voorwaarde. Mislukt het, dan valt de
    // opmaak terug op de vaste verhouding en staat er nog steeds een banner.
    return undefined;
  }
}

/**
 * De verhouding van het kader waarin een banner komt te staan.
 *
 * Uitgangspunt is de ware maat van het bestand: dan snijdt `object-cover`
 * niets af en blijft de tekst die in het plaatje gebakken zit heel.
 *
 * Maar niet blind. Hiervóór stond `h-auto w-full` en nam de banner altijd zijn
 * eigen vorm aan; dat ging mis toen de bannergenerator 1536×1024 begon te
 * leveren, want dan staat er een bijna vierkant blok boven de homepage. Daarom
 * een boven- en ondergrens: valt de ware verhouding daarbinnen, dan gebruiken
 * we die exact; ligt hij erbuiten, dan snijden we bij zoals voorheen.
 *
 * Op een telefoon mag het blok forser zijn dan op een breed scherm — daar is
 * een 3:1-strook een reepje van niks.
 */
const RATIO_GRENZEN: Record<Banner["formaat"], Record<"mobiel" | "desktop", [number, number, string]>> = {
  //                    [ smalst, breedst, terugval ]
  // De grote banner staat sinds de etalage-indeling naast de tegels en is dus
  // geen brede strook meer maar een staand tot vierkant vlak — op beide
  // schermen. Een 3:1-strook naast een blok van vier tegels laat een gat.
  groot: { mobiel: [0.7, 1.4, "1 / 1"], desktop: [0.8, 1.6, "1 / 1"] },
  tegel: { mobiel: [0.8, 1.3, "1 / 1"], desktop: [0.8, 1.3, "1 / 1"] },
  klein: { mobiel: [1.6, 3.6, "2 / 1"], desktop: [1.6, 3.6, "2 / 1"] },
};

export function bannerRatio(
  breedte: number | undefined,
  hoogte: number | undefined,
  formaat: Banner["formaat"],
  scherm: "mobiel" | "desktop",
): string {
  const [smalst, breedst, terugval] = RATIO_GRENZEN[formaat][scherm];
  if (!breedte || !hoogte) return terugval;
  const echt = breedte / hoogte;
  if (echt < smalst) return `${smalst} / 1`;
  if (echt > breedst) return `${breedst} / 1`;
  return `${breedte} / ${hoogte}`;
}

function schoon(waarde: unknown): string {
  return typeof waarde === "string" ? waarde.trim() : "";
}

/**
 * Alleen https-adressen doorlaten.
 *
 * De banners komen van een ander systeem, en dit is de plek waar dat systeem
 * de homepage in mag. Een `javascript:`-link in het `link`-veld zou daar zo
 * doorheen lopen.
 */
function veiligeUrl(waarde: unknown): string | undefined {
  const tekst = schoon(waarde);
  if (!tekst) return undefined;
  try {
    const url = new URL(tekst, "https://www.devoordeelmarkt.nl");
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export async function getBanners(): Promise<Banner[]> {
  try {
    const res = await fetch(`${DASHBOARD_API_URL}/api/banners`, {
      // Een actie gaat aan of uit op een moment dat Kevin kiest; een uur
      // wachten tot de homepage het doorheeft is te lang.
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { banners?: unknown };
    if (!Array.isArray(data.banners)) return [];

    const banners = data.banners.flatMap((ruw): Banner[] => {
      const item = ruw as Record<string, unknown>;
      const desktopUrl = veiligeUrl(item.desktopUrl);
      // Zonder afbeelding valt er niets te tonen.
      if (!desktopUrl) return [];
      const mobielUrl = veiligeUrl(item.mobielUrl);
      const link = veiligeUrl(item.link);
      return [
        {
          id: schoon(item.id) || desktopUrl,
          desktopUrl,
          ...(mobielUrl ? { mobielUrl } : {}),
          ...(link ? { link } : {}),
          // Alt-tekst is geen bijzaak: bij een banner die niet laadt is dit
          // het enige wat er staat, en een schermlezer heeft niets anders.
          alt: schoon(item.alt) || "Actie bij De Voordeelmarkt",
          // Kort houden: dit staat over een foto heen en moet op een telefoon
          // in één oogopslag te lezen zijn.
          ...(schoon(item.kop) ? { kop: schoon(item.kop).slice(0, 60) } : {}),
          ...(schoon(item.subkop) ? { subkop: schoon(item.subkop).slice(0, 120) } : {}),
          ...(schoon(item.knopLabel) ? { knopLabel: schoon(item.knopLabel).slice(0, 30) } : {}),
          formaat:
            schoon(item.formaat).toLowerCase() === "klein"
              ? "klein"
              : schoon(item.formaat).toLowerCase() === "tegel"
                ? "tegel"
                : "groot",
        },
      ];
    });

    /*
     * Afmetingen erbij, allemaal tegelijk. Het zijn er een handvol en het
     * antwoord ligt een dag in de cache, dus dit kost de homepage niets.
     *
     * Meteen ook de plek om te merken dát een banner te klein is aangeleverd.
     * Een bestand van 930 px dat over 1200 px wordt uitgerekt is niet stuk —
     * het is alleen zacht, en dat ziet niemand in een logregel terug. Vandaar
     * de waarschuwing: opblazen kunnen we niet oplossen met code.
     */
    const MINIMUM: Record<Banner["formaat"], number> = { groot: 1200, tegel: 600, klein: 800 };
    return Promise.all(
      banners.map(async (banner) => {
        // De telefoonvariant is nu vaak hetzelfde bestand; dan hoeft hij niet
        // apart gemeten te worden.
        const apart = banner.mobielUrl && banner.mobielUrl !== banner.desktopUrl;
        const [maat, mobiel] = await Promise.all([
          afmetingenVan(banner.desktopUrl),
          apart ? afmetingenVan(banner.mobielUrl!) : Promise.resolve(undefined),
        ]);
        if (!maat) return banner;
        if (maat.breedte < MINIMUM[banner.formaat]) {
          console.warn(
            `[banners] ${banner.id} is ${maat.breedte}×${maat.hoogte}; voor een ${banner.formaat}e banner is minstens ${MINIMUM[banner.formaat]} px breed nodig, anders wordt hij uitgerekt.`,
          );
        }
        return {
          ...banner,
          ...maat,
          ...(mobiel ? { mobielBreedte: mobiel.breedte, mobielHoogte: mobiel.hoogte } : {}),
        };
      }),
    );
  } catch (error) {
    console.error("[banners] ophalen mislukt:", error);
    return [];
  }
}
