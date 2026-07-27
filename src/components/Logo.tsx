import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" aria-label="De Voordeelmarkt – naar de homepage" className="inline-flex">
      <span className="inline-flex -skew-x-6 items-center rounded-md bg-accent px-3 py-1.5 shadow-sm ring-1 ring-black/5">
        <span className="skew-x-6 whitespace-nowrap text-lg font-black uppercase italic leading-none tracking-tight sm:text-xl">
          <span className="text-ink">De</span>{" "}
          <span className="text-brand">Voordeelmarkt</span>
        </span>
      </span>
    </Link>
  );
}
