# De Voordeelmarkt – webshop

Webshop voor **devoordeelmarkt.nl**: online bestellen, veilig betalen via
Mollie en gratis afhalen in de winkel. Gebouwd met **Next.js 14 (App Router)**,
TypeScript en Tailwind CSS.

## Features

- 🛒 **Webshop** – homepage met topdeals, categoriepagina's, productpagina's
  met varianten, winkelwagen en checkout.
- 🎨 **Kleurkiezer** – 140+ RAL-kleuren met zoeken en filteren. De gekozen
  kleur reist mee van productpagina tot in de bestelling en het kassasysteem.
- 💳 **Mollie-betalingen** – iDEAL, Bancontact, creditcard en Apple Pay via de
  Mollie hosted checkout. Zonder API-sleutel draait de site in **demomodus**
  met een gesimuleerde betaalpagina, zodat de hele flow lokaal testbaar is.
- 🏬 **Afhalen in de winkel** – winkelkeuze in de checkout, afhaalcode na
  betaling en een bestelstatuspagina die live bijwerkt.
- 🔗 **Tilroy-koppeling** – producten, winkels en voorraad komen uit de Tilroy
  API; betaalde bestellingen worden als afhaalorder naar Tilroy gepusht zodat
  de winkel ze in de kassa ziet. Zonder sleutel is er een ingebouwde
  demo-catalogus.
- 🔍 **SEO** – sitemap.xml, robots.txt, canonicals, Open Graph en JSON-LD
  (Organization, WebSite met SearchAction, Product, BreadcrumbList,
  HardwareStore per vestiging).

## Snel starten

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Zonder `.env` draait alles in demomodus:
demo-catalogus, demo-winkels en een gesimuleerde betaalomgeving.

## Configuratie

Kopieer `.env.example` naar `.env.local` en vul in wat je hebt:

| Variabele | Uitleg |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Publieke URL (voor SEO, sitemap en betaal-redirects). |
| `MOLLIE_API_KEY` | `test_…` of `live_…` sleutel. Leeg = demo-betaalpagina. |
| `TILROY_API_KEY` | API-sleutel van je Tilroy-omgeving. Leeg = demo-catalogus. |
| `TILROY_API_URL` | Basis-URL van de Tilroy API. |
| `TILROY_PRODUCTS_ENDPOINT` / `TILROY_SHOPS_ENDPOINT` / `TILROY_SALES_ENDPOINT` | Afwijkende endpoint-paden per omgeving. |

### Tilroy-mapping

Endpoints en veldnamen verschillen per Tilroy-account. De hele koppeling zit
in [`src/lib/tilroy.ts`](src/lib/tilroy.ts): pas `mapTilroyProduct`,
`mapTilroyShop` en de payload in `pushOrderToTilroy` aan op het antwoord van
jouw omgeving. Elke functie valt automatisch terug op de demodata als de API
niet bereikbaar is, dus de site blijft altijd werken.

### Mollie

De betaallaag ([`src/lib/mollie.ts`](src/lib/mollie.ts)) praat rechtstreeks
met de Mollie REST API v2. De webhook (`/api/webhooks/mollie`) werkt alleen op
een publiek bereikbare URL; op localhost synchroniseert de bestelpagina de
betaalstatus zelf bij Mollie (lazy sync), dus ook lokaal klopt de status.

## Bestelflow

1. Klant vult winkelwagen (kleurkeuze wordt per artikel bewaard).
2. `/afrekenen` → naam, e-mail, telefoon en afhaalwinkel → `POST /api/checkout`.
3. Server valideert artikelen en **herberekent alle prijzen server-side**,
   maakt de bestelling aan (`VDM-XXXXXX` + afhaalcode) en start de betaling.
4. Klant betaalt bij Mollie (of op de demo-betaalpagina).
5. Webhook of lazy sync zet de bestelling op **betaald** en pusht hem als
   afhaalorder naar Tilroy.
6. `/bestelling/[id]` toont de afhaalcode, de gekozen winkel en de status.

Bestellingen worden in demomodus opgeslagen als JSON in `.data/orders/`
(genegeerd door git).

## Naar productie

- **Database** – vervang de bestandsopslag in `src/lib/orders.ts` door een
  echte database (Postgres, MySQL, …); de rest van de code raakt alleen deze
  module.
- **E-mail** – verstuur een bevestiging + "ligt klaar"-bericht (bv. Resend of
  Postmark) vanuit `applyPaymentResult` in `src/lib/orders.ts`.
- **Status "klaar om af te halen"** – laat Tilroy (of een winkelscherm) de
  status `ready_for_pickup` zetten via een eigen endpoint.
- **Winkeldata** – de demo-adressen en -openingstijden in `src/lib/stores.ts`
  vervang je door de echte vestigingen (of volledig via de Tilroy shops-API).
- Zet `NEXT_PUBLIC_SITE_URL` naar `https://www.devoordeelmarkt.nl` zodat
  sitemap, canonicals en de Mollie-webhook de juiste URL gebruiken.

## Scripts

| Commando | Doel |
| --- | --- |
| `npm run dev` | Ontwikkelserver |
| `npm run build` | Productie-build (type-check + prerender) |
| `npm run start` | Productie-server |
