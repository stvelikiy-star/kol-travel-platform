"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { getAccountEmailCallback } from "@/lib/auth/account-email-origin";

const MANAGED = [
  "dispatcher", "support_admin", "finance_admin",
  "partner_owner", "partner_manager", "partner_staff", "courier"
] as const;
type ManagedRole = typeof MANAGED[number];
const partnerRoles: readonly string[] = ["partner_owner", "partner_manager", "partner_staff"];
const administrativeRoles: readonly string[] = ["dispatcher", "support_admin", "finance_admin"];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isManagedRole(value: string): value is ManagedRole {
  return (MANAGED as readonly string[]).includes(value);
}
function back(code: string): never {
  redirect("/admin/users?access=" + encodeURIComponent(code));
}
function nextForRole(role: ManagedRole) {
  if (partnerRoles.includes(role)) return "/partner";
  if (role === "courier") return "/courier";
  return "/admin";
}
async function logAction(
  db: ReturnType<typeof createSupabaseServiceRoleClient>,
  actorId: string, targetId: string, action: string, before: Record<string, unknown> | null,
  after: Record<string, unknown> | null, reason: string
) {
  const { error } = await db.from("audit_logs").insert({
    actor_id: actorId, actor_role: "super_admin",
    action, entity_type: "user_access", entity_id: targetId, before, after,
    reason: reason.slice(0, 500), request_id: crypto.randomUUID()
  });
  if (error) throw new Error("Cannot write user access audit");
}

/** This action intentionally never creates client or super_admin accounts. */
export async function inviteManagedUserAction(form: FormData) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) back("denied");
  const actorId = auth.data.userId;
  if (auth.data.role !== "super_admin" || auth.data.status !== "active") back("denied");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const fullName = String(form.get("full_name") ?? "").trim();
  const roleInput = String(form.get("role") ?? "");
  const partnerId = String(form.get("partner_id") ?? "").trim();
  const reason = String(form.get("reason") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
      fullName.length < 2 || fullName.length > 120 || reason.length < 5 || reason.length > 500 ||
      !isManagedRole(roleInput)) back("invalid");
  const role: ManagedRole = roleInput;
  if ((partnerRoles.includes(role) && !uuidPattern.test(partnerId)) ||
      (!partnerRoles.includes(role) && partnerId)) back("invalid_scope");
  const callback = getAccountEmailCallback(nextForRole(role));
  if (!callback) back("email_config");

  const db = createSupabaseServiceRoleClient();
  if (partnerRoles.includes(role)) {
    const { data, error } = await db.from("partners").select("id").eq("id", partnerId).maybeSingle();
    if (error || !data) back("invalid_scope");
  }
  // Invites may fail without configured SMTP; never silently issue passwords or grant public signup roles.
  const { data: invitation, error: invitationError } = await db.auth.admin.inviteUserByEmail(email, {
    redirectTo: callback, data: { full_name: fullName }
  });
  if (invitationError || !invitation.user?.id) back("invite_failed");
  const targetId = invitation.user.id;
  try {
    const { error: profileError } = await db.from("user_profiles").insert({
      user_id: targetId, email, full_name: fullName, status: "active"
    });
    if (profileError) throw profileError;
    const { error: roleError } = await db.from("user_roles").insert({
      user_id: targetId, role, scope_id: partnerRoles.includes(role) ? partnerId : null, is_active: true
    });
    if (roleError) throw roleError;
    if (partnerRoles.includes(role)) {
      const { error } = await db.from("partner_profiles").insert({ user_id: targetId, business_id: partnerId });
      if (error) throw error;
    } else if (role === "courier") {
      const { error } = await db.from("courier_profiles").insert({ user_id: targetId });
      if (error) throw error;
    } else {
      const { error } = await db.from("admin_profiles").insert({ user_id: targetId, admin_level: role });
      if (error) throw error;
    }
    await logAction(db, actorId, targetId, "user.invite", null,
      { email, role, partner_id: partnerRoles.includes(role) ? partnerId : null }, reason);
  } catch {
    // New identities only; never delete or mutate an existing auth account.
    const { error: deleteError } = await db.auth.admin.deleteUser(targetId);
    if (deleteError) {
      // Any provisioned profile is blocked even if Auth cleanup fails.
      await db.from("user_profiles").update({ status: "blocked" }).eq("user_id", targetId);
      await db.from("user_roles").update({ is_active: false }).eq("user_id", targetId);
    }
    back("provision_failed");
  }
  revalidatePath("/admin/users");
  back("invited");
}

export async function updateManagedUserAccessAction(form: FormData) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) back("denied");
  const actorId = auth.data.userId;
  if (auth.data.role !== "super_admin" || auth.data.status !== "active") back("denied");
  const targetId = String(form.get("user_id") ?? "");
  const command = String(form.get("command") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  const nextRole = String(form.get("role") ?? "");
  if (!uuidPattern.test(targetId) || actorId === targetId ||
      reason.length < 5 || reason.length > 500 ||
      !["block", "unblock", "change_role"].includes(command)) back("invalid");
  const db = createSupabaseServiceRoleClient();
  const { data: profile, error: profileError } = await db.from("user_profiles")
    .select("user_id,status").eq("user_id", targetId).maybeSingle();
  const { data: roles, error: rolesError } = await db.from("user_roles")
    .select("id,role,scope_id").eq("user_id", targetId).eq("is_active", true);
  if (profileError || rolesError || !profile || !roles || roles.length !== 1 ||
      !isManagedRole(roles[0].role)) back("protected");
  const currentRole = roles[0].role as ManagedRole;

  if (command === "change_role") {
    if (!isManagedRole(nextRole) || nextRole === currentRole) back("invalid");
    // Cross-family changes require atomic profile migration: fail closed rather than leave wrong ownership.
    const sameAdminFamily = administrativeRoles.includes(currentRole) && administrativeRoles.includes(nextRole);
    const samePartnerFamily = partnerRoles.includes(currentRole) && partnerRoles.includes(nextRole);
    if (!sameAdminFamily && !samePartnerFamily) back("role_family");
    const { error } = await db.from("user_roles").update({ role: nextRole })
      .eq("id", roles[0].id).eq("role", currentRole);
    if (error) back("update_failed");
    if (sameAdminFamily) {
      const { error: adminError } = await db.from("admin_profiles").update({ admin_level: nextRole })
        .eq("user_id", targetId);
      if (adminError) {
        await db.from("user_roles").update({ role: currentRole }).eq("id", roles[0].id);
        back("update_failed");
      }
    }
    try {
      await logAction(db, actorId, targetId, "user.role_changed",
        { role: currentRole }, { role: nextRole }, reason);
    } catch {
      await db.from("user_roles").update({ role: currentRole })
        .eq("id", roles[0].id).eq("role", nextRole);
      if (sameAdminFamily) {
        await db.from("admin_profiles").update({ admin_level: currentRole })
          .eq("user_id", targetId);
      }
      back("audit_failed");
    }
  } else {
    const status = command === "block" ? "blocked" : "active";
    if (profile.status === status) back("invalid");
    const { data: modified, error } = await db.from("user_profiles").update({ status })
      .eq("user_id", targetId).eq("status", profile.status).select("user_id").maybeSingle();
    if (error || !modified) back("update_failed");
    try {
      await logAction(db, actorId, targetId, "user." + command,
        { status: profile.status }, { status }, reason);
    } catch {
      await db.from("user_profiles").update({ status: profile.status })
        .eq("user_id", targetId).eq("status", status);
      back("audit_failed");
    }
  }
  revalidatePath("/admin/users");
  back("updated");
}
