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

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut({ scope: "local" });
  }
  redirect("/login?signedOut=1&next=%2Fclient");
}
