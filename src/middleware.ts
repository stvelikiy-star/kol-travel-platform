import { NextResponse, type NextRequest } from "next/server";
import { getDataSourceMode } from "@/lib/data/data-source";
import { getDeploymentSafetySnapshot } from "@/lib/deployment-safety";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

function deploymentSafetyGate() {
  const safety = getDeploymentSafetySnapshot();

  if (safety.safe) {
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
  const blocked = deploymentSafetyGate();
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
