import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isSupabaseMode } from "@/lib/data/data-source";
import { createSupabaseNotConfiguredError } from "@/lib/supabase/errors";
import { getServerSupabaseConfig, type SupabasePlaceholderClient } from "@/lib/supabase/types";

/**
 * Existing legacy readiness probe kept for older placeholder adapters.
 * New Auth/scoped code must use createSupabaseServerClient().
 */
export function getSupabaseServerClient(): SupabasePlaceholderClient | null {
  const config = getServerSupabaseConfig();

  if (!isSupabaseMode()) {
    return {
      isConfigured: false,
      reason: "DATA_SOURCE_MODE is mock. Supabase server client is intentionally inactive."
    };
  }

  if (!config.isConfigured) {
    createSupabaseNotConfiguredError();
    return null;
  }

  return {
    isConfigured: false,
    reason: "Use createSupabaseServerClient() for real server-side Auth/RLS-scoped access."
  };
}

export async function createSupabaseServerClient() {
  if (!isSupabaseMode()) {
    return null;
  }

  const config = getServerSupabaseConfig();

  if (!config.url || !config.publicKey) {
    return null;
  }

  const cookieStore = cookies();

  return createServerClient(config.url, config.publicKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies. Middleware/server
          // actions handle refresh persistence; reads still fail closed safely.
        }
      }
    }
  });
}

export function assertServiceRoleIsServerOnly() {
  return "SUPABASE_SERVICE_ROLE_KEY must be used only in server-side code and never exposed to the browser.";
}
