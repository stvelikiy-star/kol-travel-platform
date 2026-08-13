import { isSupabaseMode } from "@/lib/data/data-source";

export function isAuthProtectionEnabled() {
  return isSupabaseMode();
}
