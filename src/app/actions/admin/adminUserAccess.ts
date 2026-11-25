"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { getAccountEmailOrigin } from "@/lib/auth/account-email-origin";
import { isManagedRole, isManagedPartnerRole, canSwitchManagedRole, type ManagedRole } from "@/lib/auth/managed-access-policy";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function back(code: string): never {
  redirect("/admin/users?access=" + encodeURIComponent(code));
}
function nextForRole(role: ManagedRole) {
  if (isManagedPartnerRole(role)) return "/partner";
  if (role === "courier") return "/courier";
  if (role === "content_manager") return "/editor/content";
  return "/admin";
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
  if ((isManagedPartnerRole(role) && !uuidPattern.test(partnerId)) ||
      (!isManagedPartnerRole(role) && partnerId)) back("invalid_scope");
  const origin = getAccountEmailOrigin();
  if (!origin) back("email_config");
  const inviteUrl = new URL("/auth/invite", origin);
  inviteUrl.searchParams.set("next", nextForRole(role));

  const db = createSupabaseServiceRoleClient();
  if (isManagedPartnerRole(role)) {
    const { data, error } = await db.from("partners").select("id").eq("id", partnerId).maybeSingle();
    if (error || !data) back("invalid_scope");
  }
  // Never repurpose an existing Auth identity. Bound the lookup and fail closed
  // when the directory cannot be checked completely.
  let directoryChecked = false;
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) back("invite_failed");
    if (data.users.some((user) => user.email?.trim().toLowerCase() === email)) back("protected");
    if (data.users.length < 1000) {
      directoryChecked = true;
      break;
    }
  }
  if (!directoryChecked) back("invite_failed");

  // SMTP is an external Auth operation, not part of the database transaction.
  // A random correlation marker verifies this specific newly created invitation;
  // it is not used as an authorization claim.
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const { data: invitation, error: invitationError } = await db.auth.admin.inviteUserByEmail(email, {
    redirectTo: inviteUrl.toString(), data: { full_name: fullName, kol_invite_request: requestId }
  });
  const invited = invitation?.user;
  if (invitationError || !invited?.id || invited.email?.trim().toLowerCase() !== email ||
      invited.user_metadata?.kol_invite_request !== requestId || !invited.invited_at ||
      !Number.isFinite(Date.parse(invited.created_at)) || Date.parse(invited.created_at) < startedAt - 5000) {
    back("invite_failed");
  }

  // The server-only RPC rechecks the active SUPER ADMIN and commits application
  // profile, role, membership and audit together. Never delete an Auth identity
  // after an ambiguous network result: the transaction might have committed.
  const { data: provisioned, error: provisionError } = await db.rpc("kol_provision_managed_invite_v1", {
    p_actor: actorId, p_target: invited.id, p_email: email,
    p_full_name: fullName, p_role: role, p_partner_id: isManagedPartnerRole(role) ? partnerId : null,
    p_reason: reason, p_request_id: requestId
  });
  if (provisionError || provisioned !== "invited") {
    const { data: audit, error: auditError } = await db.from("audit_logs")
      .select("id").eq("request_id", requestId).eq("actor_id", actorId)
      .eq("entity_id", invited.id).eq("action", "user.invite").maybeSingle();
    // An audit row proves the atomic transaction committed despite a lost response.
    // Without it, leave the unprovisioned Auth account without application roles;
    // an authorized operator must reconcile it, never silently grant access.
    if (auditError || !audit) back("provision_failed");
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
    .select("id,role,scope_id,is_active").eq("user_id", targetId);
  if (profileError || rolesError || !profile || !roles || roles.length !== 1 ||
      !isManagedRole(roles[0].role)) back("protected");
  const currentRole = roles[0].role as ManagedRole;

  if (command === "change_role") {
    if (profile.status !== "active" || !roles[0].is_active) back("protected");
    if (!isManagedRole(nextRole) || nextRole === currentRole) back("invalid");
    if (!canSwitchManagedRole(currentRole, nextRole)) back("role_family");
  }
  // All writes and the mandatory audit entry commit together in PostgreSQL.
  // The RPC rechecks actor privileges, locks the target and rejects stale state.
  const { data: result, error } = await db.rpc("kol_update_managed_access_v1", {
    p_actor: actorId, p_target: targetId, p_command: command,
    p_next_role: command === "change_role" ? nextRole : null,
    p_reason: reason, p_expected_role: currentRole,
    p_expected_status: profile.status, p_request_id: crypto.randomUUID()
  });
  if (error || result !== "updated") {
    const known = ["denied", "invalid", "protected", "role_family"];
    back(error && known.includes(error.message) ? error.message : "update_failed");
  }
  revalidatePath("/admin/users");
  back("updated");
}
