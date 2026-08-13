import { createNotAuthenticatedError, createSafeServerError } from "@/lib/auth/errors";
import type { AuthHelperResult, AuthSessionUser } from "@/lib/auth/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentSession(): Promise<AuthHelperResult<AuthSessionUser>> {
  try {
    const supabase = await createSupabaseServerClient();

    if (!supabase) {
      return { ok: false, error: createNotAuthenticatedError() };
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      return { ok: false, error: createNotAuthenticatedError() };
    }

    // getUser() above is the authorization decision. getSession() is used only
    // to obtain the already-validated user's access token for RLS-scoped REST calls.
    const { data: sessionData } = await supabase.auth.getSession();

    return {
      ok: true,
      data: {
        id: userData.user.id,
        email: userData.user.email ?? undefined,
        accessToken: sessionData.session?.access_token
      }
    };
  } catch {
    return { ok: false, error: createSafeServerError() };
  }
}

export async function requireAuthenticatedUser(): Promise<AuthHelperResult<AuthSessionUser>> {
  return getCurrentSession();
}
