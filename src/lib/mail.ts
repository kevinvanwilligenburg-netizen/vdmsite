import { mailInHuisstijl } from "@/lib/mailhuisstijl";
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
  /**
   * Blinde kopie, voor Trustpilot's uitnodigingsservice: die leest de
   * orderbevestiging mee en nodigt de klant namens ons uit voor een review.
   * Alleen meesturen bij bevestigingen — niet bij inlogcodes.
   */
  bcc?: string;
}

export type MailResultaat =
  | { ok: true; via: "dashboard" | "resend" }
  | { ok: false; reden: string };

/**
 * De afzender.
 *
 * `RESEND_FROM` staat in Vercel (noreply@mail.devoordeelmarkt.nl; dat
 * subdomein is op 3 augustus 2026 in Resend geverifieerd, het kale domein
 * niet — vandaar de "mail." ervoor). `MAIL_FROM` is de oudere naam en
 * blijft werken. Staat er alleen een adres zonder naam, dan zetten we
 * "De Voordeelmarkt" ervoor: in de inbox lees je anders alleen "noreply".
 */
const AFZENDER = metNaam(
  process.env.MAIL_FROM ?? process.env.RESEND_FROM ?? "noreply@devoordeelmarkt.nl",
);

function metNaam(afzender: string): string {
  const waarde = afzender.trim();
  return waarde.includes("<") ? waarde : `De Voordeelmarkt <${waarde}>`;
}

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
        ...(bericht.bcc ? { bcc: bericht.bcc } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { ok: true, via: "dashboard" };
    // De afzender kiezen we bewust niet zelf: dat zou van deze route een
    // open relay maken waarmee iemand namens ons kan mailen.
    //
    // Het antwoord van de andere kant erbij loggen, niet alleen de status.
    // "status 404" zei niet dat de route daar niet bestond, en "status 403"
    // niet dat het afzenderdomein niet geverifieerd was — dat kostte een
    // avond zoeken terwijl het antwoord in de body stond.
    console.error(
      `[mail] dashboard gaf status ${res.status}: ${(await res.text()).slice(0, 300)}`,
    );
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
        ...(bericht.bcc ? { bcc: [bericht.bcc] } : {}),
        subject: bericht.onderwerp,
        text: bericht.tekst,
        ...(bericht.html ? { html: bericht.html } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return { ok: true, via: "resend" };
    console.error(
      `[mail] Resend gaf status ${res.status} voor afzender "${AFZENDER}": ${(
        await res.text()
      ).slice(0, 300)}`,
    );
    return null;
  } catch (error) {
    console.error("[mail] Resend mislukt:", error);
    return null;
  }
}

/**
 * De huisstijl gaat er hier omheen, niet bij elke afzonderlijke mail.
 *
 * Zo hoeft een nieuwe mail alleen zijn eigen alinea's te schrijven en krijgt
 * hij logo, winkels, klantenservice en bedrijfsgegevens vanzelf. Wie het toch
 * helemaal zelf wil doen, stuurt een compleet document mee; dat laten we met
 * rust.
 */
async function metHuisstijl(bericht: MailBericht): Promise<MailBericht> {
  if (!bericht.html) return bericht;
  if (/<(?:!doctype|html|body)\b/i.test(bericht.html)) return bericht;
  try {
    const html = await mailInHuisstijl({
      inhoud: bericht.html,
      // De eerste regel platte tekst is precies de samenvatting die de inbox
      // naast het onderwerp toont.
      voorbeeldtekst: bericht.tekst.split("\n").find((regel) => regel.trim().length > 12),
    });
    return { ...bericht, html };
  } catch (error) {
    // Opmaak is nooit een reden om een mail niet te versturen.
    console.error("[mail] huisstijl mislukt, ongewijzigd verstuurd:", error);
    return bericht;
  }
}

export async function verstuurMail(bericht: MailBericht): Promise<MailResultaat> {
  const opgemaakt = await metHuisstijl(bericht);
  return (
    (await viaDashboard(opgemaakt)) ??
    (await viaResend(opgemaakt)) ?? {
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

/**
 * Controleert of er écht gemaild kan worden, zonder een mail te sturen.
 *
 * De vorige statuscheck keek alleen of de sleutels bestónden en meldde
 * vrolijk "mail: via dashboard" terwijl die route een 404 gaf en Resend het
 * afzenderdomein weigerde. Een statuscheck die groen is terwijl het stuk is,
 * is erger dan geen statuscheck.
 */
export async function mailDiagnose(): Promise<{
  werkt: boolean;
  afzender: string;
  dashboard: string;
  resend: string;
}> {
  let dashboard = "niet geconfigureerd (SITE_API_KEY ontbreekt)";
  const sleutel = process.env.SITE_API_KEY;
  if (sleutel) {
    try {
      // Een OPTIONS-verzoek zegt of de route bestaat, zonder iets te sturen.
      const res = await fetch(`${DASHBOARD_API_URL}/api/mail/verstuur`, {
        method: "OPTIONS",
        headers: { Authorization: `Bearer ${sleutel}` },
        signal: AbortSignal.timeout(6000),
      });
      dashboard = res.status === 404 ? "route bestaat niet (404)" : `bereikbaar (${res.status})`;
    } catch {
      dashboard = "onbereikbaar";
    }
  }

  let resend = "niet geconfigureerd (RESEND_API_KEY ontbreekt)";
  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      const res = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) {
        resend = `sleutel geweigerd (${res.status})`;
      } else {
        const data = (await res.json()) as {
          data?: { name?: string; status?: string }[];
        };
        const domeinen = data.data ?? [];
        // Waar mailen we vandaan, en mag dat?
        const afzenderDomein = (AFZENDER.match(/@([^>\s]+)/)?.[1] ?? "").toLowerCase();
        const match = domeinen.find((d) =>
          afzenderDomein.endsWith((d.name ?? "").toLowerCase()),
        );
        resend = !match
          ? `afzenderdomein "${afzenderDomein}" staat niet in Resend`
          : match.status === "verified"
            ? "klaar"
            : `afzenderdomein "${match.name}" is nog "${match.status}"`;
      }
    } catch {
      resend = "onbereikbaar";
    }
  }

  return {
    werkt: dashboard.startsWith("bereikbaar") || resend === "klaar",
    afzender: AFZENDER,
    dashboard,
    resend,
  };
}
