import { bezorgbaarheid, type TeBezorgenArtikel } from "@/lib/bezorgbaarheid";
import { toonbareRubriek } from "@/lib/rubrieken";
import { isKvEnabled, kvGetRaw, kvSetEx } from "@/lib/kv";
import { isGeloofwaardigeKluspasPrijs } from "@/lib/kluspas";
import { parseBase } from "@/lib/paint-bases";
import { DASHBOARD_API_URL } from "@/lib/site";
import type { Category, Product, ProductVariant } from "@/lib/types";
import { isEchtMerk } from "@/lib/merken";
import { soortKenmerken } from "@/lib/soorten";
import { houtsoortUit, pakInhoudM2, tintUit } from "@/lib/vloer";

/**
 * Echte productcatalogus van De Voordeelmarkt, via de productfeed van het
 * VDM-dashboard. Bij voorkeur de gepagineerde JSON-feed
 * (GET /api/catalogus/json); is die niet bereikbaar, dan de XML-feed
 * (GET /api/catalogus/feed) als terugval. De prijzen komen daar sinds
 * juli 2026 rechtstreeks uit de Tilroy Price API, dus ze zijn actueel in
 * plaats van zo vers als de laatste feedgeneratie.
 *
 * De feed levert ~5.000 varianten met per item onder meer:
 *   id, group_id, group_leader, title, description, link, image_link, brand,
 *   categories ("Verf > Muurverf"), price (advies), sale_price (onze prijs),
 *   availability, voorraad, maat, inhoud_liter, mengverf (Ja/Nee), glans,
 *   verfsoort, toepassing, ondergrond, zoektermen.
 *
 * Varianten met hetzelfde `group_id` horen bij één product (bv. 1L/2,5L/5L).
 * De feed is de bron; voorraad per winkel komt uit de voorraad-hub.
 *
 * De feed is ~6,5 MB en duurt ~13 s. Daarom: in-memory cache + Next-cache,
 * en pagina's die 'm gebruiken draaien op ISR (revalidate 1 uur).
 */

const FEED_URL = `${DASHBOARD_API_URL}/api/catalogus/feed`;
/**
 * De gepagineerde JSON-feed. Let op het ontbreken van een punt in het pad:
 * bij `feed.json` ziet Vercel het als een statisch bestand en wordt de route
 * nooit uitgevoerd — dat gaf maandenlang een 404 op code die wél gedeployd
 * was. Niet "verbeteren" naar een bestandsnaam met extensie.
 *
 * Heette tot 4 augustus 2026 /api/doofinder/json. We werken niet meer met
 * Doofinder, maar dit was en is gewoon onze productcatalogus — alleen de naam
 * verwees nog naar de zoekleverancier van de oude site. De oude paden werken
 * nog even door als alias; die verdwijnen zodra deze omzetting is bevestigd.
 */
const FEED_JSON_URL = `${DASHBOARD_API_URL}/api/catalogus/json`;
const CACHE_MS = 60 * 60 * 1000;
/** Aantal artikelen per pagina uit de JSON-feed. */
const PAGE_SIZE = 500;

/* ── Categorie-indeling ────────────────────────────────────────── */

/*
 * De indeling komt van Tilroy zelf: de subcategorie uit `categories`
 * ("Verf > Muurverf" → Muurverf) is de categorie in de webshop.
 *
 * Hier stond eerst een eigen indeling die 72 Tilroy-subcategorieën in tien
 * zelfbedachte bakken vouwde. Dat ging twee keer mis op een manier die
 * niemand zag: "bevestigingsmateriaal" matchte niet op
 * "Bevestigingsmaterialen" (1.519 artikelen in de verkeerde bak), en de
 * mengpasta's van de mengmachine belandden onder Verf omdat ze nu eenmaal in
 * de categorie "Verfmengmachine" staan. Elke regel die je zelf verzint is een
 * regel die kan afwijken van de winkel.
 *
 * Nu volgen we de bron. Dat betekent 58 categorieën in plaats van 10, en dat
 * schoonmaakazijn onder Verdunningsmiddelen staat en niet onder Verf — precies
 * waar de winkel hem ook heeft staan.
 */

/**
 * Weergavenamen. Tilroy schrijft kassabon-afkortingen; die zijn prima voor
 * achter de toonbank maar niet voor een klant.
 */
const CATEGORIE_NAAM: Record<string, string> = {
  // Hoofdgroepen (slug = g + Tilroy-groepscode, sinds de sync van 2026-07-30).
  // Alleen waar de kassanaam niet toonbaar is: "Ijzerwaren" mist de Nederlandse
  // IJ, 6000 heet in de meest voorkomende schrijfwijze "LIJMEN EN KITTEN", en
  // 22000 is in Tilroy afgekapt op "Hobby en vrijetijdsartike".
  g9000: "IJzerwaren",
  g6000: "Lijmen en kitten",
  g22000: "Hobby & vrije tijd",
  g17000: "Deuren & kozijnen",
  "schildersger-en-schuurpapier": "Schildersgereedschap & schuurpapier",
  "acc-elektrisch-gereedschap": "Accessoires elektrisch gereedschap",
  "ijzerwaren-hang-en-sluitwerk": "IJzerwaren, hang- en sluitwerk",
  "overig-electra": "Overige elektra",
  "auto-accessoires": "Auto-accessoires",
  "lijmen-kitten-en-vulmiddelen": "Lijm, kit & vulmiddelen",
  "beits-olie-en-vernis": "Beits, olie & vernis",
  "verlengkabels-en-tafelcontactdozen": "Verlengkabels & contactdozen",
  "lichtbronnen-en-zaklampen": "Lichtbronnen & zaklampen",
  "bouwemmers-en-speciekuipen": "Bouwemmers & speciekuipen",
  "rambo-inter-olie-vloer-wax": "Rambo olie, vloer & wax",
  "interbosch-aanhangw-en-auto": "Aanhanger & auto",
  "hand-tuingereedschap": "Tuingereedschap",
  "fiets-onderhoud-en-accessoires": "Fiets & accessoires",
  "cb-meester-deur-gevel-kozijn": "Deur, gevel & kozijn",
  "karpetten-en-matten": "Karpetten & matten",
  "buiten-en-tuinverlichting": "Buiten- & tuinverlichting",
  "licht-en-lampjes": "Licht & lampjes",
  huishoudelijk: "Huishouden",
  schoonmaak: "Schoonmaak en onderhoud",
  stickers: "Raamfolie & stickers",
  facilitair: "Winkelbenodigdheden",
};

/**
 * Weergavenaam voor een rubriek-slug, met de kassanaam als terugval.
 * Voor iedereen die rubrieklabels toont zonder langs categorieenUit te gaan
 * (merkpagina's): zo heet g9000 óók daar "IJzerwaren" en niet "Ijzerwaren".
 */
export function categorieWeergaveNaam(slug: string, kassanaam: string): string {
  return CATEGORIE_NAAM[slug] ?? kassanaam;
}

/**
 * Een pictogram en een tint per categorie. Sleutelwoord in de slug bepaalt de
 * keuze, zodat een nieuwe categorie uit Tilroy vanzelf iets passends krijgt in
 * plaats van een leeg vakje.
 */
const CATEGORIE_BEELD: { match: RegExp; icon: string; hue: number }[] = [
  { match: /schoonmaak/, icon: "spray", hue: 190 },
  { match: /verfbenodigd/, icon: "brush", hue: 45 },
  { match: /muurverf|alkydverf|partij-verf|speciaalverven|\bverf\b/, icon: "roller", hue: 25 },
  { match: /lakken/, icon: "can", hue: 30 },
  { match: /beits|vernis|wax|olie/, icon: "brush", hue: 35 },
  { match: /verdunning/, icon: "spray", hue: 200 },
  { match: /schilderdersger|schildersger|schuurpapier|anza|voorbewerken/, icon: "brush", hue: 45 },
  { match: /behang|glasweefsel/, icon: "tape", hue: 260 },
  { match: /lijm|kit|vulmiddel|plamuur/, icon: "can", hue: 200 },
  { match: /bevestiging|ijzerwaren|sluitwerk/, icon: "screw", hue: 220 },
  { match: /gereedschap|kruiwagen|werkbank/, icon: "wrench", hue: 215 },
  { match: /licht|lamp|verlichting|electra|elektra|kabel|contactdoos|batterij/, icon: "bulb", hue: 265 },
  { match: /huishoud|reinig|schoonmaak|stickers|horren/, icon: "spray", hue: 190 },
  { match: /auto|aanhang|fiets|camping|tuin/, icon: "leaf", hue: 130 },
  { match: /laminaat|plint|ondervloer|vloeren|karpet|matten/, icon: "level", hue: 30 },
  { match: /hobby|vrijetijd|vrije-tijd/, icon: "tape", hue: 300 },
  { match: /deuren|kozijn/, icon: "level", hue: 220 },
  { match: /werkkleding/, icon: "hanger", hue: 210 },
  { match: /brandbeveiliging/, icon: "bulb", hue: 0 },
  { match: /emmer|speciekuip|bouwmaterial/, icon: "bucket", hue: 40 },
];

function beeldVoor(slug: string, naam = ""): { icon: string; hue: number } {
  // Op slug én naam: zodra de feed groepscodes meestuurt wordt de slug
  // "g1000" en zegt alleen de naam ("Verf en Beits") nog waar dit over gaat.
  const bron = `${slug} ${slugify(naam)}`;
  const treffer = CATEGORIE_BEELD.find((entry) => entry.match.test(bron));
  return treffer ? { icon: treffer.icon, hue: treffer.hue } : { icon: "box", hue: 210 };
}

/**
 * Hoofdgroepen die geen assortiment zijn.
 *
 * Tilroy gebruikt de categorieboom ook voor administratie. "Kasmutaties"
 * bevat kasopnames ("Kas Uit: Koopavond Eten"), en er is een groep die
 * letterlijk `default` heet. Die horen niet in een webshop.
 */
const HOOFDGROEPEN_NIET_ONLINE = new Set([
  "kasmutaties",
  "verzendkosten",
  "postnl",
  "facilitair / overig",
  "default",
]);

/**
 * De categorie van een artikel: de hoofdgroep van Tilroy.
 *
 * ⚠️ Groeperen op códe, labelen op naam. Dezelfde groep staat in Tilroy in
 * meerdere schrijfwijzen — "Verf en Beits" (1.701×), "Verf en beits" (189×)
 * en "VERF EN BEITS" (1×) zijn alle drie code 1000. Op naam matchen levert
 * drie categorieën op waar er één hoort te zijn.
 *
 * Zolang de feed de codes nog niet meestuurt vallen we terug op de naam; dan
 * werkt de site door zoals hij deed.
 */
/**
 * Subgroepen die in de kassa onder de verkeerde hoofdgroep hangen.
 *
 * "Huishoudelijk" telt 258 artikelen en is voor 241 stuks HG-schoonmaak:
 * parketreinigers, tegelbeschermers, sanitairreinigers. Dat stond als
 * grootste "soort" ónder Verfbenodigdheden — wie verf kwam halen zag eerst
 * schoonmaakmiddelen, en wie een parketreiniger zocht keek nooit bij
 * verfbenodigdheden. Het is een eigen bestemming, groter dan Auto en fiets.
 * De kassa kent geen aparte groep, dus die maken we hier, met een eigen
 * (codeloze) slug.
 */
const EIGEN_RUBRIEKEN: { sub?: RegExp; titel?: RegExp; slug: string; naam: string }[] = [
  { sub: /^huishoudelijk$/i, slug: "schoonmaak", naam: "Schoonmaak en onderhoud" },
  // De kassa las "Kruipolie" en dacht: olie. Acht WD-40-sprays stonden zo
  // bovenaan in het beitsfilter — smeermiddel tussen de tuinbeits.
  {
    titel: /(wd-?40|kruipolie|slotspray|contactspray|siliconenspray|droogsmeerspray|multi-?use|smeerspray|teflonspray)/i,
    slug: "schoonmaak",
    naam: "Schoonmaak en onderhoud",
  },
  // Handgel en handzeep stonden in de kassa onder Verf en Beits > Lakken, en
  // kwamen zo tussen de lak te staan met "voor hout" eronder. Hygiëne hoort
  // bij schoonmaak, waar de derde Sanicur al stond.
  {
    titel: /(handgel|hand gel|handzeep|handclean|handreiniger|handdesinfect)/i,
    slug: "schoonmaak",
    naam: "Schoonmaak en onderhoud",
  },
];

