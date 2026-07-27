import { NextResponse } from "next/server";

import { getOrderSynced } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const order = await getOrderSynced(params.id);
  if (!order) {
    return NextResponse.json({ error: "Bestelling niet gevonden." }, { status: 404 });
  }
  return NextResponse.json(order);
}
