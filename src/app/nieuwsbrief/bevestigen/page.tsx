import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";
import { bevestigAanmelding } from "@/lib/nieuwsbrief";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aanmelding bevestigen",
  robots: { index: false, follow: false },
};

/**
 * De klik uit de bevestigingsmail.
 *
 * Een gewone pagina en geen API-route: hier komt een mens vandaan uit zijn
 * mailprogramma, en die hoort een zin te lezen, geen JSON.
 */
export default async function Bevestigen({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const aanmelding = await bevestigAanmelding(String(searchParams.token ?? ""));

  return (
    <div className="mx-auto max-w-2xl">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Nieuwsbrief" }]} />
      <div className="card mt-6 p-6 sm:p-8">
        {aanmelding ? (
          <>
            <p className="flex items-center gap-2 text-xl font-black text-ink">
              <Icon name="check" className="h-6 w-6 shrink-0 text-green-700" strokeWidth={3} />
              Je staat op de lijst
            </p>
            <p className="mt-3 text-ink-soft">
              Bedankt. Je krijgt voortaan onze nieuwsbrief met acties, klustips en
              nieuwe producten. Geen zin meer? Onderaan elke mail staat een
              afmeldlink — één klik en je bent eraf.
            </p>
            <Link href="/" className="btn btn-primary mt-5">
              Verder winkelen
            </Link>
          </>
        ) : (
          <>
            <p className="text-xl font-black text-ink">Deze link werkt niet meer</p>
            {/*
              Eerlijk zijn over de twee oorzaken. "Er ging iets mis" laat
              iemand het nog vijf keer proberen met dezelfde dode link.
            */}
            <p className="mt-3 text-ink-soft">
              Een bevestigingslink is twee dagen geldig en kan maar één keer
              gebruikt worden. Was je al bevestigd, dan sta je gewoon op de lijst
              en hoef je niets te doen. Zo niet, meld je dan opnieuw aan — dat kan
              onderaan elke pagina.
            </p>
            <Link href="/" className="btn btn-primary mt-5">
              Naar de homepage
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
