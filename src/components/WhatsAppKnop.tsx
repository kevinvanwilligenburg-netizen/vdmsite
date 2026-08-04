"use client";

import { usePathname } from "next/navigation";

import { WHATSAPP_NUMMER } from "@/lib/site";

/**
 * Zwevende WhatsApp-knop. Klanten met een kleurvraag ("past dit op mijn
 * kozijn?") appen liever dan dat ze bellen, en een appje kost de winkel
 * minder tijd dan een telefoontje.
 *
 * Zonder NEXT_PUBLIC_WHATSAPP verschijnt de knop niet: een knop die naar een
 * nummer wijst dat niemand leest, is erger dan geen knop.
 */

/** Pagina's waar de knop in de weg zit of afleidt van het afrekenen. */
const NIET_OP = [/^\/afrekenen/, /^\/bestelling\//, /^\/account/];

export function WhatsAppKnop({ nummer }: { nummer?: string } = {}) {
  const pathname = usePathname();
  const nr = (nummer ?? "").replace(/[^0-9]/g, "") || WHATSAPP_NUMMER;
  if (!nr) return null;
  if (NIET_OP.some((patroon) => patroon.test(pathname))) return null;

  /*
   * Pagina's met een vastgeplakte actiebalk onderaan op mobiel. Daar schuift
   * de knop omhoog, anders ligt hij op de knop waar het om draait.
   *
   * Kevin stuurde een foto van de winkelwagen op zijn telefoon: het speldje
   * en de chatballon lagen precies over "Afrekenen", zodat het woord half
   * wegviel. De productpagina stond hier al in, de winkelwagen niet — en juist
   * daar staat de knop die geld oplevert.
   *
   * Dat er ook nog een Freshchat-ballon naast staat lost dit niet op; dat is
   * een tweede chatkanaal dat via Tag Manager binnenkomt.
   */
  const bovenKoopbalk = /^\/(product\/|winkelwagen)/.test(pathname);

  return (
    <a
      href={`https://wa.me/${nr}?text=${encodeURIComponent(
        "Hoi! Ik heb een vraag over ",
      )}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Stel je vraag via WhatsApp"
      title="Stel je vraag via WhatsApp"
      className={`fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg ring-1 ring-black/10 transition hover:scale-105 hover:bg-[#1EBE5B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:h-16 sm:w-16 ${
        bovenKoopbalk ? "bottom-24 sm:bottom-6" : "bottom-6"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 016.988 2.896 9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.359.101 11.945c0 2.096.549 4.142 1.595 5.945L0 24l6.305-1.654a11.94 11.94 0 005.71 1.454h.006c6.585 0 11.946-5.359 11.949-11.945a11.87 11.87 0 00-3.45-8.406" />
      </svg>
    </a>
  );
}
