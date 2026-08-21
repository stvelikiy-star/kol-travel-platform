import type { ReactNode } from "react";
import { protectRoute } from "@/lib/auth/route-guards";

export const dynamic = "force-dynamic";

export default async function OwnerProtectedLayout({ children }: { children: ReactNode }) {
  await protectRoute("owner", "/owner");
  return children;
}
