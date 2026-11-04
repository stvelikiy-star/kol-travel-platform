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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) registerRedirect({ error: "email" });

  const supabase = await createSupabaseServerClient();
  if (!supabase) registerRedirect({ error: "unavailable" });

  // Never send login links to an arbitrary Origin supplied by the requester.
  // Production must use the configured public site URL as the redirect target.
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (process.env.NODE_ENV === "production" && !configuredOrigin) {
    registerRedirect({ error: "unavailable" });
  }
  const requestHeaders = await headers();
  const candidateOrigin = configuredOrigin || requestHeaders.get("origin");
  let origin: string;
  try {
    const parsedOrigin = new URL(candidateOrigin || "");
    if (
      (parsedOrigin.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && parsedOrigin.protocol === "http:")) ||
      parsedOrigin.username || parsedOrigin.password ||
      parsedOrigin.pathname !== "/" || parsedOrigin.search || parsedOrigin.hash
    ) {
      registerRedirect({ error: "unavailable" });
    }
    origin = parsedOrigin.origin;
  } catch {
    registerRedirect({ error: "unavailable" });
  }

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

  if (error) registerRedirect({ error: error.status === 429 ? "rate_limited" : "send_failed" });
  registerRedirect({ sent: "1" });
}
