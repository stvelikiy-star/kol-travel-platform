// Production build-only proof: verify the configured privileged key against the
// intended KÖL Production Supabase without altering any database records.
// Never log or interpolate the key, response body, or user data.
const isProduction = process.env.VERCEL_ENV === "production";

if (!isProduction) {
  console.log("KÖL privileged production key check: skipped outside Production.");
} else {
  const expectedHost = "sggajelagfonzpovnsiz.supabase.co";
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  let configuredHost = "";
  try {
    const url = new URL(rawUrl || "");
    if (url.protocol === "https:" && !url.username && !url.password &&
        (url.pathname === "/" || url.pathname === "") && !url.search && !url.hash) {
      configuredHost = url.host;
    }
  } catch {
    // A malformed URL is rejected below; do not echo it to logs.
  }

  if (process.env.DATA_SOURCE_MODE !== "supabase" ||
      process.env.KOL_DEMO_ACCESS !== "false" ||
      configuredHost !== expectedHost ||
      !key?.startsWith("sb_secret_") || key.length < 32) {
    console.error("KÖL privileged production key check: invalid environment or project binding.");
    process.exitCode = 1;
  } else {
    try {
      const result = await fetch(`https://${expectedHost}/rest/v1/user_roles?select=id&limit=1`, {
        method: "GET",
        headers: { apikey: key, accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(8000)
      });
      if (!result.ok) {
        console.error(`KÖL privileged production key check: read denied (HTTP ${result.status}).`);
        process.exitCode = 1;
      } else if (!Array.isArray(await result.json())) {
        console.error("KÖL privileged production key check: unexpected read response.");
        process.exitCode = 1;
      } else {
        console.log("KÖL privileged production key check: PASS (read-only, correct project).");
      }
    } catch {
      console.error("KÖL privileged production key check: backend unavailable.");
      process.exitCode = 1;
    }
  }
}
