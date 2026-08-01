import { NextResponse } from "next/server";

import { beoordeelVoucher, normaliseerVoucherCode } from "@/lib/vouchers";

export const dynamic = "force-dynamic";

/**
 * Beoordeelt een staal-vouchercode voor de checkout: bestaat hij, is hij
 * onbenut en niet verlopen, en wat is hij waard? De checkout-route beoordeelt
 * bij het afrekenen opnieuw — dit is alleen de spiegel voor het formulier.
 */
export async function POST(request: Request) {
  let body: { code?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ status: "onbekend", melding: "Ongeldige aanvraag." });
  }

  const code = normaliseerVoucherCode(body.code ?? "");
  if (!code) {
    return NextResponse.json({ status: "onbekend", melding: "Vul een vouchercode in." });
  }

  const oordeel = await beoordeelVoucher(code);
  if (oordeel.status !== "geldig") {
    return NextResponse.json({ status: oordeel.status, melding: oordeel.melding });
  }
  return NextResponse.json({
    status: "geldig",
    code: oordeel.voucher.code,
    // In centen, net als alle catalogusbedragen aan de clientkant.
    bedrag: oordeel.voucher.bedrag,
  });
}
