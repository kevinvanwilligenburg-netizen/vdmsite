import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { afmeldHandtekening, meldAf } from "@/lib/nieuwsbrief";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Afmelden voor de nieuwsbrief",
  robots: { index: false, follow: false },
};

/**
 * Afmelden met één klik, zonder inloggen.
 *
 * Dat "zonder inloggen" is geen gemak maar een eis: een afmeldlink die eerst
 * een wachtwoord vraagt is geen afmeldlink, en dan drukt iemand op "dit is
 * spam" — wat het hele verzenddomein raakt, inclusief de orderbevestigingen.
 *
 * De handtekening in de link voorkomt dat iemand anderen kan afmelden door
 * adressen in de URL te proberen.
 */
export default async function Afmelden({
  searchParams,
}: {
  searchParams: { e?: string; s?: string };
}) {
  const email = String(searchParams.e ?? "").trim().toLowerCase();
  const handtekening = String(searchParams.s ?? "");
  const klopt = Boolean(email) && handtekening === afmeldHandtekening(email);
  const gelukt = klopt ? await meldAf(email) : false;

  return (
    <div className="mx-auto max-w-2xl">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Afmelden" }]} />
      <div className="card mt-6 p-6 sm:p-8">
        {/*
          Geen aparte "je stond niet op de lijst"-tak meer. Contacten uit de
          Mailchimp-import staan wél in Resend maar niet in onze KV, en die
          kregen dan te horen dat ze nergens op stonden terwijl de nieuwsbrief
          gewoon bleef komen. `meldAf` handelt nu ook onbekende adressen af.
        */}
        {gelukt ? (
          <>
            <p className="text-xl font-black text-ink">Je bent afgemeld</p>
            <p className="mt-3 text-ink-soft">
              We sturen je geen nieuwsbrief meer. Bestel je iets, dan krijg je nog
              wel gewoon je orderbevestiging en het bericht als je pakket onderweg
              is — dat hoort bij je bestelling en staat hier los van.
            </p>
          </>
        ) : (
          <>
            <p className="text-xl font-black text-ink">Deze afmeldlink klopt niet</p>
            <p className="mt-3 text-ink-soft">
              Gebruik de link onderaan de nieuwsbrief zelf. Lukt het niet, mail dan{" "}
              <a
                href="mailto:klantenservice@devoordeelmarkt.nl"
                className="font-bold text-brand hover:underline"
              >
                klantenservice@devoordeelmarkt.nl
              </a>{" "}
              — dan halen we je er met de hand af.
            </p>
          </>
        )}
        <Link href="/" className="btn btn-primary mt-5">
          Naar de homepage
        </Link>
      </div>
    </div>
  );
}
