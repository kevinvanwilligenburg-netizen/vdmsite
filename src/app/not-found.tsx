import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-lg p-10 text-center">
      <p className="text-6xl font-black italic text-brand">404</p>
      <h1 className="mt-3 text-2xl font-black text-ink">Deze pagina is uitverkocht</h1>
      <p className="mt-2 text-ink-soft">
        De pagina die je zoekt bestaat niet (meer). Geen zorgen — de voordeeltjes
        liggen gewoon in de schappen.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-primary">
          Naar de homepage
        </Link>
        <Link href="/zoeken" className="btn btn-dark">
          Zoeken
        </Link>
      </div>
    </div>
  );
}
