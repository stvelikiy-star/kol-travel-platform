import { NextResponse, type NextRequest } from "next/server";
import { getDataSourceMode } from "@/lib/data/data-source";
import { getDeploymentSafetySnapshot } from "@/lib/deployment-safety";
import {
  attachRequestId,
  createForwardedRequestHeaders,
  resolveRequestId
} from "@/lib/observability/request-id";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

const noIndexPrefixes = [
  "/login",
  "/team",
  "/owner",
  "/admin",
  "/partner",
  "/courier",
  "/client",
  "/design-system",
  "/presentation",
  "/account-blocked",
  "/not-authorized",
  "/profile-required"
];

function shouldNoIndex(pathname: string) {
  return noIndexPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function applySecurityHeaders(response: NextResponse, pathname: string) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");

  if (shouldNoIndex(pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
  }

  return response;
}

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
  const pathname = request.nextUrl.pathname;

  // Health remains reachable so an unsafe deployment can report a safe, generic
  // readiness reason. The route itself returns 503 when safety.safe=false.
  if (pathname === "/api/health") {
    return applySecurityHeaders(createPassThroughResponse(request, requestId), pathname);
  }

  if (!safety.safe) {
    return applySecurityHeaders(createBlockedResponse(requestId), pathname);
  }

  if (getDataSourceMode() !== "supabase") {
    return applySecurityHeaders(createPassThroughResponse(request, requestId), pathname);
  }

  const response = await updateSupabaseSession(request, requestId);
  return applySecurityHeaders(response, pathname);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
