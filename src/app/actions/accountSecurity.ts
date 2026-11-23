"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAccountEmailCallback } from "@/lib/auth/account-email-origin";

const isEmail = (value: string) =>
  value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function toSecurityResult(code: string): never {
  redirect("/account/security?result=" + encodeURIComponent(code));
}

function toRecoveryResult(code: string): never {
  redirect("/forgot-password?status=" + encodeURIComponent(code));
}

/**
 * This never reveals whether an email belongs to a registered account.
 * Supabase Auth sends the actual recovery email, not KÖL application code.
 */
export async function requestAccountPasswordReset(form: FormData): Promise<never> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!isEmail(email)) toRecoveryResult("invalid_email");

  const callback = getAccountEmailCallback("/account/security?recovery=1");
  if (!callback) toRecoveryResult("configuration_unavailable");

  const supabase = await createSupabaseServerClient();
  if (!supabase) toRecoveryResult("configuration_unavailable");

  let errorStatus: number | undefined;
  try {
    const {error} = await supabase.auth.resetPasswordForEmail(email, {redirectTo:callback});
    errorStatus = error?.status;
    if (error && !errorStatus) errorStatus = 500;
  } catch {
    toRecoveryResult("delivery_unavailable");
  }
  if (errorStatus === 429) toRecoveryResult("rate_limited");
  if (errorStatus) toRecoveryResult("delivery_unavailable");
  toRecoveryResult("sent");
}

/** Change only the currently signed-in Supabase Auth identity. */
export async function updateOwnAccountPassword(form: FormData): Promise<never> {
  const password = String(form.get("password") ?? "");
  const confirmation = String(form.get("password_confirm") ?? "");
  if (password !== confirmation) toSecurityResult("password_mismatch");
  if (password.length < 12 || new TextEncoder().encode(password).length > 72) {
    toSecurityResult("password_policy");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) toSecurityResult("unavailable");
  const {data:{user},error:identityError} = await supabase.auth.getUser();
  if (identityError || !user) redirect("/login?next=%2Faccount%2Fsecurity");

  let failed = false;
  try {
    const {error} = await supabase.auth.updateUser({password});
    failed = Boolean(error);
  } catch {
    toSecurityResult("unavailable");
  }
  if (failed) toSecurityResult("password_rejected");
  toSecurityResult("password_updated");
}

/**
 * Email = login in KÖL. Supabase verifies the proposed address and may
 * also require confirmation from the old email before changing auth.users.
 */
export async function updateOwnAccountEmail(form: FormData): Promise<never> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!isEmail(email)) toSecurityResult("invalid_email");

  const supabase = await createSupabaseServerClient();
  if (!supabase) toSecurityResult("unavailable");
  const {data:{user},error:identityError} = await supabase.auth.getUser();
  if (identityError || !user) redirect("/login?next=%2Faccount%2Fsecurity");
  if (user.email?.trim().toLowerCase() === email) toSecurityResult("email_unchanged");

  const callback = getAccountEmailCallback("/account/security?email_verified=1");
  if (!callback) toSecurityResult("configuration_unavailable");

  let errorStatus: number | undefined;
  try {
    const {error} = await supabase.auth.updateUser(
      {email}, {emailRedirectTo: callback}
    );
    errorStatus = error?.status;
    if (error && !errorStatus) errorStatus = 500;
  } catch {
    toSecurityResult("unavailable");
  }
  if (errorStatus === 429) toSecurityResult("rate_limited");
  if (errorStatus) toSecurityResult("email_rejected");
  toSecurityResult("email_confirmation_sent");
}
