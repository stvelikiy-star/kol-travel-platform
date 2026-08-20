import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { attachRequestId, createForwardedRequestHeaders } from "@/lib/observability/request-id";
import { getPublicSupabaseConfig } from "@/lib/supabase/types";

function createSessionResponse(request: NextRequest, requestId: string) {
  const response = NextResponse.next({
    request: {
      headers: createForwardedRequestHeaders(request.headers, requestId)
    }
  });

  return attachRequestId(response, requestId);
}

export async function updateSupabaseSession(request: NextRequest, requestId: string) {
  const config = getPublicSupabaseConfig();

  if (!config.url || !config.publicKey) {
    return createSessionResponse(request, requestId);
  }

  let response = createSessionResponse(request, requestId);
  const supabase = createServerClient(config.url, config.publicKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = createSessionResponse(request, requestId);
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  // Network-validated user lookup also refreshes the cookie-backed session when needed.
  await supabase.auth.getUser();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
