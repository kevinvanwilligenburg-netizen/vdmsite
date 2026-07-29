"use client";

/**
 * Afdrukken (of via de printdialoog opslaan als pdf). Eén knopje, maar het
 * moet een client-component zijn: `window.print()` bestaat alleen in de
 * browser.
 */
export function PrintKnop({ label = "Afdrukken of opslaan als pdf" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg border-2 border-ink/10 px-4 py-2 text-sm font-bold text-ink transition hover:border-brand hover:text-brand"
    >
      {label}
    </button>
  );
}
