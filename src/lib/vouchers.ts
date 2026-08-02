import { randomInt } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { isKvEnabled, kvGetJSON, kvSAdd, kvSetJSON, kvSMembers } from "@/lib/kv";
import { staalBedrag } from "@/lib/stalen";
import type { Order } from "@/lib/types";

/**
 * Staal-vouchers: wie een kleurtester koopt, krijgt het testerbedrag terug
 * als voucher — te verzilveren zodra hij de échte verf koopt. Zo is een
 * tester geen kostenpost maar een aanbetaling op de klus.
 *
 * Regels (Kevin, 1 aug 2026):
 *  - Waarde = het volledige testerbedrag van de bestelling (alle testers samen).
 *  - Alleen geldig op een bestelling mét mengverf ("als je echt de verf gaat
 *    gebruiken") — dat toetst de checkout.
 *  - Eén keer te gebruiken, 12 maanden geldig, gaat per mail (met herinnering).
 *
 * Opslag volgt het orders.ts-patroon: KV waar die is, bestandsopslag in
 * demomodus, en een in-memory cache per serverinstance. Keys:
 *   `voucher:<CODE>` → Voucher-JSON
 *   `voucher:index`  → SET met alle codes (voor de herinnerings-cron)
 */

export interface Voucher {
  code: string;
  /** Waarde in CENTEN. */
  bedrag: number;
  /** Bestelling waarmee de voucher is verdiend. */
  orderRef: string;
  email: string;
  aangemaakt: string; // ISO
  geldigTot: string; // ISO
  gebruiktOp?: string; // ISO
  gebruiktInOrder?: string;
  /** Wanneer de herinneringsmail is verstuurd; voorkomt een tweede. */
  herinnerdOp?: string;
  /** Gezet bij annulering van de bestelling die de voucher opleverde. */
  ingetrokkenOp?: string;
}

export const VOUCHER_GELDIG_MAANDEN = 12;
/** Na zoveel dagen zonder gebruik sturen we één herinnering. */
export const VOUCHER_HERINNERING_NA_DAGEN = 14;

const KEY = {
  voucher: (code: string) => `voucher:${code.toUpperCase()}`,
  index: "voucher:index",
};

const DATA_DIR = path.join(process.cwd(), ".data", "vouchers");
const memory = new Map<string, Voucher>();

// Zonder I, O, 0 en 1: een code die de klant aan de balie opleest, moet niet
// op twee manieren te verstaan zijn.
const ALFABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_PATTERN = /^STAAL-[A-Z2-9]{6}$/;

function nieuweCode(): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += ALFABET[randomInt(ALFABET.length)];
  return `STAAL-${suffix}`;
}

export function normaliseerVoucherCode(code: string): string {
  return (code ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

/* ── Opslag ────────────────────────────────────────────────────── */

async function fileWrite(voucher: Voucher): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(
      path.join(DATA_DIR, `${voucher.code}.json`),
      JSON.stringify(voucher, null, 2),
      "utf8",
    );
  } catch (error) {
    console.error("[voucher] bestand schrijven mislukt:", error);
  }
}

async function fileRead(code: string): Promise<Voucher | null> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, `${code}.json`), "utf8");
    return JSON.parse(raw) as Voucher;
  } catch {
    return null;
  }
}

async function fileCodes(): Promise<string[]> {
  try {
    const namen = await fs.readdir(DATA_DIR);
    return namen
      .filter((naam) => naam.endsWith(".json"))
      .map((naam) => naam.replace(/\.json$/, ""));
  } catch {
    return [];
  }
}

async function persist(voucher: Voucher): Promise<void> {
  memory.set(voucher.code, voucher);
  if (isKvEnabled()) {
    const stored = await kvSetJSON(KEY.voucher(voucher.code), voucher);
    if (stored) {
      await kvSAdd(KEY.index, voucher.code);
      return;
    }
    console.error(`[voucher] ${voucher.code} kon niet naar KV; bestandsopslag als terugval.`);
  }
  await fileWrite(voucher);
}

export async function getVoucher(code: string): Promise<Voucher | null> {
  const genormaliseerd = normaliseerVoucherCode(code);
  if (!CODE_PATTERN.test(genormaliseerd)) return null;
  const cached = memory.get(genormaliseerd);
  if (cached) return cached;
  const fromKv = isKvEnabled() ? await kvGetJSON<Voucher>(KEY.voucher(genormaliseerd)) : null;
  const voucher = fromKv ?? (await fileRead(genormaliseerd));
  if (voucher) memory.set(voucher.code, voucher);
  return voucher;
}

/* ── Uitgeven ──────────────────────────────────────────────────── */

/**
 * Maakt de voucher bij een betaalde bestelling met testers. De waarde is het
 * volledige testerbedrag van die bestelling. `null` als er niets te geven is.
 */
