import "server-only";

// Phase 1: staff-only QA. No Production switch exists in this phase.
export function isAssistantPreviewEnabled(): boolean {
  return process.env.VERCEL_ENV === "preview" &&
    process.env.KOL_ASSISTANT_PREVIEW_ENABLED === "true" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ===
      "https://mphruawzozrpwcjgejhs.supabase.co";
}
