import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const secretApiKey = process.env.SECRET_KEY || process.env.SUPABASE_SECRET_KEY || serviceRoleKey;
const jwtSecret = process.env.JWT_SECRET;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const localDbUrl = process.env.SUPABASE_LOCAL_DB_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const appBaseUrl = process.argv[2] || process.env.KOL_LOCAL_APP_BASE_URL;

if (!supabaseUrl || !serviceRoleKey || !secretApiKey || !anonKey || !localDbUrl || !appBaseUrl) {
  throw new Error("Local Auth runtime QA requires Supabase URL, server API key, service-role credential, anon key, local database URL and application base URL.");
}

function assertLocalUrl(value, label) {
  const url = new URL(value);
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error(`Refusing ${label} against non-local host: ${url.hostname}`);
  }
}

assertLocalUrl(supabaseUrl, "Supabase Auth fixture setup");
assertLocalUrl(localDbUrl, "Auth fixture database");
assertLocalUrl(appBaseUrl, "browser Auth runtime QA");

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function createLocalServiceRoleJwt(secret) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: "HS256", typ: "JWT" });
  const payload = base64UrlJson({
    iss: "supabase-demo",
    role: "service_role",
    iat: now,
    exp: now + 60 * 60
  });
  const signingInput = `${header}.${payload}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

function getLocalAuthAdminBearer() {
  if (serviceRoleKey.startsWith("eyJ")) {
    return serviceRoleKey;
  }
  if (!jwtSecret) {
    throw new Error(
      "Local Auth Admin compatibility requires JWT_SECRET when the local service-role credential is opaque."
    );
  }
  return createLocalServiceRoleJwt(jwtSecret);
}

const authAdminBearer = getLocalAuthAdminBearer();
const PASSWORD = "KolLocal!2026Auth";
const BUSINESS_ID = "20000000-0000-0000-0000-000000000001";
const RUN_SUFFIX = String(
  process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT || "1"}`
    : `${Date.now()}-${process.pid}`
).replace(/[^a-zA-Z0-9-]/g, "-");

const roleSpecs = [
  {
    key: "client",
    email: `qa-client-${RUN_SUFFIX}@kol.test`,
    role: "client",
    route: "/client",
    marker: "Кабинет клиента",
    deniedRoute: "/admin"
  },
  {
    key: "partner",
    email: `qa-partner-${RUN_SUFFIX}@kol.test`,
    role: "partner_owner",
    route: "/partner",
    marker: "Кабинет партнёра",
    deniedRoute: "/client"
  },
  {
    key: "courier",
    email: `qa-courier-${RUN_SUFFIX}@kol.test`,
    role: "courier",
    route: "/courier",
    marker: "Кабинет курьера",
    deniedRoute: "/partner"
  },
  {
    key: "admin",
    email: `qa-admin-${RUN_SUFFIX}@kol.test`,
    role: "super_admin",
    route: "/admin",
    marker: "Административный центр",
    deniedRoute: null
  }
];

function errorMessage(error) {
  if (!error) return "unknown error";
  if (typeof error.message === "string" && error.message) return error.message;
  if (typeof error.code === "string" && error.code) return error.code;
  if (typeof error.error_description === "string" && error.error_description) return error.error_description;
  if (typeof error.msg === "string" && error.msg) return error.msg;
  return String(error);
}

function assertNoError(label, error) {
  if (error) {
    throw new Error(`${label}: ${errorMessage(error)}`);
  }
}

function safeAuthErrorBody(value) {
  if (!value || typeof value !== "object") return "no structured error body";
  for (const field of ["message", "msg", "error_description", "error_code", "code", "error"]) {
    if (typeof value[field] === "string" && value[field]) return `${field}=${value[field]}`;
  }
  return `fields=${Object.keys(value).sort().join(",") || "none"}`;
}

async function authAdminRequest(path, { method = "GET", body } = {}) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/admin${path}`, {
    method,
    headers: {
      apikey: secretApiKey,
      Authorization: `Bearer ${authAdminBearer}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    throw new Error(
      `Local GoTrue Admin ${method} ${path} failed with HTTP ${response.status}: ${safeAuthErrorBody(payload)}`
    );
  }

  return payload;
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function insertPublicFixture(spec, userId) {
  const statements = [
    `insert into public.user_profiles (user_id, full_name, email, locale, status) values (${sqlLiteral(userId)}::uuid, ${sqlLiteral(`QA ${spec.key}`)}, ${sqlLiteral(spec.email)}, 'ru', 'active');`,
    `insert into public.user_roles (user_id, role, scope_id, is_active) values (${sqlLiteral(userId)}::uuid, ${sqlLiteral(spec.role)}, ${spec.key === "partner" ? `${sqlLiteral(BUSINESS_ID)}::uuid` : "null"}, true);`
  ];

  if (spec.key === "client") {
    statements.push(
      `insert into public.client_profiles (user_id, default_address) values (${sqlLiteral(userId)}::uuid, 'Local Auth QA client');`
    );
  }

  if (spec.key === "partner") {
    statements.push(
      `insert into public.partner_profiles (user_id, business_id, position) values (${sqlLiteral(userId)}::uuid, ${sqlLiteral(BUSINESS_ID)}::uuid, 'QA owner');`,
      `insert into public.partner_staff (user_id, business_id, role, permissions, is_active) values (${sqlLiteral(userId)}::uuid, ${sqlLiteral(BUSINESS_ID)}::uuid, 'partner_owner', '{}'::jsonb, true);`
    );
  }

  if (spec.key === "courier") {
    statements.push(
      `insert into public.courier_profiles (user_id, vehicle_type, vehicle_number, working_zone, availability_status) values (${sqlLiteral(userId)}::uuid, 'car', 'QA-LOCAL', 'Cholpon-Ata', 'online');`
    );
  }

  if (spec.key === "admin") {
    statements.push(
      `insert into public.admin_profiles (user_id, admin_level, department) values (${sqlLiteral(userId)}::uuid, 'super_admin', 'qa');`
    );
  }

  try {
    execFileSync(
      "psql",
      [localDbUrl, "-X", "-v", "ON_ERROR_STOP=1", "-q"],
      {
        input: `begin;\n${statements.join("\n")}\ncommit;\n`,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"]
      }
    );
  } catch (error) {
    const stderr = error?.stderr ? String(error.stderr).trim() : "";
    throw new Error(`${spec.key} database fixture: ${stderr || errorMessage(error)}`);
  }
}

