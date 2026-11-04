"use server";

import { redirect } from "next/navigation";
import { sanitizeLoginNextPath } from "@/lib/auth/login-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = sanitizeLoginNextPath(String(formData.get("next") ?? ""));

  if (!email || !password) {
    redirect(`/login?error=missing_credentials&next=${encodeURIComponent(next)}`);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    redirect(`/login?error=auth_unavailable&next=${encodeURIComponent(next)}`);
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=invalid_credentials&next=${encodeURIComponent(next)}`);
  }

  redirect(next);
}

// Existing clients can return without a password or repeating onboarding.
// In contrast with registration, this never creates a new Auth user.
export async function signInClientWithEmailAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = sanitizeLoginNextPath(String(formData.get("next") ?? ""));
  const safeNext = next === "/client" || next.startsWith("/client/") ? next : "/client";

  if (!email.includes("@") || email.length > 254 || !/^[^@ ]+@[^@ ]+[.][^@ ]+$/.test(email)) {
    redirect(`/login?error=missing_email&next=${encodeURIComponent(safeNext)}`);
  }

  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "";
  const siteUrl = configuredSiteUrl.endsWith("/") ? configuredSiteUrl.slice(0, -1) : configuredSiteUrl;
  if (!siteUrl) redirect(`/login?error=auth_unavailable&next=${encodeURIComponent(safeNext)}`);

  let origin: string;
  try {
    const url = new URL(siteUrl);
    if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:")) {
      redirect(`/login?error=auth_unavailable&next=${encodeURIComponent(safeNext)}`);
    }
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      redirect(`/login?error=auth_unavailable&next=${encodeURIComponent(safeNext)}`);
    }
    origin = url.origin;
  } catch {
    redirect(`/login?error=auth_unavailable&next=${encodeURIComponent(safeNext)}`);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect(`/login?error=auth_unavailable&next=${encodeURIComponent(safeNext)}`);

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`
    }
  });
  if (error) redirect(`/login?error=${error.status === 429 ? "rate_limited" : "link_failed"}&next=${encodeURIComponent(safeNext)}`);
  redirect(`/login?sent=1&next=${encodeURIComponent(safeNext)}`);
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut({ scope: "local" });
  }
  redirect("/login?signedOut=1&next=%2Fclient");
}
