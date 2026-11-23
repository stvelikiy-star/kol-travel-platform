import "server-only";

import { getPublishedSiteText } from "@/lib/data/site-content-read";
import { getServerSupabaseConfig } from "@/lib/supabase/types";

export type HomeVisuals = { background: string | null; banner: string | null; bannerLink: string | null };

export function safeSiteVisualUrl(value: string): string | null {
  if (!value) return null;
  const config = getServerSupabaseConfig();
  if (!config.url) return null;
  try {
    const base = new URL(config.url);
    const url = new URL(value);
    if (url.protocol !== "https:" || url.origin !== base.origin ||
        !/^\/storage\/v1\/object\/public\/site-visuals\/(background|banner)\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(url.pathname) ||
        url.search || url.hash || url.username || url.password) return null;
    return url.toString();
  } catch { return null; }
}
export function safeSiteBannerLink(value: string): string | null {
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//") &&
      !value.includes("\\") && !/[\u0000-\u001f]/.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !!url.hostname && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}

export async function getHomeVisuals(): Promise<HomeVisuals> {
  const [background, banner, link] = await Promise.all([
    getPublishedSiteText("home.visual.background", "ru", ""),
    getPublishedSiteText("home.visual.banner", "ru", ""),
    getPublishedSiteText("home.visual.banner_link", "ru", "")
  ]);
  const bg = safeSiteVisualUrl(background.value);
  const image = safeSiteVisualUrl(banner.value);
  return {
    background: bg && bg.includes("/background/") ? bg : null,
    banner: image && image.includes("/banner/") ? image : null,
    bannerLink: safeSiteBannerLink(link.value)
  };
}
