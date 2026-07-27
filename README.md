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
- 🚚 **Bezorgen op basis van voorraad** – ligt het artikel in Nijverdal (de
  webshopvoorraad), dan gaat het met DHL: vóór 10:00 besteld is vandaag
  bezorgd, daarna morgen. Ligt het alleen in een andere winkel, dan verstuurt
  die winkel het met PostNL binnen één werkdag. Zie
  [`src/lib/delivery.ts`](src/lib/delivery.ts) (puur en testbaar). Labels en
  track & trace komen centraal uit het dashboard.
- 🏬 **Afhalen binnen 2 uur, gratis** – kan alleen in een winkel die álle
  artikelen op voorraad heeft; de checkout toont dat per winkel en de server
  weigert een afhaalorder die niet klopt. De belofte houdt rekening met
  openingstijden ([`src/lib/pickup.ts`](src/lib/pickup.ts)): buiten
  openingstijd schuift hij naar het eerstvolgende moment dat de winkel open is.
- 📍 **Favoriete winkel** – klanten kiezen hun vaste winkel in de header. Die
  keuze stuurt de voorraadweergave, de afhaalbelofte en de voorselectie bij het
  afrekenen, en wordt lokaal onthouden.
- 📦 **Gedeelde voorraad** – live voorraad per vestiging via de voorraad-hub
  van het VDM-dashboard (`/api/voorraad/skus`), die op de échte Tilroy Stock
  API draait. Beide shops putten zo uit dezelfde voorraad.
- ⭐ **Trustpilot** – TrustBox-widgets op homepage, footer en checkout. Met een
  API-sleutel komt het échte gemiddelde als `aggregateRating` in de structured
  data; zonder sleutel bewust geen rating (verzonnen sterren zijn in strijd met
  de richtlijnen van Google).
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
| `DASHBOARD_API_URL` | Basis-URL van het VDM-dashboard (catalogus, kleuren, voorraad). Standaard `https://dashboardvdm.vercel.app`. |
| `REDIS_URL` | Redis via TCP (Vercel Marketplace → Redis). Voor orders, content en de catalogus-cache. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Alternatief: Upstash/Vercel KV via REST. Leeg = lokale bestandsopslag. |
| `NEXT_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID` | Zet de reviewwidgets aan. Leeg = geen widgets. |
| `TRUSTPILOT_API_KEY` | Optioneel: haalt het echte gemiddelde op voor de structured data. |

## Koppeling met het VDM-dashboard

De site gebruikt **dezelfde KV-conventies als de Klus=r-site**, zodat het
dashboard (repo `dashboardvdm`) beide shops op één manier uitleest.

**Orders (site schrijft, dashboard leest):**

