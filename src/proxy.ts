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

function cspSourceForSupabase() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return "";
    return url.origin + " " + url.origin.replace(/^https:/, "wss:");
  } catch {
    return "";
  }
}

function reportOnlyCsp(pathname: string) {
  const supabase = cspSourceForSupabase();
  return [
    "default-src 'self'",
    // Next hydration and the preserved static /kol-stage/scene.html use inline JS.
    // Report-only first: tighten using real browser violation reports.
    "script-src 'self' 'unsafe-inline' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co " + supabase,
    "frame-src 'self'",
    "frame-ancestors " + (pathname === "/kol-stage/scene.html" ? "'self'" : "'none'"),
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join("; ");
}

function applySecurityHeaders(response: NextResponse, pathname: string, request: NextRequest) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Content-Security-Policy-Report-Only", reportOnlyCsp(pathname));
  if ((process.env.KOL_DEPLOYMENT_ENV === "production" || process.env.VERCEL_ENV === "production") && request.nextUrl.protocol === "https:") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000");
  }
  // Allow ONLY the approved same-origin animated homepage stage to be embedded.
  // All other routes, especially authenticated workspaces, remain DENY.
  if (pathname === "/kol-stage/scene.html") {
    response.headers.set("X-Frame-Options", "SAMEORIGIN");
    response.headers.set("Content-Security-Policy", "frame-ancestors 'self'");
  } else {
    response.headers.set("X-Frame-Options", "DENY");
  }

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
    return applySecurityHeaders(createPassThroughResponse(request, requestId), pathname, request);
  }

  if (!safety.safe) {
    return applySecurityHeaders(createBlockedResponse(requestId), pathname, request);
  }

  if (getDataSourceMode() !== "supabase") {
    return applySecurityHeaders(createPassThroughResponse(request, requestId), pathname, request);
  }

  const response = await updateSupabaseSession(request, requestId);
  return applySecurityHeaders(response, pathname, request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
