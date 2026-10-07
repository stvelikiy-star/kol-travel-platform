import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { completeClientOnboarding } from "@/lib/data/client-onboarding-supabase";

const onboardingCookie = "kol_client_onboarding";

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/client";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const supabase = await createSupabaseServerClient();
  if (!supabase || !code) return NextResponse.redirect(new URL(`/login?error=auth_unavailable&next=${encodeURIComponent(next)}`, url));

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL(`/register?error=send_failed`, url));

  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;
  if (!user) return NextResponse.redirect(new URL(`/login?error=auth_unavailable&next=${encodeURIComponent(next)}`, url));

  const metadata = user.user_metadata ?? {};
  const cookieStore = await cookies();
  const pendingCookie = cookieStore.get(onboardingCookie)?.value;
  let pending: { fullName?: string; phone?: string; locale?: string } = {};
  if (pendingCookie) {
    try {
      const parsed = JSON.parse(decodeURIComponent(pendingCookie)) as unknown;
      if (parsed && typeof parsed === "object") pending = parsed as typeof pending;
    } catch {
      pending = {};
    }
  }
  const onboarding = await completeClientOnboarding({
    fullName: typeof metadata.full_name === "string" && metadata.full_name.trim() ? metadata.full_name : pending.fullName || "",
    phone: typeof metadata.phone === "string" && metadata.phone.trim() ? metadata.phone : pending.phone || "",
    locale: typeof metadata.locale === "string" && metadata.locale.trim() ? metadata.locale : pending.locale || "ru",
    requestId: `onboarding-${user.id}`
  });

  cookieStore.delete(onboardingCookie);

  if (!onboarding.ok) return NextResponse.redirect(new URL(`/profile-required?onboarding=${encodeURIComponent(onboarding.code)}`, url));
  return NextResponse.redirect(new URL(next, url));
}