| Key | Inhoud |
| --- | --- |
| `order:<id>` | Order-JSON (`id`, `reference` "VDM-123456", `createdAt`, `paymentStatus`, `molliePaymentId`, `customer` {firstName, lastName, email, street, houseNumber, houseNumberSuffix, postalCode, city, country, …}, `items` [{**sku**, ean?, title, quantity, price, variantLabel}], `subtotal`, `shipping`, `total`, `paymentMethod`, `isTest`, `channel`, + VDM-extra's zoals `fulfilment` "pickup"/"delivery", `store`, `pickupCode`, `delivery`) |
| `order:index` | SET met alle order-ids |
| `orderref:<REFERENCE>` | order-id (lookup op referentie) |
| `ordermollie:<paymentId>` | order-id (lookup vanuit de webhook) |
| `orders:email:<email>` | SET met order-ids per klant |

Bedragen zijn **euro's** (decimaal, bv. `24.95`) — géén centen. Demo- en
Mollie-testbetalingen krijgen `isTest: true` en tellen in het dashboard niet
mee. Drie velden zijn er speciaal voor de geplande route *webshop-order →
Tilroy Order API* (voorraad afboeken in de bron): per regel de **`sku`**
(Tilroy-artikel-id/sourceId, bij varianten de variant-sku) en `ean` zodra
bekend, het **gesplitste bezorgadres** (straat, huisnummer en toevoeging
apart) en **`molliePaymentId`** (gaat mee als `mollieReference`). Activeren:
zet de `KV_REST_API_URL`/`KV_REST_API_TOKEN` van dít project óók in het
dashboard-Vercel-project als `VDMSITE_KV_REST_API_URL` /
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
2. `/afrekenen` → keuze **bezorgen** (DHL, adres) of **afhalen** (winkel) +
   naam/e-mail/telefoon → `POST /api/checkout`.
3. Server valideert artikelen, **herberekent alle prijzen server-side**, maakt
   de bestelling aan (`ord_…` + referentie `VDM-123456`; bij afhalen een
   afhaalcode, bij bezorgen de bezorgbelofte) en start de betaling.
4. Klant betaalt bij Mollie (of op de demo-betaalpagina).
5. Webhook of lazy sync zet `paymentStatus` op **paid**. De order staat in KV;
   het dashboard verzorgt centraal de fulfilment (kassa, DHL-label, track &
   trace via `shipment.trackTrace`).
6. `/bestelling/[reference]` toont status, afhaalcode óf bezorginfo.

### Bezorgen en afhalen

Beide modules zijn puur en deterministisch testbaar (geef `now` mee):

- [`src/lib/delivery.ts`](src/lib/delivery.ts) — `deliveryPromise({webshopQty,
  otherStoresQty})` geeft `same-day` / `next-day` (DHL, uit Nijverdal),
  `next-workday` (PostNL, uit een andere winkel) of `unavailable`. Bij een
  bestelling telt de traagste regel.
- [`src/lib/pickup.ts`](src/lib/pickup.ts) — `pickupPromise(store)` rekent met
  de openingstijden: open én nog ≥2 uur tot sluitingstijd betekent vandaag
  klaar met een concreet tijdstip, anders het eerstvolgende openingsmoment.

Afhaalorders worden server-side gevalideerd in
[`/api/checkout`](src/app/api/checkout/route.ts): ligt niet alles in de
gekozen winkel, dan volgt een 409 met de winkels waar het wél ligt. Valt de
voorraad-API uit, dan blokkeren we bewust níét — anders houdt één storing alle
afhaalbestellingen tegen.

Zon- en feestdagen: PostNL-leveringen slaan de zondag over; verdere
feestdagregels zijn nog niet gespecificeerd (TODO zodra bekend).

### Voorraad

[`src/lib/tilroy.ts`](src/lib/tilroy.ts) bevraagt de hub van het dashboard:
`GET {DASHBOARD_API_URL}/api/voorraad/skus?skus=…` → per sku een `shops`-map
met het aantal per Tilroy-vestigings-id (`tilroyShopId` in
[`src/lib/stores.ts`](src/lib/stores.ts)). De site roept Tilroy dus nooit
rechtstreeks aan.

Vestigings-id's: 7827 Nijverdal, 8626 Apeldoorn, 8627 Emmen, 8628 Deventer,
8629 Zutphen, **8934 webshopmagazijn** (bepaalt of iets bezorgd kan worden)
en 8602 testvestiging (telt nooit mee).

De hub doet bij een koude cache een volledige crawl (~40 s) en is daarna
5 minuten snel (~0,1 s). Daarom haalt de productpagina de voorraad **na** de
eerste render op, via onze eigen proxy `/api/voorraad?skus=…`; de pagina
wacht er dus nooit op.

### Catalogus-cache

De feed is ~9 MB en past niet in de Next-datacache. De geparste catalogus
(~4 MB, ~4.900 producten) gaat daarom een uur in Redis onder
`catalog:products:v1`, zodat een nieuwe serverinstance meteen data heeft in
plaats van 13–40 s op de feed te wachten. Zonder Redis werkt alles nog, maar
dan haalt elke koude instance de feed zelf op.

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
- **Vervolgstatussen** – het dashboard zet `paymentStatus:"shipped"` +
  `shipment.trackTrace` (bezorgen) of `readyForPickupAt`/`pickedUpAt`
  (afhalen) op de order in KV; de site toont ze automatisch.
- **Winkeldata** – adressen/openingstijden staan in
  [`src/lib/stores.ts`](src/lib/stores.ts) (overgenomen van devoordeelmarkt.nl).

## Scripts

| Commando | Doel |
| --- | --- |
| `npm run dev` | Ontwikkelserver |
| `npm run build` | Productie-build (type-check + prerender) |
| `npm run start` | Productie-server |
