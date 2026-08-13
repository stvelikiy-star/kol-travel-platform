import { getCurrentSession } from "@/lib/auth/session";
import { getServerSupabaseConfig } from "@/lib/supabase/types";

export type AuthenticatedRestConfig = {
  restUrl: string;
  apiKey: string;
  accessToken: string;
  userId: string;
};

export async function getAuthenticatedRestConfig(): Promise<AuthenticatedRestConfig | null> {
  const session = await getCurrentSession();
  const config = getServerSupabaseConfig();

  if (!session.ok || !session.data.accessToken || !config.url || !config.publicKey) {
    return null;
  }

  return {
    restUrl: `${config.url.replace(/\/$/, "")}/rest/v1`,
    apiKey: config.publicKey,
    accessToken: session.data.accessToken,
    userId: session.data.id
  };
}

export function getAuthenticatedRestHeaders(config: AuthenticatedRestConfig) {
  return {
    accept: "application/json",
    apikey: config.apiKey,
    authorization: `Bearer ${config.accessToken}`
  };
}
