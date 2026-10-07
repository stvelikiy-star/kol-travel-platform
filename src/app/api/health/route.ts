import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getDeploymentSafetySnapshot } from "@/lib/deployment-safety";
import { getPublicSupabaseConfig } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

async function checkDatabaseConnectivity() {
  const safety = getDeploymentSafetySnapshot();
  if (safety.dataSourceMode === "mock") {
    return { status: "not_applicable" as const };
  }

  const config = getPublicSupabaseConfig();
  if (!config.url || !config.publicKey) {
    return { status: "not_configured" as const };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(`${config.url.replace(/\/$/, "")}/rest/v1/stays?select=id&limit=1`, {
      headers: { apikey: config.publicKey, accept: "application/json" },
      cache: "no-store",
      signal: controller.signal
    });
    return { status: response.ok ? "ok" as const : "failed" as const };
  } catch {
    return { status: "failed" as const };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const safety = getDeploymentSafetySnapshot();
  const database = await checkDatabaseConnectivity();
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? undefined;
  const requestHeaders = await headers();
  const requestId = requestHeaders.get("x-request-id") ?? undefined;

  return NextResponse.json(
    {
      service: "kol-travel-platform",
      status: safety.safe && ["ok", "not_applicable"].includes(database.status) ? "ok" : "blocked",
      environment: safety.environment,
      dataSourceMode: safety.dataSourceMode,
      supabaseConfigured: safety.supabaseConfigured,
      productionRuntimeReady: safety.productionRuntimeReady,
      databaseConnectivity: database.status,
      alcoholModuleEnabled: safety.alcoholModuleEnabled,
      reason: safety.reason,
      commit,
      requestId
    },
    {
      status: safety.safe ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}
