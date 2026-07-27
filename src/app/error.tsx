"use client";

import { Icon } from "@/components/icons";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card mx-auto max-w-lg p-10 text-center">
      <span className="inline-flex text-brand" aria-hidden>
        <Icon name="wrench" className="h-14 w-14" strokeWidth={1.5} />
      </span>
      <h1 className="mt-3 text-2xl font-black text-ink">Er ging iets mis</h1>
      <p className="mt-2 text-ink-soft">
        Onze excuses — probeer het nog een keer. Blijft het misgaan, kom dan
        gerust langs in een van onze winkels.
      </p>
      <button type="button" onClick={reset} className="btn btn-primary mt-6">
        Probeer opnieuw
      </button>
    </div>
  );
}
