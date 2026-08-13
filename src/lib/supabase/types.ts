export type SupabaseRuntimeConfig = {
  url?: string;
  anonKey?: string;
  publishableKey?: string;
  publicKey?: string;
  serviceRoleKey?: string;
  isConfigured: boolean;
};

export type SupabasePlaceholderClient = {
  isConfigured: false;
  reason: string;
};

function getConfiguredPublicKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY
  );
}

export function getPublicSupabaseConfig(): SupabaseRuntimeConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  const publicKey = getConfiguredPublicKey();

  return {
    url,
    anonKey,
    publishableKey,
    publicKey,
    isConfigured: Boolean(url && publicKey)
  };
}

export function getServerSupabaseConfig(): SupabaseRuntimeConfig {
  const publicConfig = getPublicSupabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return {
    ...publicConfig,
    serviceRoleKey
  };
}
