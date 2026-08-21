import { getDataSourceMode } from "@/lib/data/data-source";
import { getPublicSupabaseConfig } from "@/lib/supabase/types";

export type DeploymentEnvironment = "development" | "preview" | "production" | string;

export type DeploymentSafetyReason =
  | "alcohol_module_enabled"
  | "production_requires_supabase"
  | "production_supabase_not_configured"
  | "production_runtime_not_ready";

export type DeploymentSafetySnapshot = {
  environment: DeploymentEnvironment;
  production: boolean;
  dataSourceMode: "mock" | "supabase";
  supabaseConfigured: boolean;
  productionRuntimeReady: boolean;
  alcoholModuleEnabled: boolean;
  safe: boolean;
  reason?: DeploymentSafetyReason;
};

export function getDeploymentEnvironment(): DeploymentEnvironment {
  return process.env.KOL_DEPLOYMENT_ENV ?? process.env.VERCEL_ENV ?? "development";
}

export function getDeploymentSafetySnapshot(): DeploymentSafetySnapshot {
  const environment = getDeploymentEnvironment();
  const production = environment === "production";
  const dataSourceMode = getDataSourceMode();
  const supabaseConfigured = getPublicSupabaseConfig().isConfigured;
  const productionRuntimeReady = process.env.KOL_PRODUCTION_RUNTIME_READY === "true";
  const alcoholModuleEnabled = process.env.ALCOHOL_MODULE_ENABLED === "true";

  const snapshot = {
    environment,
    production,
    dataSourceMode,
    supabaseConfigured,
    productionRuntimeReady,
    alcoholModuleEnabled
  };

  if (alcoholModuleEnabled) {
    return { ...snapshot, safe: false, reason: "alcohol_module_enabled" };
  }

  if (production && dataSourceMode !== "supabase") {
    return { ...snapshot, safe: false, reason: "production_requires_supabase" };
  }

  if (production && !supabaseConfigured) {
    return { ...snapshot, safe: false, reason: "production_supabase_not_configured" };
  }

  // Supabase URL/key alone are not proof that transactional RPCs, RLS policy
  // package, role profiles and all production read adapters are ready. Keep
  // production fail-closed until the release audit explicitly enables it.
  if (production && !productionRuntimeReady) {
    return { ...snapshot, safe: false, reason: "production_runtime_not_ready" };
  }

  return { ...snapshot, safe: true };
}
