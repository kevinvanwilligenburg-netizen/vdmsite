import { NextResponse } from "next/server";

import { kvPing } from "@/lib/kv";
import { mollieEnabled, mollieTestMode } from "@/lib/mollie";
import { catalogusBron } from "@/lib/product-feed";
import { DASHBOARD_API_URL } from "@/lib/site";
import { getProducts } from "@/lib/tilroy";

export const dynamic = "force-dynamic";

/**
 * Statuscheck van de koppelingen. Handig na een deploy: laat zien of de
 * Redis/KV-store, Mollie en de dashboard-hub bereikbaar zijn. Geeft geen
 * sleutels of andere gevoelige waarden terug.
 */
export async function GET() {
  const kv = await kvPing();

  // De hub doet bij een koude cache een volledige crawl (~40 s). Een timeout
  // betekent dus "traag", niet "kapot" — dat onderscheid hoort hier te staan.
  let stockHub: { status: string; configured: boolean; ms?: number } = {
    status: "onbekend",
    configured: false,
  };
  const startedAt = Date.now();
  try {
    const res = await fetch(`${DASHBOARD_API_URL}/api/voorraad/skus?skus=ping`, {
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    const ms = Date.now() - startedAt;
    if (res.ok) {
      const data = (await res.json()) as { configured?: boolean };
      stockHub = { status: "bereikbaar", configured: data.configured === true, ms };
    } else {
      stockHub = { status: `status ${res.status}`, configured: false, ms };
    }
  } catch {
    stockHub = {
      status: "traag of onbereikbaar (koude cache duurt tot ~40 s)",
      configured: false,
      ms: Date.now() - startedAt,
    };
  }

  const products = await getProducts();
  const catalogus = {
    // "xml" betekent dat de JSON-feed onbereikbaar was en we op de terugval
    // draaien; "onbekend" dat de catalogus uit de Redis-cache kwam.
    bron: catalogusBron(),
    producten: products.length,
    metFoto: products.filter((product) => product.image).length,
    mengverf: products.filter((product) => product.colorMixable).length,
    metBasiskeuze: products.filter((product) =>
      (product.variants ?? []).some((variant) => variant.base),
    ).length,
    metKluspasPrijs: products.filter((product) => product.kluspasPrice).length,
    metGlans: products.filter((product) => product.attributes?.glans).length,
    metInhoud: products.filter((product) => product.attributes?.inhoud).length,
    oudeUrls: products.reduce((sum, product) => sum + (product.legacyPaths?.length ?? 0), 0),
  };

  return NextResponse.json({
    ok: true,
    catalogus,
    orders: kv.enabled
      ? { storage: kv.mode, ping: kv.ok ? "pong" : "geen antwoord" }
      : { storage: "bestand (.data/orders)" },
    payments: mollieEnabled()
      ? { provider: "mollie", mode: mollieTestMode() ? "test" : "live" }
      : { provider: "demo" },
    stockHub,
    // De klusadviseur werkt altijd; met een Anthropic-sleutel begrijpt hij
    // ook vrij geformuleerde vragen in plaats van alleen trefwoorden.
    klusadviseur: process.env.ANTHROPIC_API_KEY
      ? { taalbegrip: "ai", model: "claude-opus-5" }
      : { taalbegrip: "trefwoorden", hint: "zet ANTHROPIC_API_KEY in Vercel voor vrije taal" },
    dashboard: DASHBOARD_API_URL,
  });
}
