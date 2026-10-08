"use server";

import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const onboardingCookie = "kol_client_onboarding";

function clean(value: FormDataEntryValue | null, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function registerRedirect(params: Record<string, string>): never {
  const query = new URLSearchParams(params);
  redirect(`/register?${query.toString()}`);
}

export async function requestClientAccessAction(formData: FormData) {
  const fullName = clean(formData.get("fullName"), 120);
  const phone = clean(formData.get("phone"), 40);
  const email = clean(formData.get("email"), 254).toLowerCase();

  if (fullName.length < 2) registerRedirect({ error: "name" });
  if (phone.length < 5) registerRedirect({ error: "phone" });
  if (!email.includes("@") || email.length < 6) registerRedirect({ error: "email" });

  const supabase = await createSupabaseServerClient();
  if (!supabase) registerRedirect({ error: "unavailable" });

  const requestHeaders = await headers();
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  const origin = requestHeaders.get("origin") || configuredOrigin;
  if (!origin) registerRedirect({ error: "unavailable" });

  const cookieStore = await cookies();
  cookieStore.set(onboardingCookie, encodeURIComponent(JSON.stringify({ fullName, phone, locale: "ru" })), {
    httpOnly: true,
    maxAge: 900,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${origin}/auth/callback?next=%2Fclient%2Fprofile`,
      data: { full_name: fullName, phone, locale: "ru" }
    }
  });

  if (error) registerRedirect({ error: "send_failed" });
  registerRedirect({ sent: "1" });
}
