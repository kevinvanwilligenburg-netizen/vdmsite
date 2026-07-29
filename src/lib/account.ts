import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

import { kvDel, kvGetJSON, kvGetRaw, kvSetEx, isKvEnabled } from "@/lib/kv";
import { DASHBOARD_API_URL } from "@/lib/site";

/**
 * Klantaccounts.
 *
 * Inloggen gaat met een eenmalige code per e-mail. Het Kluspas-nummer is
 * bewust géén inloggegeven: dat is bij Tilroy een oplopend nummer
 * (1000005003, 1000005004, …) en dus triviaal te raden — wie het als
 * wachtwoord zou gebruiken, kan het account van de buurman openen.
 *
 * Het e-mailadres is de sleutel: daar zoekt de Tilroy Customer API
 * rechtstreeks op, en het bewijst dat de klant is wie hij zegt te zijn
 * doordat de code in zijn mailbox aankomt.
 */

const CODE_TTL_SECONDS = 15 * 60;
const SESSIE_TTL_SECONDS = 60 * 60 * 24 * 30;
const MAX_POGINGEN = 5;

export const SESSIE_COOKIE = "vdm-account";

export interface Klant {
  email: string;
  voornaam?: string;
  achternaam?: string;
  /** Kluspas-nummer (`code` in Tilroy). */
  kluspas?: string;
  telefoon?: string;
  adres?: {
    straat?: string;
    huisnummer?: string;
    postcode?: string;
    plaats?: string;
    land?: string;
  };
  /** Herkende klant in Tilroy? Zo niet, dan is het een webshop-only account. */
  inTilroy: boolean;
}

interface CodeRecord {
  hash: string;
  pogingen: number;
  gemaaktOp: number;
}

/* ── Inlogcodes ────────────────────────────────────────────────── */

function normaliseerEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * De code slaan we gehasht op, niet in leesbare vorm.
 *
 * Wie meekijkt in de opslag mag niet zomaar kunnen inloggen als een klant.
 * Het is een kortlevende code van zes cijfers, maar dat is geen reden om hem
 * open weg te schrijven.
 */
function hashCode(email: string, code: string): string {
  return createHash("sha256").update(`${normaliseerEmail(email)}:${code}`).digest("hex");
}

export function nieuweCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function bewaarCode(email: string, code: string): Promise<boolean> {
  if (!isKvEnabled()) return false;
  const record: CodeRecord = {
    hash: hashCode(email, code),
    pogingen: 0,
    gemaaktOp: Date.now(),
  };
  return kvSetEx(`account:code:${normaliseerEmail(email)}`, JSON.stringify(record), CODE_TTL_SECONDS);
}

export type CodeUitkomst = "goed" | "fout" | "verlopen" | "geblokkeerd";

export async function controleerCode(email: string, code: string): Promise<CodeUitkomst> {
  const sleutel = `account:code:${normaliseerEmail(email)}`;
  const record = await kvGetJSON<CodeRecord>(sleutel);
  if (!record) return "verlopen";
  if (record.pogingen >= MAX_POGINGEN) {
    await kvDel(sleutel);
    return "geblokkeerd";
  }

  const verwacht = Buffer.from(record.hash, "hex");
  const gegeven = Buffer.from(hashCode(email, code.trim()), "hex");
  const klopt = verwacht.length === gegeven.length && timingSafeEqual(verwacht, gegeven);

  if (!klopt) {
    // Pogingen bijhouden; zonder teller is een code van zes cijfers in een
    // kwartier prima te raden.
    await kvSetEx(
      sleutel,
      JSON.stringify({ ...record, pogingen: record.pogingen + 1 }),
      CODE_TTL_SECONDS,
    );
    return "fout";
  }

  await kvDel(sleutel);
  return "goed";
}

/* ── Sessies ───────────────────────────────────────────────────── */

export async function maakSessie(email: string): Promise<string | null> {
  if (!isKvEnabled()) return null;
  const token = randomBytes(32).toString("hex");
  const ok = await kvSetEx(
    `account:sessie:${token}`,
    normaliseerEmail(email),
    SESSIE_TTL_SECONDS,
  );
  return ok ? token : null;
}

export async function emailVanSessie(token: string | undefined): Promise<string | null> {
  if (!token || !isKvEnabled()) return null;
  return kvGetRaw(`account:sessie:${token}`);
}

export async function beeindigSessie(token: string | undefined): Promise<void> {
  if (!token) return;
  await kvDel(`account:sessie:${token}`);
}

/* ── Klantgegevens uit Tilroy, via het dashboard ───────────────── */

/**
 * De sleutel waarmee we ons bij het dashboard legitimeren.
 *
 * Zonder sleutel weigeren die routes alles met een 401 — bewust, want het
 * gaat om persoonsgegevens en een stille ontwikkelmodus zou dat ondermijnen.
 * We proberen het dan niet eens; dat scheelt een zinloze aanroep en zet geen
 * verwarrende fout in de logboeken.
 */
