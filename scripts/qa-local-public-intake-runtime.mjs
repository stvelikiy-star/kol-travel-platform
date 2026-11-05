import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const playwrightModule = process.env.KOL_PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(playwrightModule);
const appUrl = process.argv[2] || "";
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const dbUrl = process.env.SUPABASE_LOCAL_DB_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

for (const [value, label] of [[appUrl, "application"], [supabaseUrl, "Supabase"], [dbUrl, "database"]]) {
  const host = new URL(value).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error("Public intake QA refuses non-local " + label + " host.");
  }
}
if (!anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Public intake QA needs local anon and server-only credentials.");
}

function dbScalar(sql) {
  return execFileSync("psql", [dbUrl, "-X", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

const suffix = Date.now().toString(36) + "-" + process.pid;
const name = "QA KOL Intake " + suffix;
const phone = "+996700" + String(Date.now() % 1_000_000).padStart(6, "0");
const browser = await chromium.launch({ headless: true });
let requestId;

try {
  const page = await browser.newPage();
  const clientErrors = [];
  page.on("pageerror", (error) => clientErrors.push(error.message.slice(0, 240)));
  await page.goto(appUrl + "/checkout", { waitUntil: "domcontentloaded" });
  // A pre-hydration click can silently disappear; wait for the Next.js
  // client bundle rather than treating the server-rendered button as ready.
  await page.waitForLoadState("networkidle", { timeout: 15000 });
  await page.getByPlaceholder("Ваше имя *").fill(name);
  await page.getByPlaceholder("Телефон *").fill(phone);
  await page.locator("textarea").first().fill("QA unique order " + suffix);
  await page.getByRole("button", { name: "Отправить заявку" }).click();

  try {
    await page.getByText("Заявка принята.", { exact: true }).waitFor({ timeout: 20000 });
  } catch (error) {
    const feedback = await page.locator('[role="alert"],[role="status"],.border-danger').allTextContents();
    const status = await page.getByRole("button", { name: /Отправить заявку|Отправляем/ }).first().innerText().catch(() => "button unavailable");
    const persisted = dbScalar("select count(*) from public.support_tickets where title like 'Заявка на заказ%' and created_at > now() - interval '5 minutes'");
    let serverStages = [];
    try {
      const logFile = (process.env.RUNNER_TEMP || "/tmp") + "/kol-public-runtime-smoke.log";
      serverStages = readFileSync(logFile, "utf8").split("\n")
        .filter(line => line.includes("KOL public intake backend unavailable"))
        .slice(-5).map(line => line.slice(0, 450));
    } catch {
      serverStages = ["server application log was unavailable"];
    }
    console.error("Public intake QA failure (synthetic only):", JSON.stringify({
      url: page.url(), feedback: feedback.map(x => x.slice(0, 300)),
      submitButton: status, recentTicketCount: persisted, clientErrors, serverStages
    }));
    throw error;
  }
  requestId = (await page.locator("span.font-mono").first().innerText()).trim();
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId)) {
    throw new Error("Public intake confirmation did not include a valid request ID.");
  }

  const row = JSON.parse(dbScalar(`select json_build_object(
    'total',(select count(*) from public.support_tickets where id='${requestId}'::uuid),
    'valid',(select category='order_request' and status='open' and priority='medium'
      and created_by is null and request_payload->'contact'->>'phone'='${phone}'
      and request_payload->>'request_type'='order'
      and request_payload->>'intake_version'='2'
      and length(coalesce(request_payload->>'contact_phone_hash',''))=64
      from public.support_tickets where id='${requestId}'::uuid)
  )::text`));
  if (Number(row.total) !== 1 || row.valid !== true) {
    throw new Error("Public intake browser confirmation did not match the persisted database ticket.");
  }

  const anon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const { data: visible, error: denied } = await anon.from("support_tickets").select("id").eq("id", requestId);
  if (!denied && Array.isArray(visible) && visible.length > 0) {
    throw new Error("Anonymous public intake leaked the private support queue.");
  }

  console.log("Anonymous checkout -> server action -> Supabase ticket persistence -> anon read denied: PASS");
  await page.close();
} finally {
  await browser.close();
}
