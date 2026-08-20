import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  if (process.env.DATA_SOURCE_MODE !== "supabase") {
    return NextResponse.next();
  }

  return updateSupabaseSession(request);
}

export const config = {
  matcher: ["/client/:path*", "/partner/:path*", "/courier/:path*", "/admin/:path*"]
};