function eigenRubriekVoor(item: FeedItem): { slug: string; naam: string } | undefined {
  const sub = (item.categorie_sub ?? "").trim();
  const titel = (item.title ?? "").trim();
  return EIGEN_RUBRIEKEN.find(
    (rubriek) =>
      (rubriek.sub && sub && rubriek.sub.test(sub)) ||
      (rubriek.titel && titel && rubriek.titel.test(titel)),
  );
}

function categorySlugFor(item: FeedItem): string {
  const eigen = eigenRubriekVoor(item);
  if (eigen) return eigen.slug;
  // De codes zijn in de steekproef ronde getallen (1000, 3000, 6000), maar er
  // zijn er meer gezien dan er paden zijn. Geen aanname over de vorm dus:
  // slugify vangt op wat er ook in staat.
  const code = slugify((item.categorie_hoofd_code ?? "").trim());
  if (code) return `g${code}`;
  const hoofd = (item.categorie_hoofd ?? "").trim();
  if (hoofd) return slugify(hoofd);
  const sub = subcategoryOf(item.categories);
  return sub ? slugify(sub) : "overig";
}

/** Hoort dit artikel in een winkelbare hoofdgroep? */
function hoofdgroepOnline(item: FeedItem): boolean {
  const hoofd = (item.categorie_hoofd ?? "").trim().toLowerCase();
  if (!hoofd) return true;
  return !HOOFDGROEPEN_NIET_ONLINE.has(hoofd);
}

/**
 * De categorieën die er zijn, afgeleid uit de producten zelf.
 *
 * Bewust geen vaste lijst meer: verandert de indeling in Tilroy, dan
 * verandert de webshop mee zonder dat iemand hier iets bijwerkt. De
 * weergavenaam komt uit het product (`attributes.subcategorie`), zodat die de
 * schrijfwijze van de bron volgt en ook klopt als de catalogus uit de cache
 * komt.
 */
export function categorieenUit(products: Product[]): Category[] {
  // Per categorie tellen hoe vaak elke schrijfwijze voorkomt. Tilroy kent
  // dezelfde groep onder "Verf en Beits", "Verf en beits" én "VERF EN BEITS";
  // op de code is dat één categorie, maar het label moet ergens vandaan komen
  // en dan is de meest gebruikte schrijfwijze de veiligste keuze.
  const perSlug = new Map<string, { namen: Map<string, number>; aantal: number }>();
  for (const product of products) {
    // Hoofdgroep als die er is; anders de subcategorie, zodat de site blijft
    // werken op een feed van vóór de tweeniveau-wijziging.
    const naam =
      product.attributes?.hoofdgroep?.trim() || product.attributes?.subcategorie?.trim();
    if (!naam) continue;
    const bestaand = perSlug.get(product.category);
    if (bestaand) {
      bestaand.aantal++;
      bestaand.namen.set(naam, (bestaand.namen.get(naam) ?? 0) + 1);
    } else {
      perSlug.set(product.category, { namen: new Map([[naam, 1]]), aantal: 1 });
    }
  }

  return [...perSlug.entries()]
    .map(([slug, { namen, aantal }]) => {
      // Meest voorkomende schrijfwijze; bij gelijkstand alfabetisch, niet op
      // volgorde van binnenkomst. De feed hoeft niet elke crawl in dezelfde
      // volgorde te staan, en dan zou het categorielabel per nacht kunnen
      // wisselen tussen "Verf en Beits" en "Verf en beits".
      const naam = [...namen.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "nl"),
      )[0][0];
      const weergave = CATEGORIE_NAAM[slug] ?? naam;
      return {
        slug,
        name: weergave,
        description: `${weergave} bij De Voordeelmarkt: ${aantal} ${
          aantal === 1 ? "artikel" : "artikelen"
        } voor de laagste prijs. Online bestellen, gratis afhalen in de winkel.`,
        count: aantal,
        ...beeldVoor(slug, weergave),
      } satisfies Category;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "nl"));
}

/**
 * Wat in de winkel wél in het kassasysteem staat maar niet in de webshop hoort.
 *
 * De feed is de artikelenlijst van Tilroy, en daar staat meer in dan wat een
 * klant kan kopen: de mengpasta's waarmee de machine verf aankleurt, de
 * postzegels van het PostNL-punt, een testartikel van de administratie. Die
 * horen niet in een categorie, niet in het zoekresultaat en niet op een eigen
 * pagina — ze hoorden er überhaupt niet te zijn.
 *
 * Ik had de mengpasta's eerst netjes onder "Verf" gehangen omdat ze in de
 * categorie "Verfmengmachine" staan. Dat is precies de verkeerde vraag: niet
 * "waar past dit?" maar "koopt een klant dit?".
 */
const MERKEN_NIET_ONLINE = new Set([
  // De kleurpasta's van de mengmachine; die verkopen we niet los.
  "mengpasta",
  // Alles wat Tilroy op onze eigen naam zet is baliewerk: postzegels,
  // postpakketten, enveloppen. Geen van deze artikelen heeft een prijs in de
  // feed, wat het beeld bevestigt.
  "de voordeelmarkt",
  "administratie",
]);

const SUBCATEGORIEEN_NIET_ONLINE = new Set([
  "verfmengmachine",
  "mengpasta verkoop",
  "intern gebruik",
  "business point",
  "postnl",
]);

/**
 * Mengpasta die níet onder merk "Mengpasta" of in de mengmachine-categorie
 * staat. Zeven Sikkens Acomix-colorpastes staan gewoon onder "Lakken" met
 * merk Sikkens, en Drenth-kleurpasta's onder Verfmengmachine. Op merk of
 * categorie alleen glippen die erdoor.
 */
const PASTA_IN_DE_NAAM = /\b(mengpasta|kleurpasta|colorpaste|colorant)\b/i;

/**
 * Kassaregels die als artikel in de catalogus staan: statiegeld ("Borg E 20,-"
 * in Fitex Diversen) en de foutief-gemengde-verf-bonnen ("Onze fout, uw
 * voordeel EUR 50,00"). Die laatste zitten al in de Verfmengmachine-rubriek
 * die offline staat, maar op naam vangen we ook de exemplaren die ooit ergens
 * anders worden geboekt — een borgbon met een koopknop is geen gezicht.
 */
const KASSAREGEL_IN_DE_NAAM = /^borg\b|foutief gemengd/i;

/**
 * "Partijhandel" is een inkoopkanaal, geen merk en geen productkenmerk.
 * Alle 65 titels beginnen ermee ("Partijhandel Strooizout 25 KG") en dat is
 * precies het woord waar niemand op zoekt — weg ermee, de productnaam begint
 * dan gewoon met het product. Slugs verschuiven mee; oude links vangt de
 * productpagina op via het groepsnummer.
 */
function zonderPartijhandel(titel: string): string {
  return titel.replace(/^\s*partijhandel\s+/i, "").trim() || titel;
}

/**
 * De witte Sikkens-artikelen: echte producten, gekoppeld aan hun mengbare broer.
 *
 * Voor elke Sikkens-lak staat er in Tilroy een apart artikel "… Wit". Dat is
 * — correctie van Kevin, 2026-07-31 — géén kassaregel maar fabriekswit met
 * eigen voorraad en eigen prijs, en die prijs is geregeld fors lager dan
 * dezelfde verf gemengd (Alphatex SF 5 L: € 85,95 wit tegen € 144,62 basis).
 *
 * Een eigen productpagina ernaast willen we nog steeds niet: dat zijn twee
 * bijna identieke pagina's die elkaar beconcurreren. Daarom hangt het
 * wit-artikel als `wit` aan de maatvariant van het mengbare product. Wie
 * 100% wit kiest, bestelt de sku van het wit-artikel — dan boekt de kassa de
 * juiste voorraad af. Wit zonder mengbare broer (2 stuks, gemeten) blijft een
 * gewoon los product.
 */
function isWitKandidaat(item: FeedItem): boolean {
  if ((item.brand ?? "").trim().toLowerCase() !== "sikkens") return false;
  if ((item.mengverf ?? "").trim() === "Ja") return false;
  return /\bwit\s*$/i.test(item.title ?? "");
}

function witSleutel(titel: string, maat: string | undefined): string {
  return `${titel.trim().replace(/\s+/g, " ").toLowerCase()}|${(maat ?? "")
    .trim()
    .toLowerCase()}`;
}

interface WitKoppeling {
  /** Wit-artikel per mengbare titel+maat. */
  index: Map<string, FeedItem>;
  /** Id's van gekoppelde wit-artikelen; die worden geen eigen product. */
  gekoppeld: Set<string>;
}

function koppelWitArtikelen(items: FeedItem[]): WitKoppeling {
  const mengbaar = new Set<string>();
  for (const item of items) {
    if ((item.brand ?? "").trim().toLowerCase() !== "sikkens") continue;
    if ((item.mengverf ?? "").trim() !== "Ja") continue;
    mengbaar.add(witSleutel(item.title ?? "", item.maat));
  }
  const index = new Map<string, FeedItem>();
  const gekoppeld = new Set<string>();
  for (const item of items) {
    if (!isWitKandidaat(item) || !item.id) continue;
    const romp = (item.title ?? "").replace(/\s*\/?\s*wit\s*$/i, "");
    const sleutel = witSleutel(romp, item.maat);
    if (!mengbaar.has(sleutel)) continue;
    index.set(sleutel, item);
    gekoppeld.add(item.id);
  }
  return { index, gekoppeld };
}

function hoortOnline(item: FeedItem): boolean {
  if (!hoofdgroepOnline(item)) return false;
  // Zonder foto niet online (opdracht Kevin). Een kaartje met een grijs vlak
  // verkoopt niet, en Google keurt zo'n artikel toch af. Zodra de foto er is,
  // staat het artikel er de volgende nacht vanzelf weer bij.
  if (!(item.image_link ?? "").trim()) return false;
  const merk = (item.brand ?? "").trim().toLowerCase();
  if (MERKEN_NIET_ONLINE.has(merk)) return false;
  if (PASTA_IN_DE_NAAM.test(item.title ?? "")) return false;
  if (KASSAREGEL_IN_DE_NAAM.test(item.title ?? "")) return false;
  // Twee bronnen voor de subgroep: het losse veld sinds de sync, en het
  // laatste stuk van "Verf > …" van daarvoor. Beide checken, want deze bron
  // is al één keer van vorm gewisseld en een gemiste wissel zet stilletjes
  // 111 mengmachine-artikelen online.
  const sub = ((item.categories ?? "").split(">").pop() ?? "").trim().toLowerCase();
  const subVeld = (item.categorie_sub ?? "").trim().toLowerCase();
  return !SUBCATEGORIEEN_NIET_ONLINE.has(sub) && !SUBCATEGORIEEN_NIET_ONLINE.has(subVeld);
}



/**
 * De subcategorie uit de feed ("Verf > Lakken" → "Lakken").
 *
 * Tilroy zet alles onder één hoofdcategorie "Verf"; de bruikbare indeling
 * zit in het deel erachter. Dezelfde subcategorie komt in meerdere
 * schrijfwijzen voor ("LIJMEN, KITTEN EN VULMIDDELEN" naast "Lijmen,
 * kitten en vulmiddelen"), dus normaliseren we naar één weergavevorm —
 * anders staat hetzelfde filter er twee keer in.
 */
function subcategoryOf(rawCategory: string | undefined): string | undefined {
  if (!rawCategory) return undefined;
  const sub = (rawCategory.split(">").pop() ?? "").trim();
  if (!sub) return undefined;
  const lower = sub.toLocaleLowerCase("nl");
  return lower.charAt(0).toLocaleUpperCase("nl") + lower.slice(1);
}

/* ── XML-parsing ───────────────────────────────────────────────── */

type FeedItem = Record<string, string>;

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function parseItems(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const itemPattern = /<item>([\s\S]*?)<\/item>/g;
  const fieldPattern = /<([a-z_0-9]+)>([\s\S]*?)<\/\1>/g;
  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemPattern.exec(xml)) !== null) {
    const fields: FeedItem = {};
    const body = itemMatch[1];
    let fieldMatch: RegExpExecArray | null;
    fieldPattern.lastIndex = 0;
    while ((fieldMatch = fieldPattern.exec(body)) !== null) {
      fields[fieldMatch[1]] = decodeXml(fieldMatch[2]);
    }
    if (fields.title) fields.title = zonderPartijhandel(fields.title);
    if (fields.id) items.push(fields);
  }
  return items;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 70);
}

