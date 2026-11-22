import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

/** A narrowly scoped editor portal; it does not inherit /admin privileges. */
export default async function EditorProtectedLayout({ children }: { children: ReactNode }) {
  const actor = await requireRole(["super_admin", "content_manager"]);
  if (!actor.ok) redirect("/not-authorized");
  return children;
}
