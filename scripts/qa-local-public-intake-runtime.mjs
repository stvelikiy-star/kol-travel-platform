import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
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
  let intakePost;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.headers()["next-action"]) {
      intakePost = { url: request.url(), headers: request.headers(), body: request.postData() };
    }
  });
  page.on("pageerror", (error) => clientErrors.push(error.message.slice(0, 240)));
  await page.goto(appUrl + "/checkout", { waitUntil: "domcontentloaded" });
  // A pre-hydration click can silently disappear; wait for the Next.js
  // client bundle rather than treating the server-rendered button as ready.
  await page.waitForLoadState("networkidle", { timeout: 15000 });
  await page.getByPlaceholder("Ваше имя *").fill(name);
  await page.getByPlaceholder("Телефон *").fill(phone);
  await page.locator("textarea").first().fill("QA unique order " + suffix);
  // Wait until the anti-bot minimum dwell-time elapses on this disposable QA form.
  await page.waitForTimeout(3200);
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
      const appLog = readFileSync(logFile, "utf8").split("\n");
      const entries = [];
      for (let i = 0; i < appLog.length; i++) {
        if (!appLog[i].includes("KOL public intake backend unavailable")) continue;
        // Show only bounded stage and PostgREST error code; never log IP, keys or payload.
        const excerpt = appLog.slice(i, i + 10).join("\n");
        const stage = /stage:\s*['"]?([a-z_]+)/.exec(excerpt)?.[1] ?? "unknown";
        const code = /code:\s*['"]?([A-Z0-9_]+)/i.exec(excerpt)?.[1] ?? "unknown";
        entries.push({ stage, code });
      }
      serverStages = entries.slice(-5);
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
      and request_payload->>'intake_version'='3'
      and length(coalesce(request_payload->>'contact_phone_hash',''))=64
      from public.support_tickets where id='${requestId}'::uuid)
  )::text`));
  if (Number(row.total) !== 1 || row.valid !== true) {
    throw new Error("Public intake browser confirmation did not match the persisted database ticket.");
  }

  if (!intakePost?.body || !intakePost.body.includes(name)) {
    throw new Error("Public intake QA did not capture the submitted server action.");
  }
  const replayHeaders = { ...intakePost.headers };
  delete replayHeaders["content-length"];
  const replay = await page.request.post(intakePost.url, {
    headers: replayHeaders, data: intakePost.body
  });
  if (!replay.ok() || !(await replay.text()).includes("Повтор не создан.")) {
    throw new Error("Identical server-action retry did not return idempotent success.");
  }
  const conflict = await page.request.post(intakePost.url, {
    headers: replayHeaders, data: intakePost.body.replace(name, name + " changed")
  });
  if (!conflict.ok() || !(await conflict.text()).includes("Этот идентификатор уже используется")) {
    throw new Error("Conflicting server-action retry was not rejected.");
  }
  const unchanged = dbScalar(`select count(*) from public.support_tickets
    where id='${requestId}'::uuid and request_payload->'contact'->>'name'='${name}'`);
  if (unchanged !== "1") throw new Error("Retries duplicated or changed the persisted ticket.");
  console.log("Identical retry -> one ticket; conflicting retry -> rejection: PASS");

  const anon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const { data: visible, error: denied } = await anon.from("support_tickets").select("id").eq("id", requestId);
  if (!denied && Array.isArray(visible) && visible.length > 0) {
    throw new Error("Anonymous public intake leaked the private support queue.");
  }

  console.log("Anonymous checkout -> server action -> Supabase ticket persistence -> anon read denied: PASS");

  // Keep a single public ticket ID all the way to a real, local GoTrue JWT
  // operator session. No service-role key is passed to the browser or user API.
  const operatorEmail = `qa-public-operator-${suffix}@kol.test`;
  const operatorPassword = "KolOperator!2026-local-only";
  const operatorBearer = (() => {
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (service.startsWith("eyJ")) return service;
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("Missing local JWT_SECRET for disposable GoTrue admin fixture");
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ iss: "supabase-demo", role: "service_role",
      iat: now, exp: now + 3600 })).toString("base64url");
    const sig = createHmac("sha256", secret).update(header + "." + payload).digest("base64url");
    return header + "." + payload + "." + sig;
  })();
  const goTrue = await fetch((supabaseUrl.endsWith("/") ? supabaseUrl.slice(0, -1) : supabaseUrl) + "/auth/v1/admin/users", {
    method: "POST",
    headers: {
      apikey: process.env.SECRET_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: "Bearer " + operatorBearer,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email: operatorEmail, password: operatorPassword, email_confirm: true })
  });
  if (!goTrue.ok) throw new Error("Disposable GoTrue operator provisioning HTTP " + goTrue.status);
  const operatorBody = await goTrue.json();
  const operatorId = operatorBody.user?.id || operatorBody.id;
  if (!/^[a-f0-9-]{36}$/i.test(operatorId || "")) throw new Error("Disposable operator UUID missing");
  dbScalar(`begin;
    insert into public.user_profiles(user_id,full_name,email,locale,status)
    values ('${operatorId}'::uuid,'QA Public Intake Operator','${operatorEmail}','ru','active');
    insert into public.user_roles(user_id,role,scope_id,is_active)
    values ('${operatorId}'::uuid,'support_admin',null,true);
    insert into public.admin_profiles(user_id,admin_level,department)
    values ('${operatorId}'::uuid,'support_admin','QA public intake');
    commit;`);
  const operator = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const { data: session, error: loginError } = await operator.auth.signInWithPassword({
    email: operatorEmail, password: operatorPassword
  });
  if (loginError || !session.session?.access_token) throw new Error("Operator GoTrue JWT login failed");
  const role = JSON.parse(Buffer.from(session.session.access_token.split(".")[1], "base64url").toString()).role;
  if (role !== "authenticated") throw new Error("Operator JWT is not a normal authenticated user");
  const { data: operatorView, error: operatorReadError } =
    await operator.from("support_tickets").select("id,status").eq("id", requestId);
  if (operatorReadError || operatorView?.length !== 1 ||
      operatorView[0].id !== requestId || operatorView[0].status !== "open") {
    throw new Error("Operator JWT cannot read the same public ticket");
  }
  const actionId = "qa-public-intake-operator-" + suffix;
  const { data: taken, error: transitionError } = await operator.rpc("admin_support_lifecycle_atomic", {
    p_ticket_id: requestId, p_action: "status", p_request_id: actionId,
    p_message: null, p_status: "in_progress", p_reason: "Operator accepted test public request"
  });
  if (transitionError || taken?.ok !== true) {
    throw new Error("Operator JWT could not progress same public ticket");
  }
  if (dbScalar(`select status from public.support_tickets where id='${requestId}'::uuid`) !== "in_progress") {
    throw new Error("Operator action did not persist on original public ticket");
  }
  if (dbScalar(`select count(*) from public.audit_logs where entity_id='${requestId}'::uuid
      and request_id='${actionId}'`) !== "1") {
    throw new Error("Operator transition did not create an audit record");
  }
  console.log("Anonymous client -> one public ticket -> operator real GoTrue JWT -> status/audit: PASS");
  await operator.auth.signOut({ scope: "local" });
  await page.close();
} finally {
  await browser.close();
}
