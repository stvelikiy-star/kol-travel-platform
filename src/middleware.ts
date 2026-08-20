import { NextResponse, type NextRequest } from "next/server";
import { getDataSourceMode } from "@/lib/data/data-source";
import { getPublicSupabaseConfig } from "@/lib/supabase/types";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

function isProductionDeployment() {
  return process.env.VERCEL_ENV === "production" || process.env.KOL_DEPLOYMENT_ENV === "production";
}

function productionSafetyGate() {
  if (!isProductionDeployment()) {
    return null;
  }

  const config = getPublicSupabaseConfig();
  const hasLiveDataSource = getDataSourceMode() === "supabase";

  if (hasLiveDataSource && config.isConfigured) {
    return null;
  }

  return new NextResponse("Service temporarily unavailable.", {
    status: 503,
    headers: {
      "Cache-Control": "no-store, max-age=0"
    }
  });
}

export async function middleware(request: NextRequest) {
  const blocked = productionSafetyGate();
  if (blocked) {
    return blocked;
  }

  if (getDataSourceMode() !== "supabase") {
    return NextResponse.next();
  }

  return updateSupabaseSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
