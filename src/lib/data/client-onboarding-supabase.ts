import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ClientOnboardingInput = {
  fullName: string;
  phone: string;
  locale?: string;
  defaultAddress?: string;
  requestId: string;
};

export async function completeClientOnboarding(input: ClientOnboardingInput) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, code: "supabase_not_configured" };

  const { data: userResult, error: userError } = await supabase.auth.getUser();
  const user = userResult.user;
  if (userError || !user) return { ok: false as const, code: "not_authenticated" };

  const { data, error } = await supabase.rpc("client_onboarding_complete_atomic", {
    p_full_name: input.fullName.trim(),
    p_phone: input.phone.trim(),
    p_locale: (input.locale || "ru").trim().toLowerCase(),
    p_default_address: input.defaultAddress?.trim() || null,
    p_request_id: input.requestId
  });

  if (error || !data || typeof data !== "object") {
    return { ok: false as const, code: error?.code === "42883" ? "onboarding_not_deployed" : "onboarding_failed" };
  }

  return { ok: true as const, userId: user.id };
}
