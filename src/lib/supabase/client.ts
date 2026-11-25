import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "@/lib/supabase/types";

/**
 * Next.js deliberately does not expose DATA_SOURCE_MODE to browser bundles.
 * Read the non-secret mode rendered by the trusted server layout instead.
 * Keep mock-mode and unavailable configuration fail-closed.
 */
export function getSupabaseBrowserClient() {
  if (typeof document === "undefined" ||
      document.documentElement.dataset.kolDataSourceMode !== "supabase") {
    return null;
  }

  const config = getPublicSupabaseConfig();

  if (!config.url || !config.publicKey) {
    return null;
  }

  return createBrowserClient(config.url, config.publicKey);
}
