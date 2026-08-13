export {
  createSupabaseClientError,
  createSupabaseNotConfiguredError,
  createSupabaseServerError
} from "@/lib/supabase/errors";
export type { SupabaseSafeError, SupabaseSafeErrorCode } from "@/lib/supabase/errors";
export { getSupabaseBrowserClient } from "@/lib/supabase/client";
export {
  assertServiceRoleIsServerOnly,
  createSupabaseServerClient,
  getSupabaseServerClient
} from "@/lib/supabase/server";
export { getPublicSupabaseConfig, getServerSupabaseConfig } from "@/lib/supabase/types";
export type { SupabasePlaceholderClient, SupabaseRuntimeConfig } from "@/lib/supabase/types";
