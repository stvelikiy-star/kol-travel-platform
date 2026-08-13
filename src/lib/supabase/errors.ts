export type SupabaseSafeErrorCode =
  | "supabase_not_configured"
  | "supabase_server_error"
  | "supabase_client_error";

export type SupabaseSafeError = {
  ok: false;
  code: SupabaseSafeErrorCode;
  message: string;
};

export function createSupabaseNotConfiguredError(): SupabaseSafeError {
  return {
    ok: false,
    code: "supabase_not_configured",
    message: "Supabase is not configured for the current safe mode."
  };
}

export function createSupabaseServerError(): SupabaseSafeError {
  return {
    ok: false,
    code: "supabase_server_error",
    message: "Supabase server client is unavailable."
  };
}

export function createSupabaseClientError(): SupabaseSafeError {
  return {
    ok: false,
    code: "supabase_client_error",
    message: "Supabase browser client is unavailable."
  };
}
