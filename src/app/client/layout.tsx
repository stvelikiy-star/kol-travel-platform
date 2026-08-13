import type { ReactNode } from "react";
import { protectRoute } from "@/lib/auth/route-guards";

export const dynamic = "force-dynamic";

export default async function ClientProtectedLayout({ children }: { children: ReactNode }) {
  await protectRoute("client", "/client");
  return children;
}
