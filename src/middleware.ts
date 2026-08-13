import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  if (process.env.DATA_SOURCE_MODE !== "supabase" || process.env.AUTH_PROTECTION_ENABLED !== "true") {
    return NextResponse.next();
  }

  return updateSupabaseSession(request);
}

export const config = {
  matcher: ["/client/:path*", "/partner/:path*", "/courier/:path*", "/admin/:path*"]
};
