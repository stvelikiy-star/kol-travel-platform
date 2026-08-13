import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseMode } from "@/lib/data/data-source";
import { getPublicSupabaseConfig } from "@/lib/supabase/types";

export function getSupabaseBrowserClient() {
  if (!isSupabaseMode()) {
    return null;
  }

  const config = getPublicSupabaseConfig();

  if (!config.url || !config.publicKey) {
    return null;
  }

  return createBrowserClient(config.url, config.publicKey);
}
