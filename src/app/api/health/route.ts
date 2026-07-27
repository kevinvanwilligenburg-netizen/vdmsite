import { NextResponse } from "next/server";

import { kvPing } from "@/lib/kv";
import { mollieEnabled, mollieTestMode } from "@/lib/mollie";
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

  let stockHub: { reachable: boolean; configured: boolean } = {
    reachable: false,
    configured: false,
  };
  try {
    const res = await fetch(`${DASHBOARD_API_URL}/api/voorraad/skus?skus=ping`, {
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as { configured?: boolean };
      stockHub = { reachable: true, configured: data.configured === true };
    }
  } catch {
    // niet bereikbaar; demo-voorraad blijft actief
  }

  const products = await getProducts();
  const catalogus = {
    producten: products.length,
    metFoto: products.filter((product) => product.image).length,
    mengverf: products.filter((product) => product.colorMixable).length,
    metBasiskeuze: products.filter((product) =>
      (product.variants ?? []).some((variant) => variant.base),
    ).length,
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
    dashboard: DASHBOARD_API_URL,
  });
}
