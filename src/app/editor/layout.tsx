import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

/** A narrowly scoped editor portal; it does not inherit /admin privileges. */
export default async function EditorProtectedLayout({ children }: { children: ReactNode }) {
  const actor = await requireRole(["super_admin", "content_manager"]);
  if (!actor.ok) {
    if (actor.error.code === "not_authenticated") {
      redirect("/login?next=%2Feditor%2Fcontent");
    }
    if (actor.error.code === "profile_not_found") redirect("/profile-required");
    if (actor.error.code === "profile_inactive") redirect("/account-blocked");
    redirect("/not-authorized");
  }
  return children;
}
