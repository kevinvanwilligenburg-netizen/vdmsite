"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card mx-auto max-w-lg p-10 text-center">
      <p className="text-5xl" aria-hidden>
        🛠️
      </p>
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
