import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getDeploymentSafetySnapshot } from "@/lib/deployment-safety";

export const dynamic = "force-dynamic";

export async function GET() {
  const safety = getDeploymentSafetySnapshot();
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? undefined;
  const requestHeaders = await headers();
  const requestId = requestHeaders.get("x-request-id") ?? undefined;

  return NextResponse.json(
    {
      service: "kol-travel-platform",
      status: safety.safe ? "ok" : "blocked",
      environment: safety.environment,
      dataSourceMode: safety.dataSourceMode,
      supabaseConfigured: safety.supabaseConfigured,
      databaseConnectivity: "not_checked",
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
