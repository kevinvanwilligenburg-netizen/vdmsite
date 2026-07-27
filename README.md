# De Voordeelmarkt – webshop

Webshop voor **devoordeelmarkt.nl**: online bestellen, veilig betalen via
Mollie en gratis afhalen in de winkel. Gebouwd met **Next.js 14 (App Router)**,
TypeScript en Tailwind CSS, in de huisstijl van De Voordeelmarkt (oranje/zwart,
Mulish, "De beste verf voor de laagste prijs").

## Features

- 🛒 **Webshop** – homepage met topdeals, categoriepagina's, productpagina's
  met varianten, winkelwagen en checkout.
- 🎨 **Kleurkiezer** – 140+ RAL-kleuren met zoeken en filteren. De gekozen
  kleur reist mee van productpagina tot in de bestelling en het kassasysteem.
- 💳 **Mollie-betalingen** – iDEAL, Bancontact, creditcard en Apple Pay via de
  Mollie hosted checkout. Zonder API-sleutel draait de site in **demomodus**
  met een gesimuleerde betaalpagina, zodat de hele flow lokaal testbaar is.
- 🏬 **Afhalen in de winkel** – winkelkeuze in de checkout (Nijverdal,
  Apeldoorn, Deventer, Zutphen, Emmen), afhaalcode na betaling en een
  bestelstatuspagina die live bijwerkt.
- 🔗 **Tilroy-koppeling** – producten, winkels en voorraad uit de Tilroy API;
  betaalde bestellingen worden als afhaalorder naar Tilroy gepusht zodat de
  winkel ze in de kassa ziet. Zonder sleutel is er een demo-catalogus.
- 📊 **VDM-dashboard-koppeling** – orders in KV volgens hetzelfde contract als
  de Klus=r-site (dashboard leest ze automatisch mee) en banners/pagina's die
  in het dashboard worden beheerd.
- 🔍 **SEO** – sitemap.xml, robots.txt, canonicals, Open Graph en JSON-LD
  (Organization, WebSite met SearchAction, Product, BreadcrumbList,
  HardwareStore per vestiging).

## Snel starten

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Zonder `.env` draait alles in demomodus:
demo-catalogus, orders lokaal in `.data/orders/` en een gesimuleerde
betaalomgeving.

## Configuratie

Kopieer `.env.example` naar `.env.local`:

| Variabele | Uitleg |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Publieke URL (SEO, sitemap, betaal-redirects). |
| `MOLLIE_API_KEY` | `test_…` of `live_…`. Leeg = demo-betaalpagina. `test_…` markeert orders als `isTest`. |
| `TILROY_API_KEY` (+ endpoints) | Tilroy-koppeling. Leeg = demo-catalogus. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Upstash/Vercel KV voor orders + dashboard-content. Leeg = lokale bestandsopslag. |

## Koppeling met het VDM-dashboard

De site gebruikt **dezelfde KV-conventies als de Klus=r-site**, zodat het
dashboard (repo `dashboardvdm`) beide shops op één manier uitleest.

**Orders (site schrijft, dashboard leest):**

| Key | Inhoud |
| --- | --- |
| `order:<id>` | Order-JSON (`id`, `reference` "VDM-123456", `createdAt`, `paymentStatus`, `customer` {firstName, lastName, email, …}, `items` [{title, quantity, price, variantLabel}], `subtotal`, `shipping`, `total`, `paymentMethod`, `isTest`, `channel`, + VDM-extra's zoals `store`, `pickupCode`, `fulfilment:"pickup"`) |
| `order:index` | SET met alle order-ids |
| `orderref:<REFERENCE>` | order-id (lookup op referentie) |
| `ordermollie:<paymentId>` | order-id (lookup vanuit de webhook) |
| `orders:email:<email>` | SET met order-ids per klant |

Bedragen zijn **euro's** (decimaal, bv. `24.95`) — géén centen. Demo- en
Mollie-testbetalingen krijgen `isTest: true` en tellen in het dashboard niet
mee. Activeren: zet de `KV_REST_API_URL`/`KV_REST_API_TOKEN` van dít project
óók in het dashboard-Vercel-project als `VDMSITE_KV_REST_API_URL` /
`VDMSITE_KV_REST_API_TOKEN`.

**Content (dashboard schrijft, site leest — beheer gebeurt in het dashboard):**

| Key | Inhoud |
| --- | --- |
| `content:banner:home-hero` | Homepage-banner: `{ title, subtitle?, badge?, ctaLabel?, ctaHref?, imageUrl? }` — vervangt de ingebouwde herotekst (homepage herleest elke 5 min). |
| `page:<slug>` | Info-pagina: `{ title, description?, body, published?, updatedAt? }` — live op `/info/<slug>`. In `body`: lege regel = alinea, `## ` = tussenkop. |
| `page:index` | SET met alle pagina-slugs (voor sitemap en overzichten). |

Zonder KV vallen banners terug op de ingebouwde teksten en bestaan er geen
info-pagina's; de site blijft gewoon werken.

## Bestelflow

1. Klant vult winkelwagen (kleurkeuze wordt per artikel bewaard).
2. `/afrekenen` → voornaam, achternaam, e-mail, telefoon en afhaalwinkel →
   `POST /api/checkout`.
3. Server valideert artikelen, **herberekent alle prijzen server-side**, maakt
   de bestelling aan (`ord_…` + referentie `VDM-123456` + afhaalcode) en start
   de betaling.
4. Klant betaalt bij Mollie (of op de demo-betaalpagina).
5. Webhook of lazy sync zet `paymentStatus` op **paid** en pusht de order als
   afhaalorder naar Tilroy.
6. `/bestelling/[reference]` toont de afhaalcode, de winkel en de status.

### Tilroy-mapping

De hele koppeling zit in [`src/lib/tilroy.ts`](src/lib/tilroy.ts): pas
`mapTilroyProduct`, `mapTilroyShop` en de payload in `pushOrderToTilroy` aan
op het antwoord van jouw Tilroy-omgeving. Elke functie valt automatisch terug
op de demodata als de API niet bereikbaar is.

### Mollie

De betaallaag ([`src/lib/mollie.ts`](src/lib/mollie.ts)) praat rechtstreeks
met de Mollie REST API v2. De webhook (`/api/webhooks/mollie`) werkt alleen op
een publiek bereikbare URL; op localhost synchroniseert de bestelpagina de
betaalstatus zelf bij Mollie (lazy sync).

## Naar productie

- **KV aanzetten** – maak in Vercel een KV/Upstash-store; orders zijn dan
  persistent én zichtbaar in het dashboard.
- **E-mail** – verstuur bevestiging + "ligt klaar"-bericht (bv. Resend) vanuit
  `applyPaymentResult` in `src/lib/orders.ts`.
- **Status "klaar om af te halen"** – zet `readyForPickupAt` /
  `paymentStatus:"delivered"` vanuit Tilroy of het dashboard.
- **Winkeldata** – adressen/openingstijden staan in
  [`src/lib/stores.ts`](src/lib/stores.ts) (overgenomen van devoordeelmarkt.nl)
  of komen volledig uit de Tilroy shops-API.

## Scripts

| Commando | Doel |
| --- | --- |
| `npm run dev` | Ontwikkelserver |
| `npm run build` | Productie-build (type-check + prerender) |
| `npm run start` | Productie-server |
