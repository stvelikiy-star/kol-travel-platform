import { NextResponse, type NextRequest } from "next/server";
import { getDataSourceMode } from "@/lib/data/data-source";
import { getDeploymentSafetySnapshot } from "@/lib/deployment-safety";
import {
  attachRequestId,
  createForwardedRequestHeaders,
  resolveRequestId
} from "@/lib/observability/request-id";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

function createPassThroughResponse(request: NextRequest, requestId: string) {
  const response = NextResponse.next({
    request: {
      headers: createForwardedRequestHeaders(request.headers, requestId)
    }
  });

  return attachRequestId(response, requestId);
}

function createBlockedResponse(requestId: string) {
  return attachRequestId(
    new NextResponse("Service temporarily unavailable.", {
      status: 503,
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }),
    requestId
  );
}

export async function proxy(request: NextRequest) {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  const safety = getDeploymentSafetySnapshot();

  // Health remains reachable so an unsafe deployment can report a safe, generic
  // readiness reason. The route itself returns 503 when safety.safe=false.
  if (request.nextUrl.pathname === "/api/health") {
    return createPassThroughResponse(request, requestId);
  }

  if (!safety.safe) {
    return createBlockedResponse(requestId);
  }

  if (getDataSourceMode() !== "supabase") {
    return createPassThroughResponse(request, requestId);
  }

  return updateSupabaseSession(request, requestId);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
