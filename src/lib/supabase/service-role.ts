import "server-only";

import { createClient } from "@supabase/supabase-js";
import { isSupabaseMode } from "@/lib/data/data-source";
import { getServerSupabaseConfig } from "@/lib/supabase/types";

export function createSupabaseServiceRoleClient() {
  if (!isSupabaseMode()) {
    throw new Error("Supabase service-role client is disabled outside Supabase data-source mode.");
  }

  const config = getServerSupabaseConfig();

  if (!config.url || !config.serviceRoleKey) {
    throw new Error("Server-only Supabase service-role configuration is missing.");
  }

  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    },
    global: {
      headers: {
        "X-Client-Info": "kol-server-service-role"
      }
    }
  });
}
