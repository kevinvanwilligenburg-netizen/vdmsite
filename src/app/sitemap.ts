import type { MetadataRoute } from "next";

import { listPublishedPages } from "@/lib/content";
import { GIDSEN } from "@/lib/gidsen";
import { kleurtestersActief } from "@/lib/instellingen";
import { alleRalKleuren, ralSlug } from "@/lib/kleurpaginas";
import { absoluteUrl } from "@/lib/site";
import { getBrands, getCategories, getProducts, getStores } from "@/lib/tilroy";
import { VERGELIJKINGEN } from "@/lib/vergelijk";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, stores, pages, brands, testers] = await Promise.all([
    getProducts(),
    getCategories(),
    getStores(),
    listPublishedPages(),
    getBrands(60),
    kleurtestersActief(),
  ]);
  const lastModified = new Date();

  const staticPages: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" | "yearly" }[] = [
    { path: "/", priority: 1, changeFrequency: "daily" },
    { path: "/kleurkiezer", priority: 0.9, changeFrequency: "weekly" },
    { path: "/kleuren", priority: 0.8, changeFrequency: "weekly" },
    { path: "/kleuren/ral", priority: 0.8, changeFrequency: "monthly" },
    // Alleen als de kleurtester in het dashboard openstaat; anders geeft de
    // pagina een 404 en meldt Search Console een kapotte sitemap-URL.
    ...(testers
      ? [{ path: "/kleurstalen", priority: 0.8, changeFrequency: "monthly" as const }]
      : []),
    ...GIDSEN.map((gids) => ({
      path: `/gids/${gids.slug}`,
      priority: 0.8,
      changeFrequency: "weekly" as const,
    })),
    ...VERGELIJKINGEN.map((vergelijking) => ({
      path: `/vergelijk/${vergelijking.slug}`,
      priority: 0.7,
      changeFrequency: "monthly" as const,
    })),
    { path: "/klusadvies", priority: 0.9, changeFrequency: "monthly" },
    { path: "/merken", priority: 0.8, changeFrequency: "weekly" },
    { path: "/categorieen", priority: 0.7, changeFrequency: "weekly" },
    { path: "/vacatures", priority: 0.5, changeFrequency: "weekly" },
    { path: "/winkels", priority: 0.8, changeFrequency: "monthly" },
    { path: "/bezorgen-en-afhalen", priority: 0.7, changeFrequency: "monthly" },
    { path: "/zakelijk", priority: 0.8, changeFrequency: "monthly" },
    { path: "/klantenservice", priority: 0.7, changeFrequency: "monthly" },
    { path: "/algemene-voorwaarden", priority: 0.3, changeFrequency: "yearly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  ];

  return [
    ...staticPages.map((page) => ({
      url: absoluteUrl(page.path),
      lastModified,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
    ...categories.map((category) => ({
      url: absoluteUrl(`/categorie/${category.slug}`),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    // Sitemaps mogen 50.000 URL's bevatten. Ook tijdelijk uitverkochte
    // artikelen horen erin: de pagina bestaat, is nuttig ("voeren jullie deze
    // maat?") en biedt een seintje-zodra-binnen. Eruit laten kost de
    // ranking die we bij de volgende levering juist nodig hebben.
    ...products
      .slice(0, 20000)
      .map((product) => ({
        url: absoluteUrl(`/product/${product.slug}`),
        lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ...brands.map((brand) => ({
      url: absoluteUrl(`/merk/${brand.slug}`),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    // Elke RAL-kleur heeft een eigen landingspagina (213 stuks).
    ...alleRalKleuren().map((kleur) => ({
      url: absoluteUrl(`/kleuren/ral/${ralSlug(kleur)}`),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...stores.map((store) => ({
      url: absoluteUrl(`/winkels/${store.slug}`),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...pages.map((page) => ({
      url: absoluteUrl(`/info/${page.slug}`),
      lastModified: page.updatedAt ? new Date(page.updatedAt) : lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
