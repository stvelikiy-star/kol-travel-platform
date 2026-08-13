import type { ReactNode } from "react";
import { protectRoute } from "@/lib/auth/route-guards";

export const dynamic = "force-dynamic";

export default async function PartnerProtectedLayout({ children }: { children: ReactNode }) {
  await protectRoute("partner", "/partner");
  return children;
}
