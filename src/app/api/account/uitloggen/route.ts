import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { beeindigSessie, SESSIE_COOKIE } from "@/lib/account";

export const dynamic = "force-dynamic";

/** Uitloggen: de sessie vervalt aan beide kanten, niet alleen in de browser. */
export async function POST() {
  const token = cookies().get(SESSIE_COOKIE)?.value;
  await beeindigSessie(token);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSIE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