export async function maakStaalVoucher(order: Order): Promise<Voucher | null> {
  const bedragEuro = staalBedrag(order.items);
  if (bedragEuro <= 0) return null;

  const nu = new Date();
  const geldigTot = new Date(nu);
  geldigTot.setMonth(geldigTot.getMonth() + VOUCHER_GELDIG_MAANDEN);

  const voucher: Voucher = {
    code: nieuweCode(),
    bedrag: Math.round(bedragEuro * 100),
    orderRef: order.reference,
    email: order.customer.email,
    aangemaakt: nu.toISOString(),
    geldigTot: geldigTot.toISOString(),
  };
  await persist(voucher);
  return voucher;
}

/* ── Verzilveren ───────────────────────────────────────────────── */

export type VoucherOordeel =
  | { status: "geldig"; voucher: Voucher }
  | { status: "onbekend" | "gebruikt" | "verlopen"; melding: string };

export async function beoordeelVoucher(code: string): Promise<VoucherOordeel> {
  const voucher = await getVoucher(code);
  if (!voucher) {
    return { status: "onbekend", melding: "Deze vouchercode kennen we niet. Controleer de code uit je mail." };
  }
  if (voucher.gebruiktOp) {
    return { status: "gebruikt", melding: "Deze voucher is al gebruikt." };
  }
  if (Date.parse(voucher.geldigTot) < Date.now()) {
    return { status: "verlopen", melding: "Deze voucher is verlopen." };
  }
  return { status: "geldig", voucher };
}

/**
 * Markeert de voucher als gebruikt. Wordt pas aangeroepen als de betaling
 * binnen is — een mislukte betaling mag de voucher niet opmaken.
 */
export async function verzilverVoucher(code: string, orderRef: string): Promise<void> {
  const voucher = await getVoucher(code);
  if (!voucher || voucher.gebruiktOp) return;
  await persist({
    ...voucher,
    gebruiktOp: new Date().toISOString(),
    gebruiktInOrder: orderRef,
  });
}

/* ── Annulering ────────────────────────────────────────────────── */

/**
 * Trekt een uitgegeven voucher in wanneer de bestelling die hem opleverde
 * wordt geannuleerd en terugbetaald: de klant krijgt zijn testergeld terug,
 * dus de tegoedbon erbovenop zou dubbel tellen. Intrekken = per direct laten
 * verlopen, zodat elke bestaande controle hem als "verlopen" weigert;
 * `ingetrokkenOp` legt voor de klantenservice vast dat dit geen gewone
 * vervaldatum was. Al verzilverd? Dan blijven we eraf — dat lost een mens op.
 */
export async function trekVoucherIn(
  code: string,
): Promise<"ingetrokken" | "al-gebruikt" | "onbekend"> {
  const voucher = await getVoucher(code);
  if (!voucher) return "onbekend";
  if (voucher.gebruiktOp) return "al-gebruikt";
  const nu = new Date().toISOString();
  await persist({ ...voucher, geldigTot: nu, ingetrokkenOp: nu });
  return "ingetrokken";
}

/**
 * Maakt een verzilverde voucher weer bruikbaar wanneer de bestelling waarin
 * hij opging wordt geannuleerd: de korting is dan nooit genoten. Alleen als
 * hij in precies déze bestelling is ingewisseld — een voucher die (na een
 * eerdere herstelactie) alweer in een andere order zit, blijft daar.
 */
export async function herstelVoucher(code: string, orderRef: string): Promise<boolean> {
  const voucher = await getVoucher(code);
  if (!voucher || !voucher.gebruiktOp || voucher.gebruiktInOrder !== orderRef) return false;
  const hersteld: Voucher = { ...voucher };
  delete hersteld.gebruiktOp;
  delete hersteld.gebruiktInOrder;
  await persist(hersteld);
  return true;
}

/* ── Herinnering ───────────────────────────────────────────────── */

/** Vouchers die aan een herinnering toe zijn: onbenut, niet verlopen, oud genoeg. */
export async function vouchersVoorHerinnering(limit = 100): Promise<Voucher[]> {
  const codes = isKvEnabled() ? await kvSMembers(KEY.index) : await fileCodes();
  const grens = Date.now() - VOUCHER_HERINNERING_NA_DAGEN * 24 * 60 * 60 * 1000;
  const klaar: Voucher[] = [];
  for (const code of codes) {
    if (klaar.length >= limit) break;
    const voucher = await getVoucher(code);
    if (!voucher || voucher.gebruiktOp || voucher.herinnerdOp) continue;
    if (Date.parse(voucher.geldigTot) < Date.now()) continue;
    if (Date.parse(voucher.aangemaakt) > grens) continue;
    klaar.push(voucher);
  }
  return klaar;
}

export async function markeerHerinnerd(code: string): Promise<void> {
  const voucher = await getVoucher(code);
  if (!voucher) return;
  await persist({ ...voucher, herinnerdOp: new Date().toISOString() });
}
