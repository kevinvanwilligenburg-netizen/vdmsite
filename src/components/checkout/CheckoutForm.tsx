"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { InlogInline } from "@/components/account/InlogInline";
import { useCart } from "@/components/cart/CartProvider";
import { useKorting } from "@/components/cart/useKorting";
import { Icon } from "@/components/icons";
import { Mark } from "@/components/Mark";
import { useStore } from "@/components/store/StoreProvider";
import { TrustpilotWidget } from "@/components/TrustpilotWidget";
import { usePrijsModus } from "@/components/prijs/PrijsWeergave";
import { betaalmethodenVoor } from "@/lib/betaalmethoden";
import { SAME_DAY_CUTOFF_HOUR } from "@/lib/delivery";
import { BTW_TARIEF } from "@/lib/factuur";
import { CONTACT_PHONE, WHATSAPP_NUMMER, WHATSAPP_TIJDEN } from "@/lib/site";
import { BEDRIJFSTYPEN } from "@/lib/zakelijk";
import { euro } from "@/lib/format";

interface StoreOption {
  id: string;
  slug: string;
  name: string;
  address: string;
  city: string;
  /** Afhaalbelofte voor deze winkel, server-side berekend op openingstijden. */
  pickupLabel: string;
}

interface StoreAvailability {
  storeId: string;
  city: string;
  complete: boolean;
  missing: string[];
}

type Fulfilment = "delivery" | "pickup";

/** Antwoord van /api/bezorgopties: wat kan er, en wat kost het? */
interface BezorgOpties {
  /* Wat Mollie op dit bedrag aankan; null als het ophalen mislukte. */
  betaalmethoden?: string[] | null;
  standaard: { type: string; label: string; kosten: number };
  sameDay: { beschikbaar: boolean; toeslag?: number; label?: string; cutoffUur: number };
  verzending: {
    land: "NL" | "BE";
    kosten: number;
    gratisVanaf: number;
    tarief: number;
    tekort: number;
    /** Gratis omdat er een franco merk in het mandje ligt (Sikkens). */
    franco?: boolean;
  };
}

