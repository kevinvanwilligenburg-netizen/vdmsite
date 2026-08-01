import { NextResponse } from "next/server";

import { markeerHerinnerd, vouchersVoorHerinnering } from "@/lib/vouchers";
import { stuurVoucherHerinnering } from "@/lib/vouchermail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Herinnert klanten één keer aan een onbenutte staal-voucher (na twee weken).
 * Draait op een cron (zie vercel.json); zelfde slot als de andere mailcron.
 *
 * Het stempel `herinnerdOp` wordt pas gezet als de mail ook echt is verstuurd
 * — een mislukte verzending komt zo in de volgende ronde gewoon terug.
 */
function magDit(request: Request): boolean {
  const meegegeven = request.headers.get("authorization") ?? "";
  const sleutels = [process.env.CRON_SECRET, process.env.SITE_API_KEY].filter(Boolean);
  if (sleutels.length === 0) return false;
  return sleutels.some((sleutel) => meegegeven === `Bearer ${sleutel}`);
}

export async function GET(request: Request) {
  if (!magDit(request)) {
    return NextResponse.json({ error: "Niet toegestaan." }, { status: 401 });
  }

  const klaar = await vouchersVoorHerinnering();
  let gemaild = 0;
  let mislukt = 0;

  for (const voucher of klaar) {
    const ok = await stuurVoucherHerinnering(voucher);
    if (ok) {
      await markeerHerinnerd(voucher.code);
      gemaild++;
    } else {
      mislukt++;
    }
  }

  return NextResponse.json({ ok: true, kandidaten: klaar.length, gemaild, mislukt });
}
