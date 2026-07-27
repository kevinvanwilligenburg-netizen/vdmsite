import { isKvEnabled, kvGetJSON, kvMGet, kvSMembers } from "@/lib/kv";

/**
 * Door het VDM-dashboard beheerde content (banners en pagina's).
 *
 * ⚠️ EXTERN CONTRACT — het dashboard (repo dashboardvdm) SCHRIJFT deze keys,
 * de site leest ze alleen:
 *   `content:banner:<slug>`  → SiteBanner-JSON (slug "home-hero" = homepage-banner)
 *   `page:<slug>`            → SitePage-JSON
 *   `page:index`             → SET met alle pagina-slugs
 *
 * Alles is best-effort: zonder KV (of bij een storing) vallen banners terug
 * op de ingebouwde teksten en zijn er simpelweg geen extra pagina's.
 */

export interface SiteBanner {
  title: string;
  subtitle?: string;
  badge?: string;
  ctaLabel?: string;
  ctaHref?: string;
  imageUrl?: string;
}

export interface SitePage {
  slug: string;
  title: string;
  description?: string;
  /** Platte tekst; lege regel = nieuwe alinea, regel die met "## " begint = tussenkop. */
  body: string;
  published?: boolean;
  updatedAt?: string;
}

const KEY = {
  banner: (slug: string) => `content:banner:${slug}`,
  page: (slug: string) => `page:${slug}`,
  pageIndex: "page:index",
};

const SLUG_PATTERN = /^[a-z0-9-]{1,64}$/;

export async function getBanner(slug: string): Promise<SiteBanner | null> {
  if (!isKvEnabled() || !SLUG_PATTERN.test(slug)) return null;
  const banner = await kvGetJSON<SiteBanner>(KEY.banner(slug));
  if (!banner || typeof banner.title !== "string" || !banner.title.trim()) return null;
  return banner;
}

export async function getPage(slug: string): Promise<SitePage | null> {
  if (!isKvEnabled() || !SLUG_PATTERN.test(slug)) return null;
  const page = await kvGetJSON<SitePage>(KEY.page(slug));
  if (!page || typeof page.title !== "string" || typeof page.body !== "string") return null;
  if (page.published === false) return null;
  return { ...page, slug };
}

export async function listPublishedPages(): Promise<SitePage[]> {
  if (!isKvEnabled()) return [];
  const slugs = (await kvSMembers(KEY.pageIndex)).filter((slug) => SLUG_PATTERN.test(slug));
  if (slugs.length === 0) return [];
  const raw = await kvMGet(slugs.map(KEY.page));
  const pages: SitePage[] = [];
  raw.forEach((value, index) => {
    if (!value) return;
    try {
      const page = JSON.parse(value) as SitePage;
      if (
        typeof page.title === "string" &&
        typeof page.body === "string" &&
        page.published !== false
      ) {
        pages.push({ ...page, slug: slugs[index] });
      }
    } catch {
      // ongeldige JSON overslaan
    }
  });
  return pages.sort((a, b) => a.title.localeCompare(b.title, "nl"));
}