function dashboardKop(): Record<string, string> | null {
  const sleutel = process.env.SITE_API_KEY;
  return sleutel ? { Authorization: `Bearer ${sleutel}` } : null;
}

export function heeftDashboardSleutel(): boolean {
  return Boolean(process.env.SITE_API_KEY);
}

interface DashboardKlant {
  tilroyId?: string;
  code?: string;
  email?: string;
  firstName?: string;
  middleName?: string;
  surName?: string;
  mobileNumber?: string;
  addresses?: {
    street?: string;
    houseNumber?: string;
    zipCode?: string;
    postalCode?: string;
    city?: string;
    country?: string;
  }[];
}

/**
 * Zoek de klant op bij Tilroy (via het dashboard).
 *
 * Lukt dat niet — geen koppeling, klant onbekend, dashboard onbereikbaar —
 * dan krijgt de bezoeker een account met alleen zijn webshopgegevens. Beter
 * een half account dan een foutmelding waar hij niets mee kan.
 */
export async function haalKlant(email: string): Promise<Klant> {
  const adres = normaliseerEmail(email);
  const basis: Klant = { email: adres, inTilroy: false };

  const kop = dashboardKop();
  if (!kop) return basis;

  try {
    const res = await fetch(
      `${DASHBOARD_API_URL}/api/klanten/zoek?email=${encodeURIComponent(adres)}`,
      { headers: kop, signal: AbortSignal.timeout(8000), cache: "no-store" },
    );
    if (!res.ok) {
      console.error("[account] klant zoeken gaf status", res.status);
      return basis;
    }
    const data = (await res.json()) as { klant?: DashboardKlant };
    const klant = data.klant;
    if (!klant) return basis;

    const eersteAdres = klant.addresses?.[0];
    return {
      email: adres,
      voornaam: klant.firstName,
      achternaam: [klant.middleName, klant.surName].filter(Boolean).join(" ") || undefined,
      kluspas: klant.code,
      telefoon: klant.mobileNumber,
      adres: eersteAdres
        ? {
            straat: eersteAdres.street,
            huisnummer: eersteAdres.houseNumber,
            postcode: eersteAdres.zipCode ?? eersteAdres.postalCode,
            plaats: eersteAdres.city,
            land: eersteAdres.country,
          }
        : undefined,
      inTilroy: true,
    };
  } catch (error) {
    console.error("[account] klant opzoeken mislukt:", error);
    return basis;
  }
}

/* ── Aankopen: webshop én winkel ───────────────────────────────── */

export interface Aankoop {
  id: string;
  datum: string;
  bron: "webshop" | "winkel";
  /** Vestiging bij een winkelaankoop. */
  winkel?: string;
  bedrag: number;
  regels: { titel: string; aantal: number; bedrag: number }[];
  /** Alleen bij webshoporders: de status en het referentienummer. */
  referentie?: string;
  status?: string;
  /** Is er betaald? Alleen dan bestaat er een factuur. */
  betaald?: boolean;
  /** Kluspunten die deze aankoop opleverde, als de bron dat meldt. */
  punten?: number;
}

interface DashboardBon {
  id?: string;
  date?: string;
  store?: string;
  total?: number;
  lines?: { title?: string; quantity?: number; amount?: number }[];
  customerCreditsSale?: number;
}

/**
 * Winkelaankopen uit Tilroy, via het dashboard.
 *
 * Tilroy kent geen "verkopen van klant X"-endpoint, dus het dashboard crawlt
 * een jaar verkopen en filtert daarop. Dat is gecachet, maar de eerste
 * aanroep na cache-verval duurt tientallen seconden. Daarom haalt de
 * accountpagina dit ná het renderen op: de klant ziet zijn Kluspas en zijn
 * webshopbestellingen meteen, en de winkelaankopen schuiven erbij zodra ze
 * er zijn. Een minuut naar een leeg scherm kijken is geen optie.
 */
export async function haalWinkelaankopen(email: string): Promise<Aankoop[]> {
  const kop = dashboardKop();
  if (!kop) return [];

  try {
    const res = await fetch(
      `${DASHBOARD_API_URL}/api/klanten/historie?email=${encodeURIComponent(normaliseerEmail(email))}&limit=25`,
      { headers: kop, signal: AbortSignal.timeout(60_000), cache: "no-store" },
    );
    if (!res.ok) {
      console.error("[account] winkelhistorie gaf status", res.status);
      return [];
    }
    const data = (await res.json()) as { bonnen?: DashboardBon[] };
    return (data.bonnen ?? []).map((bon, index) => ({
      id: bon.id ?? `bon-${index}`,
      datum: bon.date ?? "",
      bron: "winkel" as const,
      winkel: bon.store,
      bedrag: Number(bon.total ?? 0),
      regels: (bon.lines ?? []).map((regel) => ({
        titel: regel.title ?? "Artikel",
        aantal: Number(regel.quantity ?? 1),
        bedrag: Number(regel.amount ?? 0),
      })),
      punten: bon.customerCreditsSale,
    }));
  } catch (error) {
    console.error("[account] winkelhistorie ophalen mislukt:", error);
    return [];
  }
}
