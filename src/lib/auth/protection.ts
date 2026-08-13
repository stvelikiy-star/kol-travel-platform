import { isSupabaseMode } from "@/lib/data/data-source";

export function isAuthProtectionEnabled() {
  return isSupabaseMode() && process.env.AUTH_PROTECTION_ENABLED === "true";
}
