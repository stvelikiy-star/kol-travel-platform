"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const allowedNextPrefixes = [
  "/client",
  "/owner",
  "/partner",
  "/courier",
  "/admin",
  "/stays",
  "/tours",
  "/food",
  "/shop",
  "/booking"
];
const allowedNextPaths = new Set(["/", "/cart", "/checkout", "/contacts"]);

function matchesAllowedPrefix(next: string, prefix: string) {
  return next === prefix || next.startsWith(`${prefix}/`) || next.startsWith(`${prefix}?`);
}

function safeNextPath(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value.trim() : "";

  // Only permit local application paths. Reject protocol-relative URLs,
  // backslashes and control characters before checking the explicit allowlist.
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\u0000-\u001F\u007F]/.test(next)) {
    return "/client";
  }

  if (allowedNextPaths.has(next) || allowedNextPrefixes.some((prefix) => matchesAllowedPrefix(next, prefix))) {
    return next;
  }

  return "/client";
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

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
