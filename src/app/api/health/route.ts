import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getDeploymentSafetySnapshot } from "@/lib/deployment-safety";

export const dynamic = "force-dynamic";

// This tests the PUBLIC REST data path, not privileged database access, JWT
// sessions or transaction RPC readiness. Never put service_role in health checks.
async function probePublicSupabase(): Promise<"reachable" | "unreachable" | "not_configured"> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return "not_configured";
  try {
    const target = new URL(`${url.replace(/\/$/, "")}/rest/v1/partners`);
    target.searchParams.set("select", "id");
    target.searchParams.set("limit", "1");
    const response = await fetch(target, {
      headers: { apikey: key, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(3000)
    });
    return response.ok ? "reachable" : "unreachable";
  } catch {
    return "unreachable";
  }
}

export async function GET() {
  const safety = getDeploymentSafetySnapshot();
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? undefined;
  const requestHeaders = await headers();
  const requestId = requestHeaders.get("x-request-id") ?? undefined;
  const databaseConnectivity =
    safety.dataSourceMode === "supabase"
      ? await probePublicSupabase()
      : "not_checked";
  const ready = safety.safe &&
    (safety.dataSourceMode !== "supabase" || databaseConnectivity === "reachable");

  return NextResponse.json(
    {
      service: "kol-travel-platform",
      status: ready ? "ok" : "blocked",
      environment: safety.environment,
      dataSourceMode: safety.dataSourceMode,
      supabaseConfigured: safety.supabaseConfigured,
      productionRuntimeReady: safety.productionRuntimeReady,
      databaseConnectivity,
      // REST reachability does not claim Auth, RLS or transactional RPC readiness.
      roleSessions: "not_checked",
      transactionRpcs: "not_checked",
      alcoholModuleEnabled: safety.alcoholModuleEnabled,
      reason: safety.reason ?? (!ready ? "supabase_public_read_unavailable" : undefined),
      commit,
      requestId
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}
