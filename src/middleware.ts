import { NextResponse, type NextRequest } from "next/server";
import { getDataSourceMode } from "@/lib/data/data-source";
import { getDeploymentSafetySnapshot } from "@/lib/deployment-safety";
import {
  attachRequestId,
  createForwardedRequestHeaders,
  resolveRequestId
} from "@/lib/observability/request-id";
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
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  const blocked = deploymentSafetyGate();

  if (blocked) {
    return attachRequestId(blocked, requestId);
  }

  if (getDataSourceMode() !== "supabase") {
    const response = NextResponse.next({
      request: {
        headers: createForwardedRequestHeaders(request.headers, requestId)
      }
    });
    return attachRequestId(response, requestId);
  }

  return updateSupabaseSession(request, requestId);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