function toCents(value: string | undefined): number {
  if (!value) return 0;
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

/**
 * De prijzen van één feedregel, met een lopende actie erin verwerkt.
 *
 * Regel van Kevin (6 augustus 2026): *"extra kortingen is altijd voor iedereen,
 * dat betekent dat soms de reguliere prijs goedkoper is dan de kluspasprijs,
 * laat dan alleen de normale prijs zien en de sale price, je krijgt daar dan
 * ook geen extra kluspaskorting op."*
 *
 * Een Tilroy-actie is dus géén ledenkorting: iedereen betaalt hem. Daarom
 * wordt de actieprijs gewoon de prijs, komt de normale prijs doorgestreept
 * ernaast, en verdwijnt de Kluspas-prijs — die zou anders een voordeel
 * voorspiegelen dat er niet is, of erger, hoger uitvallen dan wat iedereen
 * betaalt.
 *
 * ⚠️ De velden `promo_prijs`/`promo_van`/`promo_tot` levert het dashboard nog
 * NIET. Zolang ze ontbreken doet deze functie precies wat de site hiervóór
 * deed. Ze staan er al wel in omdat de actie die er nu loopt anders in het
 * Kluspas-veld belandt: het dashboard schrijft de Tilroy-promoprijs daar in
 * (`lib/tilroyProductCatalogus.ts:574`), waardoor een korting voor iedereen
 * eruitziet als pashouderkorting. Dat is bij hen gemeld.
 *
 * Het datumvenster toetsen we zelf. Een actie die is afgelopen maar nog in de
 * feed staat, is precies het soort prijs waar je een klacht over krijgt.
 */
export function prijzenVan(
  item: FeedItem,
  nu: number = Date.now(),
): { prijs: number; vanaf: number; kluspas: number; actie: boolean } {
  const standaard = toCents(item.sale_price ?? item.price);
  const advies = toCents(item.price);
  const kluspas = toCents(item.kluspas_prijs);
  const promo = toCents(item.promo_prijs);

  const binnenVenster = (() => {
    if (!promo) return false;
    const grens = (waarde: string | undefined) => {
      const tijd = waarde ? Date.parse(waarde) : Number.NaN;
      return Number.isNaN(tijd) ? null : tijd;
    };
    const van = grens(item.promo_van);
    const tot = grens(item.promo_tot);
    if (van !== null && nu < van) return false;
    // Einddatum zonder tijd betekent "tot en met die dag".
    if (tot !== null && nu > tot + 24 * 60 * 60 * 1000 - 1) return false;
    return true;
  })();

  if (binnenVenster && promo < standaard) {
    return { prijs: promo, vanaf: standaard, kluspas: 0, actie: true };
  }
  return {
    prijs: standaard,
    vanaf: advies,
    kluspas: isGeloofwaardigeKluspasPrijs(standaard, kluspas) ? kluspas : 0,
    actie: false,
  };
}

/**
 * Productfoto via de beeldproxy, in de vorm die het ook echt doet.
 *
 * Ongeveer één op de acht artikelen kreeg een URL van de vorm
 * `/s/resizeinbox/580x580/…` mee; die geeft bij de proxy een 403, terwijl
 * `/v7/…` voor precies dezelfde foto gewoon werkt (gemeten: 4/30 tegenover
 * 30/30, en alle 20 herschreven mislukkelingen kwamen door). De foto's
 * bestaan dus wel degelijk — het is puur de URL-vorm.
 *
 * Het dashboard normaliseert dit sinds 2026-07-27 zelf (PR #310), dus in
 * de praktijk valt hier niets meer om te zetten. Blijft staan als vangnet:
 * de omzetting is idempotent en kost niets, en hij vangt oude URL's uit de
 * Redis-cache af zolang die nog rondgaan.
 *
 * Meten doe je met GET + Range-header, nooit met HEAD: de proxy antwoordt
 * anders op HEAD, wat vals-negatieven geeft.
 */
function fotoUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return (
    value
      .replace(/\/s\/resizeinbox\/\d+x\d+\//, "/v7/")
      // Een plus in de bestandsnaam ("HOUTBOUT + MOER") wordt onderweg als
      // spatie gelezen en levert een 404 op; als %2B komt precies dezelfde
      // foto wél door. Raakt 388 artikelen, waarvan er geen enkele laadde.
      .replace(/\+/g, "%2B")
  );
}

/**
 * Pad van dit artikel op de huidige (Tilroy-)site, bv.
 * "/nl/histor-p-f-zg-leliewit-750ml-1000021". Wordt gebruikt om oude URL's
 * na de overgang naar de nieuwe productpagina te sturen.
 */
function legacyPathFrom(link: string | undefined): string | undefined {
  if (!link) return undefined;
  try {
    const path = new URL(link).pathname.toLowerCase().replace(/\/+$/, "");
    return path && path !== "/" ? path : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Specificatietabel.
 *
 * Zo volledig als de bron toelaat: klanten vergelijken hierop, en een lege
 * tabel maakt een productpagina waardeloos. Alleen velden die de feed ook
 * echt vult komen erin — een regel "Ondergrond: —" is erger dan geen regel.
 */
function buildSpecs(item: FeedItem, group: FeedItem[]): { label: string; value: string }[] {
  const specs: { label: string; value: string }[] = [];
  const gezien = new Set<string>();
  const add = (label: string, waarde: string | undefined) => {
    const tekst = waarde?.trim();
    if (!tekst || gezien.has(label)) return;
    gezien.add(label);
    specs.push({ label, value: tekst });
  };

  add("Merk", item.brand);
  add("Productlijn", item.productlijn);
  // "Type" komt uit de subtitel, en die is bij een handvol artikelen gevuld
  // met de leveranciersnaam waaronder ze in de kassa staan ("Type: Euromat").
  // Dat is geen productkenmerk; die regel laten we dan weg.
  add("Type", toonbareRubriek(item.subtitel ?? "") ? item.subtitel : undefined);

  // Alle maten van de groep, niet alleen die van het eerste artikel: na het
  // samenvoegen van maatvarianten dekt "maat_range" de rest niet meer.
  //
  // "1SIZE" hoort hier niet bij. Dat is Tilroy's manier om te zeggen dát er
  // geen maat is; als specificatie "Maten: 1SIZE" leest het als een maat die
  // zo heet.
  const maten = [
    ...new Set(
      group.map((entry) => entry.maat?.trim()).filter((maat) => heeftEchteMaat(maat)),
    ),
  ];
  // Bij een vloer met bekende pakinhoud is de rauwe maat ("2673") ruis; de
  // regel "Pakinhoud: 2,673 m² per pak" verderop zegt hetzelfde, maar dan in
  // taal die een klant kan lezen.
  const isVloer = /laminaat|ondervloer|vloer|plint/i.test(
    `${item.categorie_sub ?? ""} ${item.categories ?? ""}`,
  );
  const pakM2Spec = isVloer ? pakInhoudM2(item.maat) : null;
  if (!pakM2Spec) {
    add(
      maten.some((maat) => /\b(ml|l|liter)\b/i.test(maat!)) ? "Inhoud" : "Maten",
      maten.length > 1
        ? maten.join(", ")
        : (maten[0] ?? (heeftEchteMaat(item.maat_range) ? item.maat_range : undefined)),
    );
  }

  // Verpakkingsaantallen: staan alleen in de titel, terwijl een klant er wel
  // op koopt ("krijg ik er één of tien?"). Oplopend, net als de maten.
  const verpakkingen = [...new Set(group.map((entry) => verpakkingUit(entry.title)).filter(Boolean))]
    .sort((a, b) => aantalUit(a!) - aantalUit(b!));
  add("Verpakking", verpakkingen.length > 0 ? verpakkingen.join(", ") : undefined);

  // "Transparant" is de kassastandaard (twee derde van de catalogus,
  // inclusief witte muurverf), geen kleur. In een spec-tabel is het
  // desinformatie.
  if ((item.kleur ?? "").trim().toLowerCase() !== "transparant") {
    add("Kleur", item.kleur);
  }
  add("Verfsoort", item.verfsoort);
  add("Glans", item.glans);
  add("Toepassing", item.toepassing || item.objectList?.replace(/\|/g, ", "));
  add("Ondergrond", item.ondergrondList?.replace(/\|/g, ", ") || item.ondergrond);
  add("Eigenschappen", item.eigenschappen?.replace(/\|/g, ", "));
  add("Kwaliteit", item.kwaliteit);
  // Staat als veld al in de feed maar was tot nu toe leeg; het dashboard vult
  // hem uit Tilroy's featureFeed (1.871 artikelen). Nooit zelf invullen: een
  // verzonnen droogtijd kost iemand zijn tweede laag.
  add("Droogtijd", item.droogtijd);

  // Uit de titel gelezen kenmerken (zie soorten.ts en vloer.ts): dezelfde
  // gegevens waar de filters op draaien, dus de tabel en de filterkolom
  // spreken elkaar nooit tegen.
  const kenmerken = soortKenmerken(
    (item.categorie_sub ?? "").trim() || subcategoryOf(item.categories) || "",
    item.title ?? "",
  );
  add("Soort", kenmerken.soort);
  add("Materiaal", kenmerken.materiaal);
  add("Dessin", kenmerken.dessin);
  if (isVloer) {
    add("Houtsoort", houtsoortUit(item.title ?? ""));
    add("Tint", tintUit(item.title ?? ""));
    if (pakM2Spec) add("Pakinhoud", `${formatteerM2(pakM2Spec)} m² per pak`);
  }

  // Uit de handgeschreven webtekst, zodra de feed die meelevert. De
  // rekenhulp op de productpagina leest deze regel (coveragePerLiter) en
  // kan dan liters uitrekenen in plaats van alleen een vuistregel.
  const rendement = rendementUit(item);
  if (rendement) add("Rendement", `ca. ${String(rendement).replace(".", ",")} m² per liter`);

  add("Artikelnummer", item.id);

  return specs;
}

/**
 * Bepaalt welke feed-items bij één product horen.
 *
 * Normaal is dat `group_id` (dezelfde verf in 1 L / 2,5 L / 5 L). Bij mengverf
 * staan de basissen (licht/midden/donker) in de feed als afzonderlijke
 * groepen met een eigen prijs. Die voegen we samen op productlijn + glans, want
 * voor de klant is het één product: hij kiest een kleur en een inhoud, en wij
 * kiezen de basis (zie lib/paint-bases.ts).
 */
/** Maten die geen maat zijn: die zeggen alleen "dit artikel heeft er geen". */
const GEEN_MAAT = new Set(["1size", "one size", "n.v.t.", "nvt", "-"]);

function heeftEchteMaat(maat: string | undefined): boolean {
  const waarde = maat?.trim().toLowerCase();
  return Boolean(waarde) && !GEEN_MAAT.has(waarde!);
}

/**
 * De titel zonder maat- en aantalvermeldingen.
 *
 * Hiermee herkennen we artikelen die in werkelijkheid maten van hetzelfde
 * product zijn. Tilroy geeft elke maat een eigen group_id, dus zonder deze
 * stap staan er 103 losse "Mack Spaanplaatschroef PZ2" in de catalogus en
 * vier aparte blikken Histor Leliewit die alleen in inhoud verschillen.
 */
function titelRomp(titel: string, maat: string | undefined): string {
  let tekst = ` ${titel.toLowerCase()} `;
  if (maat) tekst = tekst.split(maat.toLowerCase()).join(" ");
  return tekst
    .replace(/\b\d+(?:[.,]\d+)?\s*(mm|cm|mtr|meter|ml|l|liter|gr|gram|kg|watt|w|volt|v|inch)\b/g, " ")
    .replace(/\bm\d+\s*x\s*\d+(?:[.,]\d+)?\b/g, " ")
    .replace(/\b\d+(?:[.,]\d+)?\s*x\s*\d+(?:[.,]\d+)?\b/g, " ")
    .replace(/\b\d+\s*(st|stuks?|maal)\b/g, " ")
    .replace(/\b\d+(?:[.,]\d+)?\b/g, " ")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Productnaam voor een groep samengevoegde maten.
 *
 * We knippen de titel af op het punt waar de maatvermelding begint, en
 * houden netjes hoofdletters en leestekens van het origineel aan. Levert
 * dat te weinig op, dan blijft de volledige titel staan — een half woord
 * als productnaam is erger dan een titel met een maat erin.
 */
function naamZonderMaat(titel: string, group: FeedItem[]): string {
  const kandidaten = group
    .map((item) => item.maat?.trim())
    .filter((maat): maat is string => Boolean(maat));

  let afkap = titel.length;
  for (const maat of [...kandidaten, ...MAAT_PATRONEN_BRON]) {
    const index = titel.toLowerCase().indexOf(maat.toLowerCase());
    if (index > 0) afkap = Math.min(afkap, index);
  }
  const patroon = titel.match(/\b\d+(?:[.,]\d+)?\s*(?:mm|cm|ml|l|liter|inch|st|stuks?|maal)\b/i);
  if (patroon?.index && patroon.index > 0) afkap = Math.min(afkap, patroon.index);

  const kort = titel.slice(0, afkap).replace(/[\s\-–,]+$/, "").trim();
  return kort.length >= 8 ? kort : titel;
}

/** Losse maataanduidingen die vaak los in een titel staan. */
const MAAT_PATRONEN_BRON: string[] = [];

function escapeRegex(tekst: string): string {
  return tekst.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Haalt de maat-echo van het titeleinde.
 *
 * Tilroy plakt de kassamaat achter titels die de maat zelf al noemen:
 * "… 5 stuks 5,0 x 80 mm 5,0 X 80 MM 5 ST". Voor producten die niet met
 * andere maten samensmelten bleef die dubbeling in H1, paginatitel en URL
 * staan. We knippen de staart (de maat, eventueel gevolgd door een
 * stuks-aantal) alléén weg als exact dezelfde maat eerder in de titel
 * voorkomt — "Behanglijm 2,25 KG" noemt zijn maat één keer en blijft heel.
 */
function zonderMaatEcho(titel: string, maat: string | undefined): string {
  const m = maat?.trim();
  if (!m || !heeftEchteMaat(m)) return titel;
  // De echo mag beginnen met het diameterdeel ("M6 x" of "5,3 x") — anders
  // bleef juist dát als wees achter: "… M6 x 40 mm M6".
  const staart = new RegExp(
    `(?:\\s+m?\\d+(?:[.,]\\d+)?\\s*x)?\\s+${escapeRegex(m)}(?:\\s+\\d+\\s*st)?\\s*$`,
    "i",
  );
  const match = titel.match(staart);
  if (match?.index === undefined || match.index <= 0) return titel;
  if (!titel.slice(0, match.index).toLowerCase().includes(m.toLowerCase())) return titel;
  return titel.slice(0, match.index);
}

/**
 * Ruimt de productnaam op.
 *
 * De brondata laat er soms magazijncodes in staan — "1SIZE" betekent alleen
 * "dit artikel heeft geen maat" en hoort niet op een productpagina. Ook
 * dubbele spaties en losse leestekens aan het eind gaan eruit.
 */
function schoneNaam(naam: string): string {
  return (
    naam
      .replace(/\b1\s?size\b/gi, " ")
      .replace(/\s*\|\s*$/g, "")
      .replace(/\s+/g, " ")
      // Na het wegknippen van de maat blijft er nogal eens een halve
      // koppeling achter: "Benson Afdekzeil 3 x", "Fischer DuoPower … 10 X",
      // "Tafelcontactdoos 4-voudig + Randaarde +", "Schakelaar 1,5 met".
      // Alleen die staarten — een losse x/×/+ of "met", eventueel met het
      // weesgetal ervoor, plus een decimaal eindgetal ("1,5" is altijd een
      // halve maat) — knippen we weg. Hele eindgetallen blijven staan:
      // "Leliewit 6213" en "Trendtime 6" zijn namen, geen restjes. 38 titels
      // waren zo tot onzin afgekapt, tot in de H1 en de URL.
      .replace(/(?:\s+(?:\d+(?:[.,]\d+)?\s*)?[x×+]|\s+met|\s+\d+[.,]\d+)+\s*$/gi, "")
      .replace(/[\s\-–,|]+$/g, "")
      .trim()
  );
}

/**
 * Zet de enige maat achter de naam, als het artikel er maar één heeft.
 *
 * Netjes geschreven zoals de klant het leest: "2,5 L", niet "2,5 L 2,5L".
 * Staat de maat al ergens in de naam, dan blijft het bij één vermelding.
 *
 * Alleen maten die als verpakking te lezen zijn. De kassa zet bij penselen
 * de penseelmaat in hetzelfde veld mét liter-eenheid — "Anza Lyons Penseel
 * Maat 20" heeft daar "20 ml" staan, en "SAM Stoffertje halve maan" zelfs
 * "1 ml". Dat achter de naam plakken maakt van een kwast een flesje. Onder
 * de 100 ml vertrouwen we die eenheid dus niet; millimeters, centimeters,
 * grammen en kilo's zeggen wél iets echts over het artikel.
 */
function metEnigeMaat(naam: string, variants: ProductVariant[]): string {
  if (variants.length !== 1) return naam;
  const maat = variants[0].size?.trim();
  if (!maat || !bruikbareVerpakkingsmaat(maat)) return naam;
  const genormaliseerd = (tekst: string) => tekst.toLowerCase().replace(/[\s.,]/g, "");
  if (genormaliseerd(naam).includes(genormaliseerd(maat))) return naam;
  // Staat er al een inhoud in de naam, dan is die van de kassa en de onze een
  // andere schrijfwijze van hetzelfde blik: "Sikkens Cetol Novatech 2,475L"
  // met daarachter nog eens "2,5 L" leest als twee maten.
  if (/\d+(?:[.,]\d+)?\s*(?:ml|l|liter|kg|gram|gr)\b/i.test(naam)) return naam;
  return `${naam} ${maat}`;
}

function bruikbareVerpakkingsmaat(maat: string): boolean {
  const match = maat.match(/^(\d+(?:[.,]\d+)?)\s*(ml|l|liter|kg|gr|gram|mm|cm|m)\b/i);
  if (!match) return false;
  const waarde = Number(match[1].replace(",", "."));
  const eenheid = match[2].toLowerCase();
  if (!Number.isFinite(waarde) || waarde <= 0) return false;
  // Alleen de milliliters zijn verdacht: dat is het veld waar de kassa
  // penseelmaten in kwijt kan. Een echt flesje of koker is minstens 100 ml.
  if (eenheid === "ml") return waarde >= 100;
  return true;
}

/**
 * Zet de glansgraad achter de naam, als die er nog niet in staat.
 *
 * "Er staat al in" is breder dan letterlijk hetzelfde woord: bij Sikkens
 * staat de glansgraad in het Engels in de titel, en dan werd het "Sikkens
 * Rubbol XD High Gloss Hoogglans". Zegt de naam het al, in welke taal dan
 * ook, dan laten we hem met rust.
 */
function metGlans(naam: string, glans: string | undefined): string {
  const waarde = glans?.trim();
  if (!waarde) return naam;
  if (naam.toLowerCase().includes(waarde.toLowerCase())) return naam;
  const alGenoemd = GLANS_UIT_TITEL.find((entry) => entry.patroon.test(naam))?.glans;
  if (alGenoemd === waarde) return naam;
  return `${naam} ${waarde}`;
}

/**
 * Zet de drager (Alkyd of Acryl) in de naam als de artikelen die zelf noemen.
 *
 * Histor voert Perfect Finish in twee werelden: alkyd (terpentine, basis ZX)
 * en acryl (watergedragen, basis ZN) — per document van Kevin twee echt
 * verschillende verven. De productlijn uit de kassa zegt alleen "Histor
 * Perfect Finish", en dan stonden beide families als tweemaal exact
 * "Histor Perfect Finish Hoogglans" in de lijst, met verschillende prijzen.
 * Het woord staat gewoon in de artikelnamen; we hoeven het er alleen uit te
 * lezen. Sikkens-lijnen noemen geen drager en veranderen dus niet.
 */
function metDrager(naam: string, artikelTitel: string): string {
  const drager = artikelTitel.match(/\b(alkyd|acryl)\b/i)?.[1];
  if (!drager) return naam;
  if (naam.toLowerCase().includes(drager.toLowerCase())) return naam;
  const netjes = drager.charAt(0).toUpperCase() + drager.slice(1).toLowerCase();
  return `${naam} ${netjes}`;
}

/**
 * De maat als getal, om varianten op te kunnen sorteren.
 *
 * Liters wegen zwaarder dan millimeters, zodat inhoud en lengte nooit door
 * elkaar sorteren binnen één product. `inhoud_liter` uit de feed gaat voor;
 * anders lezen we het getal uit het maatveld.
 */
function maatWaarde(item: FeedItem): number {
  const liter = Number(item.inhoud_liter ?? 0);
  if (Number.isFinite(liter) && liter > 0) return liter;
  const match = item.maat?.match(/([\d]+(?:[.,]\d+)?)/);
  if (!match) return 0;
  const waarde = Number(match[1].replace(",", "."));
  return Number.isFinite(waarde) ? waarde : 0;
}

/** Verpakkingsaantal als getal ("4 stuks" → 4, "1 maal" → 1). */
function aantalUit(titel: string | undefined): number {
  const match = titel?.match(/\b(\d+)\s*(?:stuks?|st\b|maal)/i);
  const waarde = match ? Number(match[1]) : 1;
  return Number.isFinite(waarde) ? waarde : 1;
}

/** "4 stuks", "1 maal", "200 ST" uit de titel — het verpakkingsaantal. */
function verpakkingUit(titel: string | undefined): string | undefined {
  const match = titel?.match(/\b(\d+)\s*(stuks?|st\b|maal)/i);
  if (!match) return undefined;
  const aantal = Number(match[1]);
  if (!Number.isFinite(aantal) || aantal < 1) return undefined;
  return aantal === 1 ? "per stuk" : `${aantal} stuks`;
}

/**
 * De basiscode van het einde van een productlijn.
 *
 * De kassa zet de mengbasis niet alleen in het basisveld maar ook achter de
 * lijnnaam: "Drenth Grondlak" (licht), "Drenth Grondlak D" (donker), "Drenth
 * Grondlak SD TR" (transparant). Zolang die letter meetelt in de sleutel is
 * elke basis een eigen product, en dan staat "Drenth Grondlak D" als losse
 * regel in de zoekresultaten — voor een klant onbegrijpelijke zooi, want hij
 * kiest een kleur en wij kiezen de basis.
 *
 * Alleen de codes die Kevin heeft doorgegeven: Sikkens W05/N00, Histor
 * LN/ZN/ZX, Fitex/Drenth/Pastolex D/TR. "SD" blijft staan — dat is een eigen
 * product (Grondlak SD naast Grondlak), geen basis.
 */
const BASIS_ACHTER_LIJNNAAM = /\s+(w05|n00|ln|zn|zx|tr|d)$/i;

function lijnZonderBasis(productlijn: string): string {
  let naam = productlijn.trim();
  // Twee keer, want "Grondlak SD TR" kan er ook nog een hebben staan.
  for (let ronde = 0; ronde < 2; ronde++) {
    const korter = naam.replace(BASIS_ACHTER_LIJNNAAM, "");
    if (korter === naam) break;
    naam = korter;
  }
  return naam;
}

/**
 * Basiscodes ergens midden in een naam.
 *
 * `lijnZonderBasis` pakt alleen het staartje van de productlijn, maar in de
 * webnaam die de kassa meegeeft staat de code overal: "Histor P.B. Afbijt TR
 * 0,75L", "Flexa Creations Lak Zijdeglans 1L base N00", "Fitex Creative
 * Excellent Muur/Plafond TR 2,5 liter". Op 48 mengverven stonden er 25 met
 * een code in de naam — de helft van de kleurkiezer dus.
 *
 * Alleen bij mengverf toepassen: buiten die groep is "D" gewoon een letter.
 * "Perfect Base" blijft heel, want "base" gaat er alleen af als er een code
 * achter staat.
 */
const MENGBASIS_CODES = "w05|n00|ln|zn|zx|tr|tu|d";

function zonderMengbasis(naam: string): string {
  return naam
    .replace(new RegExp(`\\b(?:basis|base)\\s+(?:${MENGBASIS_CODES})\\b`, "gi"), " ")
    .replace(new RegExp(`\\b(?:${MENGBASIS_CODES})\\b`, "gi"), " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * De glansgraad, ook als de kassa het veld leeg laat.
 *
 * Bij Sikkens staat `glans` leeg en zit de glansgraad in de titel, in het
 * Engels: "Sikkens Rubbol XD High Gloss" naast "Sikkens Rubbol XD Semi-Gloss".
 * Omdat de groepssleutel op het lege veld keek, belandden hoogglans en
 * zijdeglans onder één product met één prijs — terwijl het twee verschillende
 * verven zijn. Op 692 mengverf-artikelen staat het veld 430 keer leeg; bij 86
 * daarvan zegt de titel het gewoon.
 *
 * Kevins voorbeeld 1003402 is er één: "Sikkens Rubbol XD High Gloss",
 * donkere basis, oude URL xd-hg-n00-1l.
 */
const GLANS_UIT_TITEL: { patroon: RegExp; glans: string }[] = [
  { patroon: /\b(high gloss|hoogglans)\b/i, glans: "Hoogglans" },
  { patroon: /\b(semi[- ]?gloss|zijdeglans|satin)\b/i, glans: "Zijdeglans" },
  { patroon: /\b(zijdemat|eggshell)\b/i, glans: "Zijdemat" },
  { patroon: /\b(matt?|flat)\b/i, glans: "Mat" },
  // "Gloss" zonder meer staat achteraan: "High Gloss" en "Semi Gloss" moeten
  // eerst hun kans krijgen, anders wordt alles hoogglans.
  { patroon: /\bgloss\b/i, glans: "Hoogglans" },
];

function glansVan(item: FeedItem): string | undefined {
  const veld = item.glans?.trim();
  if (veld) return veld;
  const titel = item.title ?? "";
  return GLANS_UIT_TITEL.find((entry) => entry.patroon.test(titel))?.glans;
}

/**
 * Waarop mengverf van elkaar te onderscheiden is.
 *
 * De productlijn alleen was niet genoeg, en dat kostte verkeerde pakketten.
 * Tilroy zet Express, Extra en de gewone primer allemaal onder productlijn
 * "Sikkens Rubbol Primer". Wij groepeerden daarop, dus stonden ze op één
 * pagina — met een maatkeuze waarin de 500 ml alleen als gewone primer
 * bestaat. Wie op de Express-pagina 500 ml koos, kreeg de gewone primer
 * ingepakt. Het inpakteam meldde het; drie primers op één pagina.
 *
 * Gemeten op de hele feed: 24 van de 128 mengverf-groepen voegden zo
 * verschillende artikelen samen. Histor Perfect Base was de ergste met
 * zestien — betonverf, tegelverf, trapverf, radiatorlak en grondverf onder
 * één noemer.
 *
 * De titel maakt het onderscheid wél, mits je hem opschoont: maat eraf
 * (titelRomp), mengbasiscode eraf, en de glansgraad eraf omdat die al een
 * eigen deel van de sleutel is — anders splitsen "Semi Gloss" en "Semi-Gloss"
 * hetzelfde product alsnog in tweeën.
 *
 * Blijft er te weinig over, dan houden we de productlijn aan: liever maten
 * samen op één pagina dan een half woord als kenmerk.
 */
function mengKenmerk(item: FeedItem): string {
  const zonderGlans = GLANS_UIT_TITEL.reduce(
    (naam, entry) => naam.replace(new RegExp(entry.patroon.source, "gi"), " "),
    item.title ?? "",
  );
  const kenmerk = zonderMengbasis(titelRomp(zonderGlans, item.maat)).trim();
  return kenmerk.length >= 6 ? kenmerk : lijnZonderBasis(item.productlijn ?? "");
}

function groupKeyFor(item: FeedItem): string {
  if (item.mengverf === "Ja" && item.productlijn && parseBase(item.mengbasis)) {
    // `verfsoort` bewust niet in de sleutel. Dat veld is bij mengverf half
    // gevuld: van de tien Rubbol XD-artikelen draagt er één "Oplosmiddel" en
    // de rest niets, en dat ene werd daardoor een eigen product met alleen
    // een lichte basis — waardoor een klant die zwart koos daar geen donkere
    // basis kon krijgen. Een veld dat maar bij een enkel artikel is ingevuld
    // is een gat in de data, geen productverschil.
    return `meng:${[mengKenmerk(item), glansVan(item)]
      .filter(Boolean)
      .join("|")
      .toLowerCase()}`;
  }

  // Maatvarianten van hetzelfde artikel samen onder één product. Alleen als
  // er een échte maat staat: bij "1SIZE" zegt het veld niets, en dan zouden
  // bijvoorbeeld alle behangdessins van een serie op één hoop belanden.
  if (heeftEchteMaat(item.maat) && item.title) {
    const romp = titelRomp(item.title, item.maat);
    // Blijft er te weinig over, dan is de romp geen betrouwbaar kenmerk meer.
    if (romp.length >= 6) {
      return `maat:${(item.brand ?? "").toLowerCase()}|${romp}`;
    }
  }

  return item.group_id ?? item.id;
}

/**
 * Filterbare eigenschappen. Alleen velden waar genoeg artikelen een waarde
 * voor hebben — een filter met drie opties op vijfduizend producten helpt
 * niemand.
 */
/** Wat `bezorgbaarheid()` nodig heeft, uit één feedregel. */
function teBezorgen(item: FeedItem): TeBezorgenArtikel {
  return {
    name: item.title ?? "",
    variantName: item.maat,
    liters: Number(item.inhoud_liter ?? 0) || undefined,
    subcategorie: subcategoryOf(item.categories),
  };
}

/** "2,493" — Nederlandse komma, zonder overbodige nullen. */
function formatteerM2(waarde: number): string {
  return waarde
    .toFixed(3)
    .replace(/0+$/, "")
    .replace(/\.$/, "")
    .replace(".", ",");
}

/**
 * Vijfhonderd artikelen onder één afkorting is geen indeling.
 *
 * "Schildersger. en Schuurpapier" telt 582 artikelen: kwasten, rollers,
 * schuurpapier, afplaktape en verfbakken door elkaar. Wie een kwast zoekt
 * ziet in het menu geen kwasten — hij ziet een afkorting waar hij eerst op
 * moet klikken om te ontdekken wat erin zit. De kassa gaat niet fijner dan
 * dit, maar de artikelnamen wel: die zeggen precies wat het is.
 *
 * Alleen voor deze vergaarbak, en alleen wat zeker is. Wat niet te herkennen
 * valt, houdt de kassanaam — een verkeerde inhoudsopgave is erger dan een
 * grove.
 */
const VERFGEREEDSCHAP_SOORTEN: { naam: string; match: RegExp }[] = [
  // Zonder woordgrens vooraan: "Radiatorkwast" en "muurroller" zijn ook
  // gewoon een kwast en een roller. Merklijnen staan erbij omdat Anza zijn
  // kwasten en vachten alleen bij naam noemt (Diamond Classic, Micmex).
  {
    naam: "Kwasten en penselen",
    match: /(kwast|penseel|borstel|blokwitter|witter\b|diamond classic|titanium rond|platinum serie|synthetic alkyd|serie 7\d\d|\bmaat \d+|\bplat \d)/i,
  },
  {
    naam: "Verfrollers en toebehoren",
    match: /(roller|vachtje|verfrol|anti-?spat|verlengsteel|telescoopsteel|beugel|\bvilt\b|wistex|muurvacht|pro\s+(?:mini|maxi)|micmex|antex|elon|rimax|structuurrol|aflakrol|muurrol|\bmv rol\b|\brol\b)/i,
  },
  // Sets vóór de losse onderdelen: een aflakset ís geen roller, het is een
  // startpakket met roller, kwast en bak erin.
  { naam: "Verfsets en startpakketten", match: /(aflakset|muurverfset|verfset|paintbox|\d-?delig|\ddlg)/i },
  { naam: "Schuurpapier en schuurblokken", match: /\bschuur/i },
  { naam: "Afplakken en afdekken", match: /(afplak|masking|afdek|\btape\b|plakband|folie|stucloper|afdekvlies)/i },
  {
    naam: "Messen, spanen en schrapers",
    match: /(plamuurmes|stripmes|plafoneermes|afbreekmes|steekmes|kitmes|\bmes\b|spaan|spreader|schraper|krabber|vervangmes|trekmes|behangstrijker|lijmkam|reservemes|behangafsteker)/i,
  },
  { naam: "Verfbakken en roosters", match: /(verfbak|inzetbak|rooster|mengbeker|verfemmer|mengstok|zeef|verfmixer|mengspiraal)/i },
  { naam: "Reinigen en beschermen", match: /(handschoen|stoffer|bezem|doek|emmer|reiniger|zeem|spons|overall)/i },
  { naam: "Kitpistolen", match: /(kitpistool|kitspuit)/i },
];

/**
 * Afkortingen uit de kassa die een klant niet hoeft te ontcijferen.
 *
 * In een filterlijst is "Acc. elektrisch gereedschap" geen categorie maar een
 * puzzel; "Schildersger. en Schuurpapier" blijft over voor het gereedschap
 * dat we niet konden thuisbrengen en heet daarom "Overig".
 */
const SOORT_ALIAS: Record<string, string> = {
  "schildersger. en schuurpapier": "Overig schildersgereedschap",
  "acc. elektrisch gereedschap": "Accessoires elektrisch gereedschap",
  "interbosch aanhangw. en auto": "Aanhangwagen en auto",
  // Vier rollen tape stonden als eigen "soort" naast de rubrieken.
  "zelfklevende artikelen": "Afplakken en afdekken",
};

/**
 * Soorten binnen Schoonmaak en onderhoud, op wat de klant wil schoonmaken.
 * HG zet dat keurig in de naam ("Parketreiniger", "Whirlpool Reiniger");
 * één bak "Huishoudelijk" met 258 flessen wijst niemand de weg.
 */
const SCHOONMAAK_SOORTEN: { naam: string; match: RegExp }[] = [
  { naam: "Vloeren en parket", match: /(parket|laminaat|vloer|tapijt|vinyl)/i },
  { naam: "Badkamer en sanitair", match: /(sanitair|badkamer|douche|whirlpool|toilet|kalk|schimmel)/i },
  { naam: "Keuken", match: /(keuken|oven|vaatwasser|afvoer|gootsteen)/i },
  { naam: "Tegels en steen", match: /(tegel|natuursteen|voeg|grind|terras|beton)/i },
  { naam: "Auto en buiten", match: /(auto|car |bbq|barbecue|tuinmeubel|gevel|strooizout|groene aanslag)/i },
  { naam: "Meubels en leer", match: /(meubel|leer|leder|bankstel|textiel|tapijtreiniger)/i },
  { naam: "Handhygiëne", match: /(handgel|hand gel|handzeep|handclean|handreiniger|desinfect)/i },
];

function verfijndeSoort(kassaSub: string, titel: string): string | undefined {
  // Transparante afwerklakken horen in twee rubrieken thuis (keuze Kevin):
  // een parketlak ís een vernislaag, maar wie "lak" zoekt moet hem ook
  // vinden. Het filter leest meerdere waarden gescheiden door een pijp, dus
  // hij verschijnt onder allebei zonder dat het product dubbel bestaat.
  if (
    /^beits, olie en vernis$/i.test(kassaSub.trim()) &&
    /(blanke lak|meubellak|parketlak|vloerlak|pantserlak|jachtlak|bootlak)/i.test(titel)
  ) {
    return "Beits, olie en vernis|Lakken";
  }

  // Muurverf tussen de lak: 29 artikelen die "Muurverf", "Latex" of
  // "Sausklaar" in de naam hebben stonden in de kassa onder Lakken, terwijl
  // er een eigen rubriek Muurverf bestaat. Wie op lak filtert wil geen
  // muurverf zien, en andersom.
  if (/^lakken$/i.test(kassaSub.trim())) {
    if (/(muurverf|latex|sausklaar|wandverf)/i.test(titel)) return "Muurverf";
    // Grondlaag en plamuur zijn geen lak maar voorwerk: Sikkens Rubbol
    // Rezisto Primer, Flexa Grondverf, Perfax Snelplamuur. Wie een lak
    // uitzoekt heeft die al gehad — of moet ze juist apart kunnen vinden.
    if (/(plamuur|houtvuller|vulmiddel|voorstrijk|grondverf|\bprimer\b|hechtprimer)/i.test(titel)) {
      return "Voorbewerken";
    }
    // Beits en hardwax stonden ertussen; alleen als de naam zelf geen lak
    // noemt, want "blanke lak" en "parketlak" zijn wél lak.
    if (/(beits|hardwax|impregneer)/i.test(titel) && !/\blak\b|lakken/i.test(titel)) {
      return "Beits, olie en vernis";
    }
  }

  if (/schildersger/i.test(kassaSub)) {
    const soort = VERFGEREEDSCHAP_SOORTEN.find((entry) => entry.match.test(titel))?.naam;
    if (soort) return soort;
  }
  if (/^huishoudelijk$/i.test(kassaSub.trim())) {
    return (
      SCHOONMAAK_SOORTEN.find((entry) => entry.match.test(titel))?.naam ??
      "Overige schoonmaak"
    );
  }
  // Smeermiddelen die op titel naar Schoonmaak en onderhoud verhuizen, krijgen
  // daar hun eigen soort — niet de "Beits, olie en vernis" van de kassa.
  if (/(wd-?40|kruipolie|slotspray|contactspray|siliconenspray|droogsmeerspray|multi-?use|smeerspray|teflonspray)/i.test(titel)) {
    return "Smeermiddelen en sprays";
  }
  return SOORT_ALIAS[kassaSub.trim().toLocaleLowerCase("nl")];
}

function binnenBuitenUit(item: FeedItem): string | undefined {
  if (!/verf en beits/i.test(item.categorie_hoofd ?? "")) return undefined;
  const tekst = `${item.title ?? ""} ${item.productlijn ?? ""} ${item.categorie_sub ?? ""}`.toLowerCase();
  const buiten = /(buiten|exterior|tuinhout|tuinbeits|gevel|fassaden|boot|dakr|weerbestendig)/.test(tekst);
  const binnen = /(binnen|interior|interieur|muurverf|plafond|latex|behangklaar)/.test(tekst);
  // "Gevel & kozijn binnen en buiten" bestaat: bij twijfel niets beweren.
  if (buiten && !binnen) return "Buiten";
  if (binnen && !buiten) return "Binnen";
  return undefined;
}

function buildAttributes(leader: FeedItem, group: FeedItem[]): Record<string, string> {
  const attributes: Record<string, string> = {};
  const add = (key: string, value: string | undefined) => {
    const trimmed = value?.trim();
    if (trimmed) attributes[key] = trimmed;
  };

  // Twee niveaus van Tilroy: de hoofdgroep is de categorie, de subgroep is
  // het "Soort"-filter binnen die categorie.
  add(
    "hoofdgroep",
    eigenRubriekVoor(leader)?.naam ?? ((leader.categorie_hoofd ?? "").trim() || undefined),
  );
  const kassaSub = (leader.categorie_sub ?? "").trim() || subcategoryOf(leader.categories) || "";
  add("subcategorie", verfijndeSoort(kassaSub, leader.title ?? "") || kassaSub);
  add("glans", glansVan(leader));
  add("droogtijd", leader.droogtijd);
  add("verfsoort", leader.verfsoort);
  // Binnen/buiten is hét eerste filter waar een verfkoper op klikt (zo ook
  // bij verfwinkel.nl), maar de kassa vult het veld op nog geen vijf procent
  // van de verf. De productlijnen zeggen het zelf: Exterior, tuinbeits en
  // gevel zijn buiten; interieurlak, muurverf en plafond zijn binnen. Alleen
  // afgeleid als de kassa niets zegt, en alleen bij een eenduidig woord.
  add("toepassing", leader.toepassing || binnenBuitenUit(leader));
  add("ondergrond", leader.ondergrond);
  add("kwaliteit", leader.kwaliteit);
  // Mengverf krijgt bewust géén kleurkenmerk. Het blik is "Transparant" in de
  // kassa omdat het nog gemengd moet worden — maar voor de klant is het juist
  // élke kleur. Als filterwaarde is "Transparant" dan een fuik: wie erop
  // klikt denkt blanke lak te vinden en krijgt mengbassen. Gemeten: 377 van
  // de mengbare artikelen stonden zo in het kleurfilter.
  if (leader.mengverf !== "Ja") add("kleur", leader.kleur);

  // Soort, dessin en materiaal uit de productnaam, voor rubrieken waar de
  // kassa geen onderverdeling kent. Zie src/lib/soorten.ts voor de meting.
  const kenmerken = soortKenmerken(attributes.subcategorie ?? "", leader.title ?? "");
  add("soort", kenmerken.soort);
  add("dessin", kenmerken.dessin);
  add("materiaal", kenmerken.materiaal);

  // Inhoud: alle maten van de groep, zodat filteren op "2,5 L" ook werkt bij
  // een product dat meerdere maten heeft.
  //
  // "1SIZE" is geen maat maar Tilroy's manier om te zeggen dát er geen maat
  // is; die stond als filteroptie tussen de liters en grammen, twee keer zelfs
  // ("1SIZE" en "1Size"). Zulke waarden horen hier niet, en verschillen in
  // hoofdletters vatten we samen — anders staat dezelfde maat er dubbel in.
  const maten = [
    ...new Map(
      group
        .map((item) => item.maat?.trim())
        .filter((maat): maat is string => heeftEchteMaat(maat))
        .map((maat) => [maat.toLocaleLowerCase("nl"), maat] as const),
    ).values(),
  ];
  if (maten.length > 0) attributes.inhoud = maten.join("|");

  if (leader.mengverf === "Ja") attributes.mengverf = "Ja";
  if (leader.aanbieding === "Ja") attributes.aanbieding = "Ja";

  // Vloeren: houtsoort en tint staan alleen in de productnaam. Het kleurveld
  // is hier onbruikbaar — 25 van de 27 vloerartikelen staan op "Transparant",
  // want dat veld is voor verf gemaakt. Wie laminaat zoekt filtert op eiken of
  // noten, licht of donker, en dat kan alleen door de naam te lezen.
  const rubriek = `${attributes.subcategorie ?? ""} ${leader.categories ?? ""}`;
  if (/laminaat|ondervloer|vloer|plint/i.test(rubriek)) {
    const titel = leader.title ?? "";
    add("houtsoort", houtsoortUit(titel));
    add("tint", tintUit(titel));

    // De pakinhoud in vierkante meters, zodat de rekenhulp op de
    // productpagina niet opnieuw hoeft te raden wat "2673" betekent.
    const perPak = pakInhoudM2(leader.maat);
    if (perPak) attributes.pakM2 = perPak.toFixed(3);

    // Tilroy schrijft diezelfde pakinhoud op drie manieren: "2,493 M2",
    // "2493 M2" en kaal "2673". In het inhoudsfilter stonden die als drie
    // losse keuzes naast elkaar, waarvan er één ("2673") voor een klant
    // helemaal niets betekent. Hier maken we er één leesbare maat van, zodat
    // filteren op pakgrootte doet wat het belooft.
    const perPakVanGroep = group
      .map((item) => pakInhoudM2(item.maat))
      .filter((waarde): waarde is number => waarde !== null);
    if (perPakVanGroep.length > 0) {
      attributes.inhoud = [
        ...new Set(perPakVanGroep.map((waarde) => `${formatteerM2(waarde)} m² per pak`)),
      ].join("|");
    }
  }

  return attributes;
}

/** Zet de varianten van één groep om in één Product. */
/**
 * De echte webtekst uit Tilroy, als de feed die meegeeft.
 *
 * In Tilroy staat per product een handgeschreven Nederlandse webtekst
 * (gemeten: 5.218 van de 6.156 producten) en een commerciële webnaam (6.097,
 * al zonder basissuffix en maat: "Sikkens Rubbol Primer" waar de kassa
 * "Sikkens Rubbol Primer N00 1L" zegt). Het dashboard gaat die als
 * `webnaam` en `omschrijving_web` in de feed zetten; tot die tijd zijn deze
 * velden leeg en verandert er niets.
 *
 * De webtekst is HTML; wij tonen alinea's. Blokelementen worden dus
 * alineascheidingen en de rest van de tags verdwijnt.
 */
/**
 * Rendement voor de rekenhulp. Eerste bron is het feedveld `rendement`
 * (gevuld door de Productkenmerken-import in het dashboard), daarna de
 * webtekst — hermeting dashboard-sessie over 6.855 NL-teksten: zo'n 105–150
 * noemen het echt. Bij een bereik nemen we het gemiddelde; de rekenhulp zegt
 * er "circa" bij.
 *
 * Niet elke m² in een webtekst is een rendement: laminaat noemt de
 * pakinhoud ("Inhoud pak: 2,673 m²"), beglazingskit een maximum-maat
 * ("enkel glas tot 0,6 m²"). Daarom eist elk patroon hier een label
 * (verbruik/rendement/dekking) of een expliciete koppeling aan liters.
 */
function rendementUit(item: FeedItem): number | undefined {
  const getal = (s: string) => Number(s.replace(",", "."));
  const geldig = (w: number) => (Number.isFinite(w) && w > 0 && w < 100 ? w : undefined);
  const bereik = (a: string, b?: string) => (getal(a) + (b ? getal(b) : getal(a))) / 2;

  const veld = (item.rendement ?? "").trim();
  if (veld) {
    const m = veld.match(/(\d+(?:[.,]\d+)?)\s*(?:-|–|a|à|tot\s+)?\s*(\d+(?:[.,]\d+)?)?/);
    if (m) {
      const waarde = geldig(bereik(m[1], m[2]));
      if (waarde) return waarde;
    }
  }

  const tekst = (item.omschrijving_web ?? "").replace(/<[^>]+>/g, " ");

  // "Rendement: ca. 10 m² per liter", "Verbruik: 16-18 m²/l".
  let m = tekst.match(
    /(?:verbruik|rendement|dekking)[^0-9]{0,20}(\d+(?:[.,]\d+)?)\s*(?:-|–|a|à|tot\s+)?\s*(\d+(?:[.,]\d+)?)?\s*m[²2]\s*(?:per\s+liter|\/\s*l\b|per\s+l\b)/i,
  );
  if (m) return geldig(bereik(m[1], m[2]));

  // "Verbruik per liter 25 - 40 m²" — de eenheid staat vóór het getal.
  m = tekst.match(
    /(?:verbruik|rendement|dekking)[^0-9]{0,30}per\s+liter[^0-9]{0,15}(\d+(?:[.,]\d+)?)\s*(?:-|–|a|à|tot\s+)?\s*(\d+(?:[.,]\d+)?)?\s*m[²2]/i,
  );
  if (m) return geldig(bereik(m[1], m[2]));

  // "Een fles van 1 liter is goed voor ongeveer 25 a 50 m²" — delen door de
  // liters. De punt-uitsluiting houdt het binnen één zin.
  m = tekst.match(
    /(\d+(?:[.,]\d+)?)\s*liter[^.]{0,40}?goed\s+voor\s+(?:ongeveer\s+|circa\s+|ca\.?\s*)?(\d+(?:[.,]\d+)?)\s*(?:-|–|a|à|tot\s+)?\s*(\d+(?:[.,]\d+)?)?\s*m[²2]/i,
  );
  if (m) {
    const liters = getal(m[1]);
    if (liters > 0) return geldig(bereik(m[2], m[3]) / liters);
  }
  return undefined;
}

/**
 * HTML-entiteiten naar tekst. Numeriek eerst, dan de namen die in de
 * Tilroy-teksten voorkomen; &amp; als allerlaatste, anders wordt
 * "&amp;eacute;" in twee stappen alsnog een é.
 */
function decodeEntities(tekst: string): string {
  return tekst
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&eacute;/gi, "é")
    .replace(/&egrave;/gi, "è")
    .replace(/&euml;/gi, "ë")
    .replace(/&iuml;/gi, "ï")
    .replace(/&ouml;/gi, "ö")
    .replace(/&uuml;/gi, "ü")
    .replace(/&aacute;/gi, "á")
    .replace(/&agrave;/gi, "à")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&amp;/gi, "&");
}

/** De eerste zin van een tekst, kort genoeg voor onder een productkaart. */
function eersteZin(tekst: string | undefined): string | undefined {
  if (!tekst) return undefined;
  const eerste = tekst.split(/(?<=[.!?])\s|\n/)[0]?.trim();
  if (!eerste || eerste.length < 25) return undefined;
  return eerste.length > 160 ? `${eerste.slice(0, 157).trimEnd()}…` : eerste;
}

function webTekstUit(item: FeedItem): string | undefined {
  const ruw = (item.omschrijving_web ?? "").trim();
  if (ruw.length < 60) return undefined;
  const tekst = decodeEntities(
    ruw
      .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])[^>]*>/gi, "\n\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return tekst.length >= 60 ? tekst : undefined;
}

function webNaamUit(item: FeedItem): string | undefined {
  // Een pijp betekent dat er een kassaregel in het webnaamveld is geplakt:
  // "BL Ventura Satin | W05 1L". Links staat de naam, rechts de administratie.
  const naam = (item.webnaam ?? "").split("|")[0].trim().replace(/\s+/g, " ");
  return naam.length > 3 ? naam : undefined;
}

function buildProduct(
  group: FeedItem[],
  witIndex: Map<string, FeedItem> = new Map(),
): Product | null {
  const leader = group.find((item) => item.group_leader === "true") ?? group[0];
  if (!leader?.title) return null;

  // Op maat sorteren, van klein naar groot. Zonder dit staan 20, 120, 40 en
  // 180 mm door elkaar in de keuzelijst, wat er slordig uitziet en waarin de
  // klant zijn maat niet terugvindt. Bij gelijke maat het kleinste
  // verpakkingsaantal eerst.
  const sorted = [...group].sort((a, b) => {
    const verschil = maatWaarde(a) - maatWaarde(b);
    if (verschil !== 0) return verschil;
    return aantalUit(a.title) - aantalUit(b.title);
  });

  const variants: ProductVariant[] = sorted
    // Alleen echte maten. Tilroy zet bij artikelen zonder maat "1SIZE" of een
    // streepje neer; die kwamen als keuzeknop op de pagina en daarna in de
    // winkelwagen te staan — een regel met een kaal "–" eronder, waar de klant
    // niets van begrijpt. Blijft er zo niets over, dan valt de prijs terug op
    // die van het hoofdartikel.
    .filter((item) => heeftEchteMaat(item.maat))
    .map((item) => {
      const base = parseBase(item.mengbasis);
      // Staat dezelfde maat er meerdere keren in, dan verschillen die
      // artikelen op iets anders — meestal het aantal per verpakking. Dat
      // zetten we erbij, anders staan er twee identieke keuzes.
      const meerdereVerpakkingen =
        group.filter((ander) => ander.maat === item.maat).length > 1;
      const verpakking = meerdereVerpakkingen ? verpakkingUit(item.title) : undefined;
      const afhalen = bezorgbaarheid(teBezorgen(item));
      const eigen = prijzenVan(item);
      const eigenPrijs = eigen.prijs;
      // Fabriekswit bij deze maat, als dat er is (alleen Sikkens-mengverf).
      const witItem =
        (item.mengverf ?? "").trim() === "Ja"
          ? witIndex.get(witSleutel(item.title ?? "", item.maat))
          : undefined;
      const wit_ = witItem ? prijzenVan(witItem) : null;
      const witPrijs = wit_ ? wit_.prijs : 0;
      return {
        id: item.id,
        name: verpakking ? `${item.maat}, ${verpakking}` : item.maat,
        price: eigenPrijs,
        ...(eigen.vanaf > eigenPrijs ? { compareAtPrice: eigen.vanaf } : {}),
        ...(eigen.kluspas ? { kluspasPrice: eigen.kluspas } : {}),
        ...(eigen.actie ? { actie: true } : {}),
        sku: item.id,
        size: item.maat,
        // Voorraad per maat: 250 ml kan uitverkocht zijn terwijl 2,5 L er
        // staat. Zonder dit gold de voorraad van het product als geheel en
        // kon de klant een maat in de wagen leggen die nergens ligt.
        inStock:
          Number(item.voorraad ?? 0) > 0 ||
          (item.availability ?? "").trim() === "in stock",
        ...(verpakking ? { packaging: verpakking } : {}),
        ...(base ? { base } : {}),
        ...(afhalen.reden ? { pickupOnly: afhalen.reden } : {}),
        ...(witItem && witPrijs > 0
          ? {
              wit: {
                sku: witItem.id!,
                price: witPrijs,
                ...(wit_ && wit_.vanaf > witPrijs ? { compareAtPrice: wit_.vanaf } : {}),
                ...(wit_?.kluspas ? { kluspasPrice: wit_.kluspas } : {}),
                inStock:
                  Number(witItem.voorraad ?? 0) > 0 ||
                  (witItem.availability ?? "").trim() === "in stock",
              },
            }
          : {}),
      };
    });

  // Alleen als élke maat afvalt is het hele product niet te bezorgen; anders
  // hangt het aan de maat die de klant kiest.
  const afhaalRedenen = group.map((item) => bezorgbaarheid(teBezorgen(item)).reden);
  const pickupOnly = afhaalRedenen.every(Boolean) ? afhaalRedenen[0] : undefined;

  // Zonder maatvarianten telt de groepsleider zelf; ook daar moet een lopende
  // actie de prijs zijn en niet een voetnoot.
  const leiderPrijzen = prijzenVan(leader);
  const prices = (variants.length > 0 ? variants.map((v) => v.price) : [leiderPrijzen.prijs])
    .filter((price) => price > 0);
  if (prices.length === 0) return null;
  const price = Math.min(...prices);

  // De "vanaf"-prijs is die van de goedkoopste maat, dus de adviesprijs en de
  // Kluspas-prijs ernaast moeten van diezelfde maat komen. Namen we die van de
  // groepsleider — een willekeurige maat na het samenvoegen — dan stond er bij
  // Rubbol SB "vanaf € 44,84" met de adviesprijs van het blik van 2,5 liter
  // erachter, en verdween de Kluspas-prijs helemaal omdat € 170,42 niet
  // lager is dan € 44,84.
  const vanafVariant = variants.find((variant) => variant.price === price);
  const compareAtPrice = vanafVariant?.compareAtPrice ?? leiderPrijzen.vanaf;
  // Kluspas-prijs zoals `prijzenVan` hem heeft vastgesteld: 0 zodra er een
  // actie loopt, want die geldt voor iedereen en is dus geen pasvoordeel.
  const eigenKluspas = vanafVariant ? (vanafVariant.kluspasPrice ?? 0) : leiderPrijzen.kluspas;
  // Onwaarschijnlijke kortingen (zie lib/kluspas.ts) laten we hier al vallen,
  // zodat ze nergens in de site meer opduiken.
  const kluspasPrice = isGeloofwaardigeKluspasPrijs(price, eigenKluspas) ? eigenKluspas : 0;
  // Loopt er op de goedkoopste maat een actie? Dan mag er nergens nog een
  // korting bovenop — ook de Profpas-10% niet, want die rekenen wij zélf uit
  // en zou dus stapelen op een korting die de kassa al gegeven heeft.
  const inActie = vanafVariant ? Boolean(vanafVariant.actie) : leiderPrijzen.actie;

  const groupId = (leader.group_id ?? leader.id).replace(/^g:/, "");
  const inStock = group.some((item) => Number(item.voorraad ?? 0) > 0);

  // Mengverf-familie: de basissen zijn samengevoegd, dus de titel van één
  // basis-artikel ("… Lichte basis") klopt niet meer als productnaam.
  const isBaseFamily = variants.some((variant) => variant.base);
  const name = schoneNaam(
    isBaseFamily
    ? // De groepen lopen per glansgraad en drager uiteen, maar de productlijn
      // noemt die niet: dan staan Mat, Zijdeglans en Hoogglans — en alkyd
      // naast acryl — als regels met exact dezelfde naam en verschillende
      // prijzen in de lijst.
      metGlans(
        metDrager(
          // Zonder basiscode: welke basis het wordt bepalen wij op de kleur,
          // dus "Drenth Grondlak D" hoort gewoon "Drenth Grondlak" te heten.
          leader.productlijn ? lijnZonderBasis(leader.productlijn) : leader.title,
          leader.title ?? "",
        ),
        glansVan(leader),
      )
    : // Zijn er meerdere maten samengevoegd, dan mag de maat van de eerste
      // niet in de naam blijven staan: "Mack Houtbout M8 x 80 mm" met daaronder
      // ook 90, 100 en 120 leest als een fout.
      group.length > 1 && heeftEchteMaat(leader.maat)
      ? naamZonderMaat(leader.title, group)
      : zonderMaatEcho(leader.title, leader.maat),
  );

  // De commerciële webnaam uit Tilroy wint van wat wij zelf afleiden; die is
  // daar al met de hand opgeschoond. De slug verandert dan mee — de
  // productpagina vangt oude slugs op via het groepsnummer aan het eind.
  const webNaam = webNaamUit(leader);
  const ruweNaam = webNaam ? schoneNaam(metGlans(webNaam, glansVan(leader))) : name;
  // Ook de webnaam bevat de mengbasis: "Histor Perfect Finish Acryl
  // Zijdeglans Basis ZN 1L". De basis kiezen wij op de kleur, dus in de
  // naam hoort hij niet.
  const basisNaam = isBaseFamily ? zonderMengbasis(ruweNaam) : ruweNaam;
  // Heeft een artikel maar één maat, dan is er geen maatkiezer en zegt de
  // pagina nergens hoeveel je koopt: "Glitsa vloerlak — € 84,85" kan net zo
  // goed een literblik als een emmer zijn. Bij meerdere maten hoort de maat
  // er juist níét in; die kiest de klant zelf.
  const definitieveNaam = metEnigeMaat(basisNaam, variants);
  const webTekst = webTekstUit(leader);

  return {
    id: groupId,
    slug: `${slugify(definitieveNaam)}-${groupId}`,
    name: definitieveNaam,
    // De uitsluiting hierboven kijkt naar het merk uit de feed, niet naar deze
    // weergavenaam; een artikel zonder merk wordt dus niet per ongeluk verborgen.
    // "No brand", "Overige" en "Essentieel overige" zijn geen merken maar
    // vakjes in de kassa. Ze stonden in kapitalen boven de productnaam op de
    // kaart — "NO BRAND" leest als een merk dat niemand kent. De filterkolom
    // liet ze al weg; hier ontbrak diezelfde controle.
    brand: isEchtMerk(leader.brand) ? leader.brand! : "De Voordeelmarkt",
    sku: leader.id,
    category: categorySlugFor(leader),
    shortDescription: isBaseFamily
      ? `${definitieveNaam} in elke gewenste kleur, wij mengen gratis in de juiste basis.`
      : // De eerste zin van de handgeschreven webtekst zegt wat het artikel
        // ís. Het regeltje dat de kassa zelf maakt plakt merk, productlijn en
        // ondergrond aan elkaar, en dat gaat mis zodra een van die velden
        // niet klopt: "No brand Sanicur hand, voor hout" onder een flesje
        // handgel. Eigen tekst gaat dus voor.
        eersteZin(webTekst) ??
        (leader.description && leader.description !== name
          ? leader.description
          : `${definitieveNaam}, voordelig online bestellen bij De Voordeelmarkt.`),
    // De handgeschreven webtekst uit Tilroy gaat vóór alles wat wij afleiden
    // of laten genereren; zie webTekstUit().
    description:
      webTekst ??
      ([leader.description, leader.toepassing, leader.ondergrond]
        .filter(Boolean)
        .join(" ") ||
        definitieveNaam),
    ...(webTekst ? { heeftEigenTekst: true } : {}),
    price,
    compareAtPrice: compareAtPrice > price ? compareAtPrice : undefined,
    kluspasPrice: kluspasPrice > 0 ? kluspasPrice : undefined,
    actie: inActie || undefined,
    unit: leader.maat_range || leader.maat || undefined,
    colorMixable: leader.mengverf === "Ja",
    variants: variants.length > 1 ? variants : undefined,
    specs: buildSpecs(leader, sorted),
    attributes: buildAttributes(leader, group),
    tags: (leader.zoektermen ?? "").split(/\s+/).filter(Boolean).slice(0, 24),
    // Pak de eerste variant die wél een foto heeft. Bij samengevoegde maten
    // is de "leider" willekeurig de eerste uit de feed; heeft juist die geen
    // foto, dan zou het hele product er geen tonen terwijl de andere maten
    // van hetzelfde artikel er een hebben.
    image: fotoUrl(
      leader.image_link || group.find((item) => item.image_link)?.image_link,
    ),
    inStock,
    ...(pickupOnly ? { pickupOnly } : {}),
    // Elke variant heeft een eigen URL op de huidige site; die moeten
    // straks allemaal naar deze pagina wijzen.
    legacyPaths: [
      ...new Set(
        group
          .map((item) => legacyPathFrom(item.link))
          .filter((path): path is string => Boolean(path)),
      ),
    ],
    art: { icon: leader.mengverf === "Ja" ? "palette" : "bucket", hue: 25 },
  };
}

/* ── Publieke API ──────────────────────────────────────────────── */

let cache: { at: number; products: Product[] } | null = null;
let inflight: Promise<Product[]> | null = null;

/**
 * Haal de feed op, met geduld bij tijdelijke blokkades.
 *
 * De feed is ~7 MB en doet er seconden over. Tijdens een build draaien er
 * meerdere workers naast elkaar, en Vercel's bot-mitigatie beantwoordt zulke
 * herhaalde zware verzoeken soms met een 403. Dat is tijdelijk, dus we wachten
 * even en proberen het opnieuw in plaats van meteen op de demo-catalogus terug
 * te vallen.
 */
async function fetchFeedResponse(attempt = 0): Promise<Response> {
  // LET OP: geen `cache: "no-store"` hier. Dat maakt elke pagina die de
  // catalogus gebruikt dynamisch, terwijl die statisch (ISR) is gedeclareerd —
  // Next gooit dan "Page changed from static to dynamic at runtime" en de
  // pagina geeft een 500. Het echte cachen doet Redis.
  const res = await fetch(FEED_URL, {
    signal: AbortSignal.timeout(feedGeduldMs()),
    next: { revalidate: 3600 },
  });
  // In een build is er geen tijd om te wachten en opnieuw te proberen; buiten
  // een build wel, want dan houdt hooguit één bezoeker het even voor gezien.
  const maxPogingen = inBuild() ? 0 : 3;
  const retriable = res.status === 403 || res.status === 429 || res.status >= 500;
  if (retriable && attempt < maxPogingen) {
    const wachttijd = 2000 * 2 ** attempt + Math.floor(Math.random() * 500);
    console.warn(
      `[catalogus] feed gaf ${res.status}; opnieuw proberen over ${Math.round(wachttijd / 1000)}s.`,
    );
    await new Promise((resolve) => setTimeout(resolve, wachttijd));
    return fetchFeedResponse(attempt + 1);
  }
  return res;
}

interface JsonFeedPage {
  total?: number;
  items?: Record<string, unknown>[];
  next?: string | null;
}

/**
 * Haal de catalogus op via de gepagineerde JSON-feed. Dat is de voorkeursweg:
 * kleine pagina's in plaats van één verzoek van ruim 6 MB, waar de
 * bot-mitigatie van het platform op aanslaat tijdens builds.
 *
 * `null` als het endpoint (nog) niet bestaat — dan gebruiken we de XML-feed.
 */
async function fetchJsonFeed(): Promise<FeedItem[] | null> {
  const items: FeedItem[] = [];
  let url: string | null = `${FEED_JSON_URL}?limit=${PAGE_SIZE}&offset=0`;
  let pagina = 0;

  // Ook de optelsom bewaken: veertien pagina's van elk twaalf seconden past
  // niet in het bouwbudget van zestig. Loopt het uit, dan stoppen we en laat
  // de opgeslagen catalogus de build gewoon slagen.
  const uiterlijkKlaar = Date.now() + (inBuild() ? 25_000 : 5 * 60_000);

  while (url && pagina < 40) {
    if (Date.now() > uiterlijkKlaar) {
      console.warn("[catalogus] feed duurt te lang voor deze build; opgeslagen versie blijft staan.");
      return null;
    }
    const res: Response = await fetch(url, {
      signal: AbortSignal.timeout(feedGeduldMs()),
      next: { revalidate: 3600 },
    });
    if (res.status === 404) return null; // endpoint bestaat nog niet
    if (!res.ok) throw new Error(`Productfeed (JSON) gaf status ${res.status}`);

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) return null; // krijgt XML terug

    const page = (await res.json()) as JsonFeedPage;
    if (!Array.isArray(page.items)) return null;

    for (const item of page.items) {
      // De JSON-variant levert arrays waar de XML een veld herhaalt; die
      // platten we tot dezelfde tekstvorm, zodat de rest van de parser
      // ongewijzigd blijft werken.
      const fields: FeedItem = {};
      for (const [key, value] of Object.entries(item)) {
        if (value == null) continue;
        fields[key] = Array.isArray(value) ? value.join("|") : String(value);
      }
      if (fields.title) fields.title = zonderPartijhandel(fields.title);
      if (fields.id) items.push(fields);
    }

    url = page.next ?? null;
    pagina++;
  }

  return items.length > 0 ? items : null;
}

/**
 * Welke feed de laatst geladen catalogus opleverde.
 *
 * De terugval van JSON naar XML is stil — dat is met opzet, want de winkel
 * moet doordraaien. Maar dan moet je wel ergens kunnen zien welke bron actief
 * is, anders draai je maanden op de terugval zonder het te merken. Zie
 * /api/health.
 */
let laatsteBron: "json" | "xml" | "onbekend" = "onbekend";

export function catalogusBron(): "json" | "xml" | "onbekend" {
  return laatsteBron;
}

/**
 * Dezelfde rubriek, één schrijfwijze.
 *
 * De kassa kent "Schildersger. en Schuurpapier" (497×), "Schildersger. en
 * schuurpapier" (80×) en "SCHILDERSGER. EN SCHUURPAPIER" (5×) als drie losse
 * waarden. Alles wat op die naam groepeert — het uitklapmenu, de filters op de
 * categoriepagina, de tellingen — zag daardoor drie rubrieken naast elkaar,
 * met de artikelen verdeeld over alle drie. Vijf subrubrieken en vier
 * hoofdrubrieken hebben dit; bij "Lijmen en kitten" is de grootste variant
 * zelfs de geschreeuwde.
 *
 * Een variant in kapitalen verliest altijd, ook als hij het vaakst voorkomt:
 * "LIJMEN, KITTEN EN VULMIDDELEN" is met 136 regels de grootste, maar
 * schreeuwen in een menu is geen keuze die iemand bewust heeft gemaakt.
 * Daarbinnen wint de meest voorkomende schrijfwijze. Bestaat een rubriek
 * alléén in kapitalen, dan maken we er een gewone zin van. We schrijven de
 * gekozen vorm terug op de feedregels, zodat alles er verderop mee klopt.
 */
function gelijkTrekkenRubrieknamen(items: FeedItem[]): void {
  const velden = ["categorie_hoofd", "categorie_sub"] as const;
  for (const veld of velden) {
    const tellingen = new Map<string, Map<string, number>>();
    for (const item of items) {
      const waarde = (item[veld] ?? "").trim();
      if (!waarde) continue;
      const sleutel = waarde.toLocaleLowerCase("nl");
      const varianten = tellingen.get(sleutel) ?? new Map<string, number>();
      varianten.set(waarde, (varianten.get(waarde) ?? 0) + 1);
      tellingen.set(sleutel, varianten);
    }

    const winnaars = new Map<string, string>();
    for (const [sleutel, varianten] of tellingen) {
      const alle = [...varianten.entries()].sort((a, b) => b[1] - a[1]);
      const gewoon = alle.filter(([naam]) => !schreeuwt(naam));
      const beste = gewoon[0]?.[0] ?? zonderKapitalen(alle[0][0]);
      if (varianten.size > 1 || beste !== alle[0][0]) winnaars.set(sleutel, beste);
    }
    if (winnaars.size === 0) continue;

    for (const item of items) {
      const waarde = (item[veld] ?? "").trim();
      if (!waarde) continue;
      const winnaar = winnaars.get(waarde.toLocaleLowerCase("nl"));
      if (winnaar && winnaar !== waarde) item[veld] = winnaar;
    }
  }
}

/** Staat er geen enkele kleine letter in? Dan is het geroep. */
function schreeuwt(naam: string): boolean {
  return /\p{Lu}/u.test(naam) && naam === naam.toLocaleUpperCase("nl");
}

/**
 * "LIJMEN, KITTEN EN VULMIDDELEN" → "Lijmen, kitten en vulmiddelen".
 *
 * Als zin, niet als titel: in het Nederlands krijgen alleen het eerste woord
 * en namen een hoofdletter, en "Lijmen, Kitten En Vulmiddelen" leest Engels.
 */
function zonderKapitalen(naam: string): string {
  const klein = naam.toLocaleLowerCase("nl");
  return klein.charAt(0).toLocaleUpperCase("nl") + klein.slice(1);
}

/**
 * Tijdens een build mag de catalogus nooit de deploy gijzelen.
 *
 * Next geeft elke build-worker 60 seconden om de paginagegevens te
 * verzamelen. Ligt de feed eruit — zoals op 3 augustus 2026, toen het
 * dashboard 60 seconden lang 504's gaf — dan wacht elke worker eerst 45
 * seconden op JSON, valt daarna terug op XML, en dan is de tijd op: de hele
 * deploy faalt, ook al gaat de wijziging nergens over de catalogus. Binnen
 * een build knippen we die poging daarom eerder af; de site draait dan op de
 * opgeslagen catalogus en de eerste bezoeker na de deploy haalt hem alsnog op.
 */
function inBuild(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

/** Hoe lang één feedverzoek mag duren. */
function feedGeduldMs(): number {
  return inBuild() ? 12_000 : 45_000;
}

async function fetchFeed(): Promise<Product[]> {
  const viaJson = await fetchJsonFeed().catch((error) => {
    console.error("[catalogus] JSON-feed mislukt, val terug op XML:", error);
    return null;
  });

  let items: FeedItem[];
  if (viaJson) {
    items = viaJson;
    laatsteBron = "json";
  } else {
    const res = await fetchFeedResponse();
    if (!res.ok) throw new Error(`Productfeed gaf status ${res.status}`);
    items = parseItems(await res.text());
    laatsteBron = "xml";
  }

  // Eén schrijfwijze per rubriek, vóór al het andere.
  gelijkTrekkenRubrieknamen(items);

  // Fabriekswit aan de mengbare broer hangen vóór het groeperen; de
  // gekoppelde wit-artikelen worden zelf geen product meer.
  const wit = koppelWitArtikelen(items);

  const groups = new Map<string, FeedItem[]>();
  for (const item of items) {
    if (!hoortOnline(item)) continue;
    if (item.id && wit.gekoppeld.has(item.id)) continue;
    const key = groupKeyFor(item);
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }

  const products: Product[] = [];
  const seenSlugs = new Set<string>();
  for (const group of groups.values()) {
    const product = buildProduct(group, wit.index);
    if (!product || seenSlugs.has(product.slug)) continue;
    seenSlugs.add(product.slug);
    products.push(product);
  }
  return products;
}

/**
 * LET OP: hoog het versienummer op zodra het Product-schema verandert (nieuw
 * veld, andere groepering). De opgeslagen catalogus blijft anders 24 uur
 * staan en mist dan het nieuwe veld — dat kostte de Kluspas-prijs een deploy.
 */
// v53: `prijzenVan` erbij (promo_prijs/promo_van/promo_tot + veld `actie`).
// Elke wijziging in het parsen hoort een nieuwe sleutel te krijgen, anders
// blijft de oude vorm een uur lang uit de cache komen en lijkt de wijziging
// niet te werken.
// v54: enkel om de cache van vóór de eerste promosync weg te gooien. De
// promovelden landden om 20:20 in de feed, maar onze kopie was daarvóór
// gebouwd — de winkel toonde toen een uur lang € 17,60 waar de kassa € 14,08
// rekende. Zie ook /api/catalogus/ververs, zodat dit niet nog eens een deploy
// hoeft te kosten.
export const KV_KEY = "catalog:products:v54";
/**
 * De catalogus blijft een dag houdbaar, maar wordt na een uur ververst. Zo
 * draait de winkel gewoon door als de feed even niet bereikbaar is (storing,
 * rate limit, deploy van het dashboard) in plaats van terug te vallen op de
 * schrale demo-catalogus.
 */
const KV_TTL_SECONDS = 24 * 3600;
const KV_FRESH_MS = 60 * 60 * 1000;

interface CachedCatalog {
  at: number;
  /** Welke feed deze catalogus opleverde; nodig voor de diagnose. */
  bron?: "json" | "xml";
  products: Product[];
}

async function readFromKv(): Promise<CachedCatalog | null> {
  if (!isKvEnabled()) return null;
  try {
    const raw = await kvGetRaw(KV_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCatalog;
    return Array.isArray(parsed?.products) && parsed.products.length > 0 ? parsed : null;
  } catch (error) {
    console.error("[catalogus] uit KV lezen mislukt:", error);
    return null;
  }
}

async function writeToKv(products: Product[]): Promise<void> {
  if (!isKvEnabled() || products.length === 0) return;
  try {
    const payload: CachedCatalog = {
      at: Date.now(),
      bron: laatsteBron === "onbekend" ? undefined : laatsteBron,
      products,
    };
    await kvSetEx(KV_KEY, JSON.stringify(payload), KV_TTL_SECONDS);
  } catch (error) {
    console.error("[catalogus] naar KV schrijven mislukt:", error);
  }
}

/**
 * Alle producten. Volgorde: geheugen → Redis → feed.
 *
 * Is de opgeslagen catalogus ouder dan een uur, dan halen we de feed opnieuw
 * op; mislukt dat, dan blijven we die oudere versie gebruiken. Alleen als er
 * helemaal niets is, krijgt de aanroeper een lege lijst (en valt die terug op
 * de demo-catalogus).
 */
export async function loadFeedProducts(): Promise<Product[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.products;
  if (inflight) return inflight;

  inflight = (async () => {
    const stored = await readFromKv();
    if (stored && Date.now() - stored.at < KV_FRESH_MS) {
      cache = { at: Date.now(), products: stored.products };
      // Elke serverless functie is een eigen proces: deze haalt de feed nooit
      // zelf op, dus zonder de bron uit de cache zou de diagnose altijd
      // "onbekend" melden en niets zeggen.
      if (stored.bron) laatsteBron = stored.bron;
      return stored.products;
    }

    try {
      const products = await fetchFeed();
      cache = { at: Date.now(), products };
      await writeToKv(products);
      return products;
    } catch (error) {
      console.error("[catalogus] productfeed niet beschikbaar:", error);
      if (stored) {
        const uren = Math.round((Date.now() - stored.at) / 3_600_000);
        console.warn(`[catalogus] terugval op opgeslagen catalogus (${uren} uur oud).`);
        cache = { at: Date.now() - CACHE_MS / 2, products: stored.products };
        if (stored.bron) laatsteBron = stored.bron;
        return stored.products;
      }
      return cache?.products ?? [];
    }
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}
