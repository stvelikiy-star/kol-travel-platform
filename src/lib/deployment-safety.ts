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

// Release engineering must flip this only in a reviewed source commit after
// every production read/write adapter, RLS package and runtime gate is proven.
// An environment variable alone must never be able to bypass incomplete code.
export const PRODUCTION_RUNTIME_IMPLEMENTATION_READY = false;

export function getDeploymentEnvironment(): DeploymentEnvironment {
  return process.env.KOL_DEPLOYMENT_ENV ?? process.env.VERCEL_ENV ?? "development";
}

export function getDeploymentSafetySnapshot(): DeploymentSafetySnapshot {
  const environment = getDeploymentEnvironment();
  const production = environment === "production";
  const dataSourceMode = getDataSourceMode();
  const supabaseConfigured = getPublicSupabaseConfig().isConfigured;
  const productionRuntimeReady =
    PRODUCTION_RUNTIME_IMPLEMENTATION_READY &&
    process.env.KOL_PRODUCTION_RUNTIME_READY === "true";
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

  // Supabase URL/key and an env flag are not proof that transactional RPCs,
  // RLS policy package, role profiles and all production adapters are ready.
  if (production && !productionRuntimeReady) {
    return { ...snapshot, safe: false, reason: "production_runtime_not_ready" };
  }

  return { ...snapshot, safe: true };
}