export function CheckoutForm({
  stores,
  ingelogdAls,
  voorkeurWinkel,
  whatsappNummer,
  bekend,
}: {
  stores: StoreOption[];
  /** E-mailadres van de ingelogde klant; korting hangt hieraan. */
  ingelogdAls?: string;
  /** Winkel uit het account (slug), of "online". */
  voorkeurWinkel?: string;
  /** WhatsApp-nummer uit het portal; env-variabele als terugval. */
  whatsappNummer?: string;
  /**
   * Wat we al van deze klant weten, uit zijn account.
   *
   * De accountpagina belooft "Bij het afrekenen vullen we dit vast voor je
   * in". Dat gebeurde niet: iemand die net had ingelogd moest naam en adres
   * alsnog overtikken. Alleen als beginwaarde gebruikt — daarna is het veld
   * gewoon van de klant, want hij mag naar een ander adres laten bezorgen.
   */
  bekend?: {
    voornaam?: string;
    achternaam?: string;
    telefoon?: string;
    straat?: string;
    huisnummer?: string;
    postcode?: string;
    plaats?: string;
  };
}) {
  const { items, subtotal, hydrated } = useCart();
  const { favourite } = useStore();
  const [fulfilment, setFulfilment] = useState<Fulfilment>("delivery");
  const [firstName, setFirstName] = useState(bekend?.voornaam ?? "");
  const [lastName, setLastName] = useState(bekend?.achternaam ?? "");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState(ingelogdAls ?? "");
  const [phone, setPhone] = useState(bekend?.telefoon ?? "");
  const [street, setStreet] = useState(bekend?.straat ?? "");
  const [houseNumber, setHouseNumber] = useState(bekend?.huisnummer ?? "");
  const [houseNumberSuffix, setHouseNumberSuffix] = useState("");
  const [postalCode, setPostalCode] = useState(bekend?.postcode ?? "");
  const [city, setCity] = useState(bekend?.plaats ?? "");
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<StoreAvailability[] | null>(null);
  const [checkingStock, setCheckingStock] = useState(false);
  const [country, setCountry] = useState<"NL" | "BE">("NL");
  const [sameDay, setSameDay] = useState(false);
  const [opties, setOpties] = useState<BezorgOpties | null>(null);
  const [betaalmethode, setBetaalmethode] = useState("ideal");
  // Wat Mollie op dit mandje aankan. Null zolang we het niet weten of het
  // ophalen mislukte; dan tonen we onze eigen lijst en laat Mollie beslissen.
  const molliesMethoden = opties?.betaalmethoden ?? null;

  // Particulier of zakelijk; bepaalt de velden én de kortingsgrond. De
  // korting zelf beslist de server — dit stuurt alleen wat we meesturen en
  // wat we alvast laten zien.
  const [klantType, setKlantType] = useState<"particulier" | "zakelijk">("particulier");
  const [accountAanmaken, setAccountAanmaken] = useState(false);
  // Inlogblok bovenin, dichtgeklapt tot iemand er zelf op klikt: wie als gast
  // wil afrekenen mag daar geen drempel bij krijgen.
  const [inlogOpen, setInlogOpen] = useState(false);
  const [profpas, setProfpas] = useState(false);
  const [kvkNummer, setKvkNummer] = useState("");
  const [btwNummer, setBtwNummer] = useState("");
  const [bedrijfsType, setBedrijfsType] = useState("");
  const [viesStatus, setViesStatus] = useState<
    "leeg" | "bezig" | "geldig" | "ongeldig" | "onbeslist"
  >("leeg");
  const [viesNaam, setViesNaam] = useState("");

  // Live BTW-controle zodra het veld verlaten wordt: de klant hoort meteen
  // of zijn nummer klopt, niet pas na de bestelknop. De server controleert
  // bij het afrekenen opnieuw — dit is alleen de spiegel.
  const controleerBtwLive = () => {
    const nummer = btwNummer.trim();
    if (!nummer) {
      setViesStatus("leeg");
      return;
    }
    setViesStatus("bezig");
    fetch("/api/zakelijk/vies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ btw: nummer }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.status === "geldig" || data?.status === "ongeldig" || data?.status === "onbeslist") {
          setViesStatus(data.status);
          setViesNaam(typeof data.naam === "string" ? data.naam : "");
        } else {
          setViesStatus("onbeslist");
        }
      })
      .catch(() => setViesStatus("onbeslist"));
  };

  // Waar de korting op dit moment op staat; de server toetst dit opnieuw.
  // Regels Kevin: een Nederlands bedrijf legitimeert zich met KvK (acht
  // cijfers), een buitenlands bedrijf met een VIES-bevestigd BTW-nummer.
  const zakelijkGecontroleerd =
    country === "NL"
      ? kvkNummer.replace(/[^0-9]/g, "").length === 8
      : viesStatus === "geldig";
  const kortingActief = Boolean(
    ingelogdAls ||
      (klantType === "particulier" && accountAanmaken) ||
      (klantType === "zakelijk" && profpas && zakelijkGecontroleerd),
  );

  // Apple Pay alleen tonen waar het ook echt werkt (Safari op een Apple-
  // apparaat met een kaart in de Wallet). Bieden we het overal aan, dan kiest
  // iemand op Windows het en weigert Mollie de betaling.
  const [applePay, setApplePay] = useState(false);
  useEffect(() => {
    const sessie = (window as { ApplePaySession?: { canMakePayments?: () => boolean } })
      .ApplePaySession;
    setApplePay(Boolean(sessie?.canMakePayments?.()));
  }, []);

  const methoden = useMemo(
    () =>
      betaalmethodenVoor(country).filter((methode) => {
        // Wat Mollie op dit bedrag niet aankan, tonen we niet. Klarna stond
        // hier als tegel terwijl het profiel hem weigerde: je klikte erop en
        // belandde op Mollie's keuzescherm waar hij ook niet tussen stond.
        // Apple en Google Pay staan niet in die lijst omdat Mollie ze pas op
        // zijn eigen pagina aanbiedt; die blijven we zelf beoordelen.
        if (
          molliesMethoden &&
          methode.id !== "applepay" &&
          methode.id !== "googlepay" &&
          !molliesMethoden.includes(methode.id)
        ) {
          return false;
        }
        if (methode.id === "applepay") return applePay;
        // Google Pay werkt via Mollie in elke browser mét een Google-account,
        // maar op een Apple Pay-apparaat is dat de vreemde eend: daar tonen we
        // Apple Pay. Alle twee tegelijk is keuzestress zonder winst.
        if (methode.id === "googlepay") return !applePay;
        // Op rekening (Billie) is er alleen voor bedrijven; de tegel
        // verschijnt zodra er een bedrijfsnaam staat.
        if (methode.zakelijk) return company.trim().length >= 2;
        return true;
      }),
    [country, applePay, company, molliesMethoden],
  );
  // Verdwijnt de gekozen methode (ander land, geen Apple Pay), val dan terug
  // op de eerste die er wél is.
  useEffect(() => {
    if (!methoden.some((methode) => methode.id === betaalmethode)) {
      setBetaalmethode(methoden[0]?.id ?? "ideal");
    }
  }, [methoden, betaalmethode]);
  const gekozenMethode = methoden.find((methode) => methode.id === betaalmethode);

  // Artikelen die niet in een pakket passen (kruiwagen, zak strooizout van
  // 25 kg). Zitten die in het mandje, dan kan de bestelling alleen afgehaald
  // worden — de checkout-route weigert 'm anders alsnog.
  const zwareArtikelen = useMemo(
    () =>
      items
        .filter((item) => item.pickupOnly)
        .map((item) => [item.name, item.variantName].filter(Boolean).join(" ")),
    [items],
  );
  useEffect(() => {
    if (zwareArtikelen.length > 0) setFulfilment("pickup");
  }, [zwareArtikelen.length]);

  /*
   * Alleen winkels waar de hele bestelling ligt.
   *
   * Eerder stonden alle vijf de winkels er, met "2 artikelen liggen hier niet"
   * eronder — vier rijen die de klant moest lezen om er één te kunnen kiezen,
   * en drie ervan waren geen keuze. Weten we de voorraad nog niet, dan tonen
   * we ze allemaal; anders knippert de lijst tijdens het laden.
   */
  const afhaalwinkels = useMemo(() => {
    if (!availability) return stores;
    const compleet = new Set(
      availability.filter((entry) => entry.complete).map((entry) => entry.storeId),
    );
    return stores.filter((store) => compleet.has(store.slug));
  }, [availability, stores]);

  // Ligt de bestelling nergens compleet, dan is afhalen geen optie en hoort
  // die keuze er ook niet te staan.
  const afhalenKan = afhaalwinkels.length > 0;
  useEffect(() => {
    if (!afhalenKan && fulfilment === "pickup" && zwareArtikelen.length === 0) {
      setFulfilment("delivery");
    }
  }, [afhalenKan, fulfilment, zwareArtikelen.length]);

  // De voorgeselecteerde winkel moet er wel bij staan.
  useEffect(() => {
    if (afhaalwinkels.length > 0 && !afhaalwinkels.some((store) => store.id === storeId)) {
      setStoreId(afhaalwinkels[0].id);
    }
  }, [afhaalwinkels, storeId]);

  // De exacte bezorgdag hangt af van de voorraad per artikel; die bepaalt de
  // server bij het plaatsen van de bestelling. Hier tonen we alleen of de
  // 09:00-cutoff nog loopt.
  const [beforeCutoff, setBeforeCutoff] = useState(
    () => new Date().getHours() < SAME_DAY_CUTOFF_HOUR,
  );
  useEffect(() => {
    const timer = window.setInterval(
      () => setBeforeCutoff(new Date().getHours() < SAME_DAY_CUTOFF_HOUR),
      30_000,
    );
    return () => window.clearInterval(timer);
  }, []);

  /*
   * Het kenmerk waarop het dashboard verlaten wagens ontdubbelt.
   *
   * Hetzelfde kenmerk ververst een bestaande lead; een ander kenmerk met
   * hetzelfde adres levert een tweede lead op. Het blijft dus in de browser
   * staan tot de bestelling rond is — dan gooien we het weg, zodat een
   * volgende wagen een eigen lead wordt en niet de afgeronde overschrijft.
   */
  const leadId = useCallback(() => {
    try {
      const sleutel = "vdm-lead";
      const bestaand = window.localStorage.getItem(sleutel);
      if (bestaand) return bestaand;
      const nieuw =
        typeof crypto?.randomUUID === "function"
          ? crypto.randomUUID()
          : `lead-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      window.localStorage.setItem(sleutel, nieuw);
      return nieuw;
    } catch {
      // Privémodus zonder opslag: dan maar één lead per poging.
      return `lead-${Math.random().toString(36).slice(2)}`;
    }
  }, []);

  // Zodra het e-mailadres compleet is, geven we het mandje door aan het
  // dashboard. Haakt de klant daarna af, dan kan die er een herinnering over
  // sturen. Eén keer per adres, en pas als de klant even stil is.
  const gemeldRef = useRef<string>("");
  useEffect(() => {
    const adres = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(adres) || adres === gemeldRef.current) return;
    if (items.length === 0) return;
    const timer = window.setTimeout(() => {
      gemeldRef.current = adres;
      fetch("/api/winkelwagen/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: leadId(),
          email: adres,
          items: items.map((item) => ({
            title: item.name,
            quantity: item.qty,
            price: item.unitPrice / 100,
            variant: [item.variantName, item.color?.name].filter(Boolean).join(" · "),
          })),
          total: subtotal / 100,
        }),
      }).catch(() => undefined);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [email, items, subtotal]);

  // De favoriete winkel staat voorgeselecteerd. De keuze uit het account gaat
  // voor die van de winkelkiezer: die eerste reist mee naar een ander
  // apparaat, de tweede staat alleen in deze browser.
  useEffect(() => {
    const slug = voorkeurWinkel && voorkeurWinkel !== "online" ? voorkeurWinkel : favourite?.slug;
    if (!slug) return;
    const match = stores.find((store) => store.slug === slug);
    if (match) setStoreId(match.id);
  }, [favourite, stores, voorkeurWinkel]);

  // Welke winkels hebben deze hele bestelling liggen? Alleen relevant bij
  // afhalen, dus we vragen het pas als de klant daarvoor kiest.
  useEffect(() => {
    if (fulfilment !== "pickup" || items.length === 0) return;
    let active = true;
    setCheckingStock(true);
    fetch("/api/voorraad/winkels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((item) => ({ sku: item.sku ?? item.productId, quantity: item.qty })),
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { live: boolean; stores: StoreAvailability[] } | null) => {
        if (active && data?.live) setAvailability(data.stores);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setCheckingStock(false);
      });
    return () => {
      active = false;
    };
  }, [fulfilment, items]);

  // Uit de catalogus, niet uit de winkelwagen: die bewaart een
  // prijsmomentopname die kan verouderen. Zie /api/korting. Vóór het
  // bezorgopties-effect gedeclareerd, want dat rekent ermee.
  const { bedrag: kluspasKorting, pas: kortingPas } = useKorting(items);

  // Staal-voucher: code invullen, server beoordeelt. Het bedrag hier is de
  // spiegel; bij het afrekenen beoordeelt de checkout-route opnieuw.
  const [voucherInvoer, setVoucherInvoer] = useState("");
  const [voucher, setVoucher] = useState<{ code: string; bedrag: number } | null>(null);
  const [voucherMelding, setVoucherMelding] = useState<string | null>(null);
  const [voucherBezig, setVoucherBezig] = useState(false);

  const pasVoucherToe = () => {
    const code = voucherInvoer.trim();
    if (!code) return;
    setVoucherBezig(true);
    setVoucherMelding(null);
    fetch("/api/voucher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { status?: string; code?: string; bedrag?: number; melding?: string } | null) => {
        if (data?.status === "geldig" && data.code && typeof data.bedrag === "number") {
          setVoucher({ code: data.code, bedrag: data.bedrag });
        } else {
          setVoucher(null);
          setVoucherMelding(data?.melding ?? "De voucher kon niet gecontroleerd worden.");
        }
      })
      .catch(() => setVoucherMelding("De voucher kon niet gecontroleerd worden."))
      .finally(() => setVoucherBezig(false));
  };

  // Nooit meer korting dan er te betalen valt.
  const voucherKorting = voucher
    ? Math.min(voucher.bedrag, Math.max(0, subtotal - (kortingActief ? kluspasKorting : 0)))
    : 0;

  // Bezorgopties bij de server opvragen: die kent de voorraad en de klok.
  useEffect(() => {
    if (fulfilment !== "delivery" || items.length === 0) return;
    let actief = true;
    fetch("/api/bezorgopties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((item) => ({ sku: item.sku ?? item.productId, quantity: item.qty })),
        // Hetzelfde bedrag als waar de server straks verzendkosten over
        // rekent: mét korting als die geldt. Op het kale subtotaal rekenen
        // liet de klant "Gratis" zien terwijl Mollie € 4,95 meer inde —
        // korting aanvinken kon de betaling zo duurder maken.
        subtotal: Math.max(
          0,
          (kortingActief ? subtotal - kluspasKorting : subtotal) - voucherKorting,
        ),
        country,
        // Profpas geeft altijd gratis bezorging, dus de prijsopgave hier moet
        // dat meenemen. De server controleert het KvK- of BTW-nummer zelf nog
        // voordat hij de korting echt toepast.
        ...(klantType === "zakelijk" && profpas && zakelijkGecontroleerd
          ? { profpas: true }
          : {}),
      }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: BezorgOpties | null) => {
        if (!actief || !data) return;
        setOpties(data);
        // Is vandaag intussen niet meer mogelijk (cutoff voorbij), dan valt de
        // keuze terug op morgen in plaats van stilletjes te blijven staan.
        if (!data.sameDay.beschikbaar) setSameDay(false);
      })
      .catch(() => undefined);
    return () => {
      actief = false;
    };
  }, [fulfilment, items, subtotal, country, kortingActief, kluspasKorting, voucherKorting]);

  // Bedragen die op meerdere plekken in het overzicht terugkomen.
  const verzendkosten = fulfilment === "pickup" ? 0 : (opties?.verzending.kosten ?? 0);
  const toeslag = fulfilment === "delivery" && sameDay ? (opties?.sameDay.toeslag ?? 0) : 0;

  // Zonder account geen korting: de server rekent hem ook alleen door voor
  // een ingelogde klant.
  const totaal =
    subtotal - (kortingActief ? kluspasKorting : 0) - voucherKorting + verzendkosten + toeslag;
  const tekortVoorGratis = fulfilment === "delivery" ? (opties?.verzending.tekort ?? 0) : 0;

  // Wie de site op excl. btw heeft staan, moet die lijn hier niet kwijtraken:
  // regels excl., btw als eigen regel, en het totaal inclusief — dat is wat
  // Mollie straks int. De btw-regel is het exacte verschil, zodat de kolom
  // ook na afronding per regel altijd optelt tot het totaal.
  const { modus } = usePrijsModus();
  const exclVan = (centen: number) => Math.round(centen / (1 + BTW_TARIEF));
  const toon = (centen: number) => euro(modus === "excl" ? exclVan(centen) : centen);
  const btwRegel =
    totaal -
    (exclVan(subtotal) -
      (kortingActief ? exclVan(kluspasKorting) : 0) -
      exclVan(voucherKorting) +
      exclVan(verzendkosten) +
      exclVan(toeslag));

  if (!hydrated) {
    return <p className="py-16 text-center text-ink-soft">Bestelgegevens laden…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="card mx-auto max-w-lg p-10 text-center">
        <h2 className="text-xl font-black text-ink">Je winkelwagen is leeg</h2>
        <p className="mt-2 text-ink-soft">Voeg eerst artikelen toe voordat je afrekent.</p>
        <Link href="/" className="btn btn-primary mt-6">
          Naar de winkel
        </Link>
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fulfilment,
          klantType,
          ...(klantType === "particulier" && accountAanmaken ? { accountAanmaken: true } : {}),
          ...(klantType === "zakelijk"
            ? {
                ...(profpas ? { profpas: true } : {}),
                ...(kvkNummer.trim() ? { kvk: kvkNummer.trim() } : {}),
                ...(btwNummer.trim() ? { btw: btwNummer.trim() } : {}),
                ...(bedrijfsType ? { bedrijfsType } : {}),
              }
            : {}),
          customer: {
            firstName,
            lastName,
            ...(klantType === "zakelijk" && company.trim()
              ? { company: company.trim() }
              : {}),
            email,
            phone,
            ...(fulfilment === "delivery"
              ? { street, houseNumber, houseNumberSuffix, postalCode, city, country }
              : {}),
          },
          ...(fulfilment === "pickup" ? { storeId } : {}),
          ...(fulfilment === "delivery" && sameDay ? { sameDay: true } : {}),
          ...(voucher ? { voucherCode: voucher.code } : {}),
          betaalmethode,
          items: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            colorKey: item.color?.key ?? item.color?.code,
            qty: item.qty,
          })),
        }),
      });
      const data = (await response.json()) as { checkoutUrl?: string; error?: string };
      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.error ?? "Er ging iets mis bij het plaatsen van je bestelling.");
      }
      window.location.href = data.checkoutUrl;
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Er ging iets mis bij het plaatsen van je bestelling.",
      );
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-8">
        {/*
          "Ben je al klant?" bovenaan. Kevin: "ik kan niet inloggen bij
          afrekenen; zou mooi zijn dat je bovenin iets hebt."

          Inloggen zat alleen verstopt in het kortingsblok naast het overzicht,
          en dat blok verschijnt pas als er Kluspas-korting op het mandje zit.
          Zonder korting was er dus helemaal geen manier om in te loggen. Nu
          staat het bovenaan, waar elke webshop het heeft, en dichtgeklapt:
          afrekenen als gast blijft de kortste weg.
        */}
        {!ingelogdAls && (
          <div className="rounded-xl bg-brand-light px-4 py-3 ring-1 ring-brand/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-ink">
                Ben je al klant?{" "}
                <span className="font-normal text-ink-soft">
                  Log in, dan staan je gegevens en korting er meteen goed.
                </span>
              </p>
              <button
                type="button"
                onClick={() => setInlogOpen((open) => !open)}
                aria-expanded={inlogOpen}
                className="shrink-0 rounded-lg border-2 border-brand px-3 py-1.5 text-sm font-bold text-brand transition hover:bg-brand hover:text-white"
              >
                {inlogOpen ? "Sluiten" : "Inloggen"}
              </button>
            </div>
            {inlogOpen && (
              <div className="mt-1 max-w-sm">
                <InlogInline startEmail={email} onKlaar={() => setInlogOpen(false)} />
              </div>
            )}
          </div>
        )}

        <section className="card p-6">
          <h2 className="text-lg font-black text-ink">1. Bezorgen of afhalen?</h2>
          {/* Zit er iets in het mandje dat niet in een pakket past, dan is
              bezorgen geen keuze meer. Dat hier zeggen scheelt een afgekeurde
              bestelling — de server weigert hem anders alsnog. */}
          {zwareArtikelen.length > 0 && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
              <Icon name="store" className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                <strong className="font-black">
                  {zwareArtikelen.join(" en ")}{" "}
                  {zwareArtikelen.length === 1 ? "kan" : "kunnen"} niet bezorgd worden.
                </strong>{" "}
                Te zwaar of te groot voor een pakket. Haal je bestelling op in de winkel,
                of haal {zwareArtikelen.length === 1 ? "dit artikel" : "deze artikelen"} uit
                je winkelwagen.
              </span>
            </p>
          )}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <label
              className={`flex items-start gap-3 rounded-xl border-2 p-4 transition ${
                zwareArtikelen.length > 0
                  ? "cursor-not-allowed border-ink/10 opacity-50"
                  : fulfilment === "delivery"
                    ? "cursor-pointer border-brand bg-brand-light"
                    : "cursor-pointer border-ink/10 hover:border-ink/25"
              }`}
            >
              <input
                type="radio"
                name="fulfilment"
                value="delivery"
                checked={fulfilment === "delivery"}
                disabled={zwareArtikelen.length > 0}
                onChange={() => setFulfilment("delivery")}
                className="mt-1 accent-brand"
              />
              <span>
                <span className="flex items-center gap-2 font-bold text-ink">
                  <Icon name="truck" className="h-5 w-5 text-brand" /> Bezorgen
                  {/* De badge zegt wat de server rekent — een vaste "Gratis"
                      naast "Bezorging € 4,95" in het overzicht was drie
                      tegenstrijdige beweringen op één scherm. */}
                  {opties && (
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-xs font-black ${
                        opties.verzending.kosten === 0
                          ? "bg-green-100 text-green-800"
                          : "bg-ink/5 text-ink"
                      }`}
                    >
                      {opties.verzending.kosten === 0
                        ? "Gratis"
                        : euro(opties.verzending.kosten)}
                    </span>
                  )}
                </span>
                {opties?.standaard.type === "unavailable" ? (
                  <span className="mt-0.5 block text-sm font-semibold text-amber-700">
                    Tijdelijk niet leverbaar, dit mandje ligt nu nergens op
                    voorraad.
                  </span>
                ) : (
                  <>
                    <span className="mt-0.5 block text-sm font-semibold text-green-700">
                      {/* Het serverlabel kent klok én kalender ("Maandag
                          bezorgd" op zaterdag); hardcoded "morgen" beloofde op
                          zaterdag een zondagbezorging die niet bestaat. */}
                      {opties?.standaard.label ??
                        (beforeCutoff ? "Vandaag of binnen 1 werkdag" : "Binnen 1 werkdag")}
                    </span>
                    <span className="block text-xs text-ink-soft">
                      {opties?.sameDay.beschikbaar
                        ? `Ligt alles in ons webshopmagazijn, dan bezorgt DHL vandaag nog (vóór ${SAME_DAY_CUTOFF_HOUR}:00 besteld). Anders verstuurt de winkel met PostNL.`
                        : "DHL of PostNL bezorgt op de eerstvolgende bezorgdag als alles op voorraad ligt."}
                    </span>
                  </>
                )}
              </span>
            </label>
            {/* Afhalen alleen aanbieden als het ook kan. Ligt de bestelling
                nergens compleet, dan is een grijze knop met uitleg erbij een
                keuze die geen keuze is. */}
            {afhalenKan && (
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition ${
                  fulfilment === "pickup"
                    ? "border-brand bg-brand-light"
                    : "border-ink/10 hover:border-ink/25"
                }`}
              >
                <input
                  type="radio"
                  name="fulfilment"
                  value="pickup"
                  checked={fulfilment === "pickup"}
                  onChange={() => setFulfilment("pickup")}
                  className="mt-1 accent-brand"
                />
                <span>
                  <span className="flex items-center gap-2 font-bold text-ink">
                    <Icon name="store" className="h-5 w-5 text-brand" /> Afhalen in de winkel
                    <span className="rounded-md bg-green-100 px-1.5 py-0.5 text-xs font-black text-green-800">
                      Gratis
                    </span>
                  </span>
                  <span className="mt-0.5 block text-sm font-semibold text-green-700">
                    Binnen 2 uur klaar
                  </span>
                  <span className="block text-xs text-ink-soft">
                    {/* Vóór de voorraadcheck niets claimen: "in 5 winkels ligt
                        je hele bestelling" zonder één check was een belofte
                        uit de duim. */}
                    {availability === null
                      ? "We controleren nu in welke winkels alles ligt…"
                      : afhaalwinkels.length === 1
                        ? `Alles ligt klaar in ${afhaalwinkels[0].city}.`
                        : `In ${afhaalwinkels.length} winkels ligt je hele bestelling.`}
                  </span>
                </span>
              </label>
            )}
          </div>
          {!afhalenKan && availability && (
            <p className="mt-3 text-sm text-ink-soft">
              Afhalen kan deze keer niet: geen enkele winkel heeft je hele bestelling
              liggen. We bezorgen hem gratis.
            </p>
          )}
        </section>

        <section className="card p-6">
          <h2 className="text-lg font-black text-ink">2. Jouw gegevens</h2>

          {/* Particulier of zakelijk stuurt de velden én de kortingsgrond:
              een particulier krijgt korting via een account, een bedrijf via
              de Profpas — en die eist een BTW-nummer dat VIES bevestigt. */}
          <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Klanttype">
            {(
              [
                { waarde: "particulier", label: "Particulier" },
                { waarde: "zakelijk", label: "Zakelijk" },
              ] as const
            ).map((optie) => (
              <button
                key={optie.waarde}
                type="button"
                aria-pressed={klantType === optie.waarde}
                onClick={() => setKlantType(optie.waarde)}
                className={`rounded-lg border-2 px-3 py-2.5 font-bold transition ${
                  klantType === optie.waarde
                    ? "border-brand bg-brand-light text-brand"
                    : "border-ink/10 text-ink hover:border-brand"
                }`}
              >
                {optie.label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="voornaam" className="mb-1 block text-sm font-bold text-ink">
                Voornaam
              </label>
              <input
                id="voornaam"
                required
                minLength={2}
                autoComplete="given-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="input"
                placeholder="Voornaam"
              />
            </div>
            <div>
              <label htmlFor="achternaam" className="mb-1 block text-sm font-bold text-ink">
                Achternaam
              </label>
              <input
                id="achternaam"
                required
                minLength={2}
                autoComplete="family-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="input"
                placeholder="Achternaam"
              />
            </div>
            {klantType === "zakelijk" && (
              <>
                <div>
                  <label htmlFor="bedrijf" className="mb-1 block text-sm font-bold text-ink">
                    Bedrijfsnaam
                  </label>
                  <input
                    id="bedrijf"
                    required
                    autoComplete="organization"
                    value={company}
                    onChange={(event) => setCompany(event.target.value)}
                    className="input"
                    placeholder="Bedrijfsnaam"
                  />
                  <p className="mt-1 text-xs text-ink-soft">
                    Met bedrijfsnaam kun je op rekening betalen via Billie.
                  </p>
                </div>
                <div>
                  <label htmlFor="bedrijfstype" className="mb-1 block text-sm font-bold text-ink">
                    Type bedrijf
                  </label>
                  <select
                    id="bedrijfstype"
                    value={bedrijfsType}
                    onChange={(event) => setBedrijfsType(event.target.value)}
                    className="input"
                  >
                    <option value="">Maak een keuze</option>
                    {BEDRIJFSTYPEN.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="kvk" className="mb-1 block text-sm font-bold text-ink">
                    KvK-nummer
                    {country !== "NL" && (
                      <span className="font-normal text-ink-soft"> (niet verplicht)</span>
                    )}
                  </label>
                  <input
                    id="kvk"
                    inputMode="numeric"
                    required={country === "NL"}
                    value={kvkNummer}
                    onChange={(event) => setKvkNummer(event.target.value)}
                    className="input"
                    placeholder="12345678"
                  />
                </div>
                {/* BTW + VIES alleen voor buitenlandse bedrijven; een
                    Nederlands bedrijf legitimeert zich met zijn KvK-nummer. */}
                <div className={country === "NL" ? "hidden" : undefined}>
                  <label htmlFor="btw" className="mb-1 block text-sm font-bold text-ink">
                    BTW-nummer
                  </label>
                  <input
                    id="btw"
                    value={btwNummer}
                    onChange={(event) => {
                      setBtwNummer(event.target.value);
                      setViesStatus("leeg");
                    }}
                    onBlur={controleerBtwLive}
                    className="input"
                    placeholder="NL123456789B01"
                  />
                  {viesStatus === "bezig" && (
                    <p className="mt-1 text-xs text-ink-soft">Controleren bij VIES…</p>
                  )}
                  {viesStatus === "geldig" && (
                    <p className="mt-1 text-xs font-semibold text-green-700">
                      ✓ Geldig BTW-nummer{viesNaam ? `, ${viesNaam}` : ""}
                    </p>
                  )}
                  {viesStatus === "ongeldig" && (
                    <p className="mt-1 text-xs font-semibold text-brand-dark">
                      Dit nummer wordt niet herkend in het EU-register (VIES).
                    </p>
                  )}
                  {viesStatus === "onbeslist" && (
                    <p className="mt-1 text-xs text-ink-soft">
                      VIES is even niet bereikbaar; we controleren opnieuw bij het
                      afrekenen.
                    </p>
                  )}
                </div>
                <label className="flex cursor-pointer items-start gap-2.5 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={profpas}
                    onChange={(event) => setProfpas(event.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[#F5821F]"
                  />
                  <span className="text-sm">
                    <span className="font-bold text-ink">
                      Ik wil een Profpas, korting direct verrekend
                    </span>
                    <span className="block text-ink-soft">
                      {country === "NL"
                        ? "Geldt zodra je KvK-nummer is ingevuld. Zo blijft de korting bij échte bedrijven."
                        : "Geldt zodra je BTW-nummer door het EU-register (VIES) is bevestigd. Zo blijft de korting bij échte bedrijven."}
                    </span>
                  </span>
                </label>
              </>
            )}
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-bold text-ink">
                E-mailadres
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="input"
                placeholder="naam@voorbeeld.nl"
              />
            </div>
            <div>
              <label htmlFor="telefoon" className="mb-1 block text-sm font-bold text-ink">
                Telefoonnummer
              </label>
              <input
                id="telefoon"
                type="tel"
                required
                minLength={8}
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="input"
                placeholder="06 12345678"
              />
            </div>
            {fulfilment === "delivery" && (
              <>
                <div className="sm:col-span-2">
                  <label htmlFor="straat" className="mb-1 block text-sm font-bold text-ink">
                    Straatnaam
                  </label>
                  <input
                    id="straat"
                    required
                    minLength={2}
                    autoComplete="address-line1"
                    value={street}
                    onChange={(event) => setStreet(event.target.value)}
                    className="input"
                    placeholder="Voorbeeldstraat"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="huisnummer" className="mb-1 block text-sm font-bold text-ink">
                      Huisnummer
                    </label>
                    <input
                      id="huisnummer"
                      required
                      pattern=".*\d.*"
                      maxLength={8}
                      value={houseNumber}
                      onChange={(event) => setHouseNumber(event.target.value)}
                      className="input"
                      placeholder="12"
                    />
                  </div>
                  <div>
                    <label htmlFor="toevoeging" className="mb-1 block text-sm font-bold text-ink">
                      Toevoeging{" "}
                      <span className="font-normal text-ink-soft">(optioneel)</span>
                    </label>
                    <input
                      id="toevoeging"
                      maxLength={8}
                      value={houseNumberSuffix}
                      onChange={(event) => setHouseNumberSuffix(event.target.value)}
                      className="input"
                      placeholder="A"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="postcode" className="mb-1 block text-sm font-bold text-ink">
                    Postcode
                  </label>
                  <input
                    id="postcode"
                    required
                    pattern={country === "BE" ? "\\d{4}" : "\\d{4}\\s?[A-Za-z]{2}"}
                    autoComplete="postal-code"
                    value={postalCode}
                    onChange={(event) => setPostalCode(event.target.value)}
                    className="input"
                    placeholder={country === "BE" ? "2000" : "1234 AB"}
                  />
                </div>
                <div>
                  <label htmlFor="plaats" className="mb-1 block text-sm font-bold text-ink">
                    Plaats
                  </label>
                  <input
                    id="plaats"
                    required
                    minLength={2}
                    autoComplete="address-level2"
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    className="input"
                    placeholder="Plaats"
                  />
                </div>
                <div>
                  <label htmlFor="land" className="mb-1 block text-sm font-bold text-ink">
                    Land
                  </label>
                  <select
                    id="land"
                    value={country}
                    onChange={(event) => setCountry(event.target.value as "NL" | "BE")}
                    autoComplete="country"
                    className="input"
                  >
                    <option value="NL">Nederland</option>
                    <option value="BE">België</option>
                  </select>
                </div>
              </>
            )}
          </div>
          <p className="mt-3 text-xs text-ink-soft">
            We gebruiken je gegevens alleen voor deze bestelling.
          </p>
        </section>

        {fulfilment === "pickup" && (
          <section className="card p-6">
            <h2 className="text-lg font-black text-ink">3. Kies je afhaalwinkel</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Afhalen is gratis en je bestelling staat binnen 2 uur klaar, mits
              alles in die winkel op voorraad ligt. Dat controleren we hieronder
              live voor je.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {afhaalwinkels.map((store) => {
                const status = availability?.find((entry) => entry.storeId === store.slug);
                const compleet = status?.complete;
                return (
                  <label
                    key={store.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition ${
                      storeId === store.id
                        ? "border-brand bg-brand-light"
                        : "border-ink/10 hover:border-ink/25"
                    }`}
                  >
                    <input
                      type="radio"
                      name="store"
                      value={store.id}
                      checked={storeId === store.id}
                      onChange={() => setStoreId(store.id)}
                      className="mt-1 accent-brand"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-bold text-ink">
                        {store.city}
                        {favourite?.slug === store.slug && (
                          <span className="rounded bg-brand/10 px-1.5 py-0.5 text-xs font-bold text-brand">
                            jouw winkel
                          </span>
                        )}
                      </span>
                      <span className="block text-sm text-ink-soft">{store.address}</span>
                      {compleet && (
                        <span className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-green-700">
                          <Icon name="check" className="h-4 w-4 shrink-0" strokeWidth={3} />
                          {store.pickupLabel}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
            {checkingStock && (
              <p className="mt-3 text-sm text-ink-soft">Voorraad per winkel controleren…</p>
            )}
          </section>
        )}

        <section className="card p-6">
          <h2 className="text-lg font-black text-ink">
            {fulfilment === "pickup" ? "4." : "3."} Betalen
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Kies hier hoe je betaalt, dan gaan we meteen door naar dat scherm.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {methoden.map((methode) => (
              <label
                key={methode.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition ${
                  betaalmethode === methode.id
                    ? "border-brand bg-brand-light"
                    : "border-ink/10 hover:border-ink/25"
                }`}
              >
                <input
                  type="radio"
                  name="betaalmethode"
                  value={methode.id}
                  checked={betaalmethode === methode.id}
                  onChange={() => setBetaalmethode(methode.id)}
                  className="accent-brand"
                />
                {/* Mollie's eigen logo's, lokaal opgeslagen: geen verzoek naar
                    buiten op het moment dat de klant gaat betalen. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={methode.logo}
                  alt=""
                  width={32}
                  height={24}
                  className="h-6 w-8 shrink-0"
                />
                <span className="min-w-0">
                  <span className="block font-bold leading-tight text-ink">
                    {methode.label}
                  </span>
                  <span className="block text-xs leading-tight text-ink-soft">
                    {methode.uitleg}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-ink-soft">
            <Icon name="lock" className="h-4 w-4 shrink-0 text-green-700" />
            Beveiligd afgehandeld door Mollie. Wij zien je bank- of kaartgegevens niet.
          </p>
        </section>
      </div>

      <div className="h-fit space-y-4">
      <aside className="card p-6">
        <h2 className="text-lg font-black text-ink">Jouw bestelling</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {items.map((item) => (
            <li key={item.key} className="flex justify-between gap-3">
              <span className="text-ink">
                {item.qty} × {item.name}
                {item.variantName && ` (${item.variantName})`}
                {item.color && (
                  <span className="block text-xs text-ink-soft">
                    Kleur: {[item.color.code, item.color.name].filter(Boolean).join(" ")}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-semibold">
                {toon(item.unitPrice * item.qty)}
              </span>
            </li>
          ))}
        </ul>
        {/*
          Korting hoort bij het account, niet bij een ingetypt pasnummer.
          Dat veld was ook nergens tegen bestand: elk plausibel nummer gaf
          korting, want het echte ledenbestand kent alleen de kassa. Nu bepaalt
          de server het aan de sessie, en hoeft de klant hier niets in te
          vullen.
        */}
        {kluspasKorting > 0 && (
          <div className="mt-4 rounded-lg bg-brand-light p-3">
            {ingelogdAls ? (
              <p className="flex items-start gap-2 text-sm font-bold text-ink">
                <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-green-700" strokeWidth={3} />
                <span>
                  Je {kortingPas === "profpas" ? "ProfPas" : "Kluspas"}-korting van{" "}
                  {euro(kluspasKorting)} is verrekend.
                  <span className="block font-normal text-ink-soft">
                    Als {ingelogdAls}.
                  </span>
                </span>
              </p>
            ) : klantType === "zakelijk" ? (
              <p className="flex items-start gap-2 text-sm text-ink-soft">
                <Icon name="tag" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                {kortingActief
                  ? `Profpas-korting van ${euro(kluspasKorting)} is verrekend.`
                  : `Met een Profpas betaal je ${euro(kluspasKorting)} minder, vink hierboven aan en vul je BTW-nummer in.`}
              </p>
            ) : (
              <>
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={accountAanmaken}
                    onChange={(event) => setAccountAanmaken(event.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[#F5821F]"
                  />
                  <span className="text-sm">
                    <span className="font-bold text-ink">
                      Maak gratis een account aan, {euro(kluspasKorting)} korting,
                      direct verrekend
                    </span>
                    <span className="block text-ink-soft">
                      Op je e-mailadres, zonder wachtwoord. Je ziet er je
                      bestellingen, facturen en gemengde kleuren terug.
                    </span>
                  </span>
                </label>
                {!accountAanmaken && (
                  /* Inline, niet via een link naar de accountpagina.
                     Wegklikken van het afrekenen op het moment dat de klant er
                     bijna is, kost bestellingen. */
                  <InlogInline startEmail={email} />
                )}
              </>
            )}
          </div>
        )}

        {/* Staal-voucher: het tegoed uit een testerbestelling. De code komt
            per mail; de server beoordeelt hem hier én bij het afrekenen. */}
        <div className="mt-4 border-t border-ink/10 pt-4">
          {voucher ? (
            <p className="flex items-start gap-2 rounded-lg bg-green-50 px-3 py-2.5 text-sm font-semibold text-green-800 ring-1 ring-green-200">
              <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={3} />
              <span>
                Voucher {voucher.code} toegepast: − {euro(voucherKorting)}
                <button
                  type="button"
                  onClick={() => {
                    setVoucher(null);
                    setVoucherInvoer("");
                  }}
                  className="ml-2 font-bold underline"
                >
                  Verwijderen
                </button>
              </span>
            </p>
          ) : (
            <>
              <label htmlFor="voucher" className="mb-1 block text-sm font-bold text-ink">
                Kleurtester gekocht?{" "}
                <span className="font-normal text-ink-soft">Vul je vouchercode in</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="voucher"
                  value={voucherInvoer}
                  onChange={(event) => {
                    setVoucherInvoer(event.target.value.toUpperCase());
                    setVoucherMelding(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      pasVoucherToe();
                    }
                  }}
                  className="input flex-1"
                  placeholder="STAAL-AB12CD"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={pasVoucherToe}
                  disabled={voucherBezig || !voucherInvoer.trim()}
                  className="shrink-0 rounded-lg border-2 border-ink/10 px-3 py-2 text-sm font-bold text-ink transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {voucherBezig ? "…" : "Toepassen"}
                </button>
              </div>
              {voucherMelding && (
                <p className="mt-1.5 text-xs font-semibold text-brand-dark">{voucherMelding}</p>
              )}
            </>
          )}
        </div>

        {/* Bezorgsnelheid: morgen is gratis, vandaag kost een toeslag en kan
            alleen vóór de cutoff met voorraad in ons magazijn. Wat hier staat
            komt van de server, zodat de klant nooit iets kiest wat niet kan. */}
        {fulfilment === "delivery" && opties?.sameDay.beschikbaar && (
          <fieldset className="mt-4 border-t border-ink/10 pt-4">
            <legend className="mb-2 text-sm font-black text-ink">Wanneer wil je het hebben?</legend>
            <div className="space-y-2">
              <label
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border-2 p-3 text-sm transition ${
                  !sameDay ? "border-brand bg-brand-light" : "border-ink/10 hover:border-ink/30"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="bezorgsnelheid"
                    checked={!sameDay}
                    onChange={() => setSameDay(false)}
                    className="accent-brand"
                  />
                  <span className="font-bold text-ink">Morgen bezorgd</span>
                </span>
                <span className="font-bold text-green-700">Gratis</span>
              </label>
              <label
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border-2 p-3 text-sm transition ${
                  sameDay ? "border-brand bg-brand-light" : "border-ink/10 hover:border-ink/30"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="bezorgsnelheid"
                    checked={sameDay}
                    onChange={() => setSameDay(true)}
                    className="accent-brand"
                  />
                  <span className="font-bold text-ink">Vandaag bezorgd</span>
                </span>
                <span className="font-bold text-ink">
                  + {euro(opties.sameDay.toeslag ?? 0)}
                </span>
              </label>
            </div>
            <p className="mt-2 text-xs text-ink-soft">
              Vandaag bezorgen kan bij bestellingen vóór {opties.sameDay.cutoffUur}:00, zolang
              alles in ons webshopmagazijn ligt.
            </p>
          </fieldset>
        )}

        <dl className="mt-4 space-y-2 border-t border-ink/10 pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-soft">
              Subtotaal{modus === "excl" && " (excl. btw)"}
            </dt>
            <dd className="font-semibold text-ink">{toon(subtotal)}</dd>
          </div>
          {kortingActief && kluspasKorting > 0 && (
            <div className="flex justify-between">
              <dt className="font-semibold text-green-700">
                Jouw korting
              </dt>
              <dd className="font-bold text-green-700">− {toon(kluspasKorting)}</dd>
            </div>
          )}
          {voucherKorting > 0 && (
            <div className="flex justify-between">
              <dt className="font-semibold text-green-700">Staal-voucher</dt>
              <dd className="font-bold text-green-700">− {toon(voucherKorting)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-ink-soft">
              {fulfilment === "delivery" ? "Bezorging" : "Afhalen in de winkel"}
            </dt>
            <dd className={verzendkosten === 0 ? "font-bold text-green-700" : "font-semibold text-ink"}>
              {verzendkosten === 0 ? "Gratis" : toon(verzendkosten)}
            </dd>
          </div>
          {fulfilment === "delivery" && sameDay && opties?.sameDay.beschikbaar && (
            <div className="flex justify-between">
              <dt className="text-ink-soft">Vandaag bezorgd</dt>
              <dd className="font-semibold text-ink">{toon(opties.sameDay.toeslag ?? 0)}</dd>
            </div>
          )}
          {modus === "excl" && (
            <div className="flex justify-between">
              <dt className="text-ink-soft">Btw ({Math.round(BTW_TARIEF * 100)}%)</dt>
              <dd className="font-semibold text-ink">{euro(btwRegel)}</dd>
            </div>
          )}
          {fulfilment === "delivery" && opties?.verzending.franco && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-800">
              Sikkens bezorgen we altijd gratis, ongeacht het bedrag.
            </p>
          )}
          {fulfilment === "delivery" && tekortVoorGratis > 0 && (
            <p className="rounded-lg bg-brand-light px-3 py-2 text-xs font-semibold text-brand-dark">
              Nog {euro(tekortVoorGratis)} en je bezorging is gratis.
            </p>
          )}
          <div className="flex justify-between text-base">
            <dt className="font-black text-ink">Totaal (incl. btw)</dt>
            <dd className="font-black text-brand">{euro(totaal)}</dd>
          </div>
        </dl>
        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-brand-light px-4 py-3 text-sm font-semibold text-brand-dark">
            {error}
          </p>
        )}
        {/* Bedrag én methode in de knop: dan weet de klant precies wat er
            gebeurt als hij erop drukt, en dat scheelt twijfel op de laatste
            stap. "Bestellen en betalen" liet allebei open. */}
        <button
          type="submit"
          disabled={
            submitting ||
            (fulfilment === "delivery" && opties?.standaard.type === "unavailable")
          }
          className="btn btn-primary mt-5 w-full disabled:opacity-60"
        >
          {submitting
            ? "Je wordt doorgestuurd…"
            : `${euro(totaal)} betalen met ${gekozenMethode?.label ?? "iDEAL"} →`}
        </button>
        <p className="mt-3 text-center text-xs text-ink-soft">
          {fulfilment === "pickup"
            ? "Afhalen is gratis. Je krijgt bericht zodra je bestelling klaarligt."
            : verzendkosten === 0 && toeslag === 0
              ? "Bezorgen is gratis. Bevalt het niet? 14 dagen bedenktijd."
              : "Inclusief bezorging. Bevalt het niet? 14 dagen bedenktijd."}
        </p>
        <div className="mt-4 border-t border-ink/10 pt-4">
          <TrustpilotWidget variant="micro" />
        </div>
      </aside>

      {/* De kolom onder de bestelkaart was leeg; hier staat Mark op formaat,
          met de hulplijnen voor wie op het laatste moment twijfelt. Bellen of
          appen op dit punt redt bestellingen die anders stilletjes afhaken. */}
      <section className="card hidden overflow-hidden lg:block">
        <Mark pose="mengen" hoogte="h-56" className="rounded-none" />
        <div className="space-y-3 p-5">
          <h2 className="font-black text-ink">Hulp nodig bij je bestelling?</h2>
          <p className="text-sm text-ink-soft">
            Onze verfspecialisten helpen je zo, ook met kleuradvies.
          </p>
          <div className="space-y-2 text-sm font-semibold">
            <a
              href={`tel:${CONTACT_PHONE.replace(/[^\d+]/g, "")}`}
              className="flex items-center gap-2 text-ink transition hover:text-brand"
            >
              <Icon name="phone" className="h-4 w-4 shrink-0 text-brand" /> {CONTACT_PHONE}
            </a>
            {(whatsappNummer ?? WHATSAPP_NUMMER) && (
              <a
                href={`https://wa.me/${whatsappNummer ?? WHATSAPP_NUMMER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-ink transition hover:text-brand"
              >
                <Icon name="chat" className="h-4 w-4 shrink-0 text-brand" /> App met de
                winkel <span className="text-xs text-ink-soft">({WHATSAPP_TIJDEN})</span>
              </a>
            )}
          </div>
          <ul className="space-y-1 border-t border-ink/10 pt-3 text-sm text-ink-soft">
            <li className="flex items-center gap-2">
              <Icon name="check" className="h-4 w-4 shrink-0 text-green-700" strokeWidth={3} />
              Verf gratis gemengd in elke kleur
            </li>
            <li className="flex items-center gap-2">
              <Icon name="check" className="h-4 w-4 shrink-0 text-green-700" strokeWidth={3} />
              14 dagen bedenktijd, retour in elke winkel
            </li>
            <li className="flex items-center gap-2">
              <Icon name="check" className="h-4 w-4 shrink-0 text-green-700" strokeWidth={3} />
              5 winkels in Oost-Nederland
            </li>
          </ul>
        </div>
      </section>
      </div>
    </form>
  );
}
