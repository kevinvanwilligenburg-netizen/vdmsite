import { DASHBOARD_API_URL } from "@/lib/site";

/**
 * Mail versturen.
 *
 * Twee wegen, in deze volgorde:
 *
 *  1. Het VDM-dashboard, als dat een mailroute heeft. Voorkeur, want daar
 *     staan de afzender, de huisstijl en de bezorglogboeken al.
 *  2. Resend, als `RESEND_API_KEY` is gezet.
 *
 * Kan geen van beide, dan geeft deze functie dat eerlijk terug in plaats van
 * te doen alsof het gelukt is — een inlogcode die nooit aankomt is erger dan
 * een nette foutmelding.
 */

export interface MailBericht {
  aan: string;
  onderwerp: string;
  tekst: string;
  html?: string;
}

export type MailResultaat =
  | { ok: true; via: "dashboard" | "resend" }
  | { ok: false; reden: string };

const AFZENDER = process.env.MAIL_FROM ?? "De Voordeelmarkt <noreply@devoordeelmarkt.nl>";

async function viaDashboard(bericht: MailBericht): Promise<MailResultaat | null> {
  const sleutel = process.env.SITE_API_KEY;
  if (!sleutel) return null;

  try {
    const res = await fetch(`${DASHBOARD_API_URL}/api/mail/verstuur`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sleutel}`,
      },
      body: JSON.stringify({
        shop: "vdmsite",
        to: bericht.aan,
        subject: bericht.onderwerp,
        text: bericht.tekst,
        html: bericht.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { ok: true, via: "dashboard" };
    // De afzender kiezen we bewust niet zelf: dat zou van deze route een
    // open relay maken waarmee iemand namens ons kan mailen.
    console.error("[mail] dashboard gaf status", res.status);
    return null;
  } catch (error) {
    console.error("[mail] dashboard onbereikbaar:", error);
    return null;
  }
}

async function viaResend(bericht: MailBericht): Promise<MailResultaat | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: AFZENDER,
        to: [bericht.aan],
        subject: bericht.onderwerp,
        text: bericht.tekst,
        ...(bericht.html ? { html: bericht.html } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return { ok: true, via: "resend" };
    console.error("[mail] Resend gaf status", res.status);
    return null;
  } catch (error) {
    console.error("[mail] Resend mislukt:", error);
    return null;
  }
}

export async function verstuurMail(bericht: MailBericht): Promise<MailResultaat> {
  return (
    (await viaDashboard(bericht)) ??
    (await viaResend(bericht)) ?? {
      ok: false,
      reden:
        "Geen mailkanaal beschikbaar. Zet RESEND_API_KEY, of laat het dashboard /api/mail/verstuur aanbieden.",
    }
  );
}

/** Voor de statuscheck: kunnen we überhaupt mailen? */
export function mailKanaal(): "resend" | "dashboard-of-geen" {
  return process.env.RESEND_API_KEY ? "resend" : "dashboard-of-geen";
}