async function provisionUsers() {
  const users = new Map();

  for (const spec of roleSpecs) {
    const payload = await authAdminRequest("/users", {
      method: "POST",
      body: {
        email: spec.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { name: `QA ${spec.key}`, local_auth_qa: true }
      }
    });
    const user = payload?.user || payload;
    if (!user?.id) {
      throw new Error(`create ${spec.key} Auth user returned no user id`);
    }
    await insertPublicFixture(spec, user.id);
    users.set(spec.key, user.id);
  }

  console.log("Local Supabase Auth fixtures: PASS");
  return users;
}

function createAnonClient() {
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

async function signInForRls(spec) {
  const client = createAnonClient();
  const { data, error } = await client.auth.signInWithPassword({ email: spec.email, password: PASSWORD });
  assertNoError(`${spec.key} RLS sign-in`, error);
  if (!data?.user?.id) {
    throw new Error(`${spec.key} RLS sign-in returned no user`);
  }
  return client;
}

async function assertOwnRow(client, table, userId, label) {
  const { data, error } = await client.from(table).select("user_id").eq("user_id", userId);
  assertNoError(label, error);
  if (!Array.isArray(data) || data.length !== 1 || data[0]?.user_id !== userId) {
    throw new Error(`${label}: expected exactly one own row`);
  }
}

async function assertNoRows(client, table, label) {
  const { data, error } = await client.from(table).select("user_id");
  assertNoError(label, error);
  if (!Array.isArray(data) || data.length !== 0) {
    throw new Error(`${label}: expected RLS to hide all rows, got ${Array.isArray(data) ? data.length : "invalid result"}`);
  }
}

async function assertRls(users) {
  const clientSpec = roleSpecs.find((spec) => spec.key === "client");
  const partnerSpec = roleSpecs.find((spec) => spec.key === "partner");
  const courierSpec = roleSpecs.find((spec) => spec.key === "courier");
  const adminSpec = roleSpecs.find((spec) => spec.key === "admin");

  const client = await signInForRls(clientSpec);
  await assertOwnRow(client, "client_profiles", users.get("client"), "client own profile RLS");
  await assertNoRows(client, "partner_profiles", "client cannot read partner profiles");
  await client.auth.signOut();

  const partner = await signInForRls(partnerSpec);
  await assertOwnRow(partner, "partner_profiles", users.get("partner"), "partner own profile RLS");
  await assertNoRows(partner, "client_profiles", "partner cannot read client profiles");
  await partner.auth.signOut();

  const courier = await signInForRls(courierSpec);
  await assertOwnRow(courier, "courier_profiles", users.get("courier"), "courier own profile RLS");
  await assertNoRows(courier, "partner_profiles", "courier cannot read partner profiles");
  await courier.auth.signOut();

  const adminClient = await signInForRls(adminSpec);
  await assertOwnRow(adminClient, "admin_profiles", users.get("admin"), "admin own profile RLS");
  const { data: partnerRows, error: partnerRowsError } = await adminClient
    .from("partner_profiles")
    .select("user_id,business_id")
    .eq("user_id", users.get("partner"));
  assertNoError("admin partner profile RLS", partnerRowsError);
  if (!Array.isArray(partnerRows) || partnerRows.length !== 1) {
    throw new Error("admin partner profile RLS: expected privileged visibility of partner profile");
  }
  await adminClient.auth.signOut();

  console.log("Local Supabase authenticated RLS matrix: PASS");
}

async function assertBrowserAuth() {
  const browser = await chromium.launch({ headless: true });
  try {
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`${appBaseUrl}/client`, { waitUntil: "domcontentloaded" });
    const guestUrl = new URL(guestPage.url());
    if (guestUrl.pathname !== "/login" || guestUrl.searchParams.get("next") !== "/client") {
      throw new Error(`unauthenticated route guard failed: ${guestPage.url()}`);
    }
    await guestContext.close();
    console.log("Unauthenticated route guard: PASS");

    for (const spec of roleSpecs) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(`${appBaseUrl}/login?next=${encodeURIComponent(spec.route)}`, { waitUntil: "domcontentloaded" });
      await page.locator('input[name="email"]').fill(spec.email);
      await page.locator('input[name="password"]').fill(PASSWORD);

      await Promise.all([
        page.waitForURL((url) => url.pathname === spec.route, { timeout: 15000 }),
        page.locator('button[type="submit"]').click()
      ]);

      await page.getByRole("heading", { name: spec.marker, exact: true, level: 1 }).waitFor({ timeout: 10000 });

      if (spec.deniedRoute) {
        await page.goto(`${appBaseUrl}${spec.deniedRoute}`, { waitUntil: "domcontentloaded" });
        await page.waitForURL((url) => url.pathname === "/not-authorized", { timeout: 10000 });
      }

      console.log(`Browser Auth/session ${spec.key}: PASS`);
      await context.close();
    }
  } finally {
    await browser.close();
  }

  console.log("KÖL local Supabase Auth/session browser runtime: PASS");
}

const users = await provisionUsers();
await assertRls(users);
await assertBrowserAuth();
