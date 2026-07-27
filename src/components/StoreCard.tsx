import Link from "next/link";

import { Icon } from "@/components/icons";
import type { Store } from "@/lib/types";

export function StoreCard({ store }: { store: Store }) {
  const today = new Intl.DateTimeFormat("nl-NL", { weekday: "long" }).format(new Date());
  const todayHours = store.openingHours.find(
    (entry) => entry.day.toLowerCase() === today.toLowerCase(),
  );
  return (
    <Link
      href={`/winkels/${store.slug}`}
      className="card group flex flex-col gap-2 p-5 transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <span className="text-brand" aria-hidden>
        <Icon name="store" className="h-8 w-8" />
      </span>
      <h3 className="text-lg font-black text-ink group-hover:text-brand">{store.city}</h3>
      <p className="text-sm text-ink-soft">
        {store.address}
        <br />
        {store.postalCode} {store.city}
      </p>
      {todayHours && (
        <p className="text-sm font-semibold text-ink">
          Vandaag:{" "}
          <span className={todayHours.hours === "Gesloten" ? "text-brand" : "text-green-700"}>
            {todayHours.hours}
          </span>
        </p>
      )}
      <span className="mt-auto pt-2 text-sm font-bold text-brand">
        Bekijk winkel →
      </span>
    </Link>
  );
}
