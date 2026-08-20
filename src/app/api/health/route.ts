import { NextResponse } from "next/server";
import { getDeploymentSafetySnapshot } from "@/lib/deployment-safety";

export const dynamic = "force-dynamic";

export async function GET() {
  const safety = getDeploymentSafetySnapshot();
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? undefined;

  return NextResponse.json(
    {
      service: "kol-travel-platform",
      status: safety.safe ? "ok" : "blocked",
      environment: safety.environment,
      dataSourceMode: safety.dataSourceMode,
      supabaseConfigured: safety.supabaseConfigured,
      alcoholModuleEnabled: safety.alcoholModuleEnabled,
      reason: safety.reason,
      commit
    },
    {
      status: safety.safe ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}
