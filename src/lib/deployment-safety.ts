import { getDataSourceMode } from "@/lib/data/data-source";
import { getPublicSupabaseConfig } from "@/lib/supabase/types";

export type DeploymentEnvironment = "development" | "preview" | "production" | string;

export type DeploymentSafetyReason =
  | "alcohol_module_enabled"
  | "production_requires_supabase"
  | "production_supabase_not_configured";

export type DeploymentSafetySnapshot = {
  environment: DeploymentEnvironment;
  production: boolean;
  dataSourceMode: "mock" | "supabase";
  supabaseConfigured: boolean;
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
  const alcoholModuleEnabled = process.env.ALCOHOL_MODULE_ENABLED === "true";

  if (alcoholModuleEnabled) {
    return {
      environment,
      production,
      dataSourceMode,
      supabaseConfigured,
      alcoholModuleEnabled,
      safe: false,
      reason: "alcohol_module_enabled"
    };
  }

  if (production && dataSourceMode !== "supabase") {
    return {
      environment,
      production,
      dataSourceMode,
      supabaseConfigured,
      alcoholModuleEnabled,
      safe: false,
      reason: "production_requires_supabase"
    };
  }

  if (production && !supabaseConfigured) {
    return {
      environment,
      production,
      dataSourceMode,
      supabaseConfigured,
      alcoholModuleEnabled,
      safe: false,
      reason: "production_supabase_not_configured"
    };
  }

  return {
    environment,
    production,
    dataSourceMode,
    supabaseConfigured,
    alcoholModuleEnabled,
    safe: true
  };
}
