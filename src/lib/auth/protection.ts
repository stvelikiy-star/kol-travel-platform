import { isSupabaseMode } from "@/lib/data/data-source";

export function isDemoAccessEnabled() {
  return process.env.KOL_DEMO_ACCESS === "true";
}

export function isAuthProtectionEnabled() {
  return isSupabaseMode() && !isDemoAccessEnabled();
}
