import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const appBaseUrl = process.argv[2] || process.env.KOL_LOCAL_APP_BASE_URL;

if (!supabaseUrl || !serviceRoleKey || !anonKey || !appBaseUrl) {
  throw new Error("Local Auth runtime QA requires Supabase URL, service-role key, anon key and application base URL.");
}

function assertLocalUrl(value, label) {
  const url = new URL(value);
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error(`Refusing ${label} against non-local host: ${url.hostname}`);
  }
}

assertLocalUrl(supabaseUrl, "Supabase Auth fixture setup");
assertLocalUrl(appBaseUrl, "browser Auth runtime QA");

const PASSWORD = "KolLocal!2026Auth";
const BUSINESS_ID = "20000000-0000-0000-0000-000000000001";

const roleSpecs = [
  {
    key: "client",
    email: "qa-client@kol.test",
    role: "client",
    route: "/client",
    marker: "Кабинет клиента",
    deniedRoute: "/admin"
  },
  {
    key: "partner",
    email: "qa-partner@kol.test",
    role: "partner_owner",
    route: "/partner",
    marker: "Кабинет партнёра",
    deniedRoute: "/client"
  },
  {
    key: "courier",
    email: "qa-courier@kol.test",
    role: "courier",
    route: "/courier",
    marker: "Кабинет курьера",
    deniedRoute: "/partner"
  },
  {
    key: "admin",
    email: "qa-admin@kol.test",
    role: "super_admin",
    route: "/admin",
    marker: "Административный центр",
    deniedRoute: null
  }
];

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

function assertNoError(label, error) {
  if (error) {
    throw new Error(`${label}: ${error.message || String(error)}`);
  }
}

async function removePreviousLocalUsers() {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  assertNoError("list local Auth users", error);
  const targetEmails = new Set(roleSpecs.map((spec) => spec.email));
  for (const user of data?.users || []) {
    if (user.email && targetEmails.has(user.email)) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
      assertNoError(`delete stale local Auth user ${user.email}`, deleteError);
    }
  }
}

async function insertPublicFixture(spec, userId) {
  let result = await admin.from("user_profiles").insert({
    user_id: userId,
    full_name: `QA ${spec.key}`,
    email: spec.email,
    locale: "ru",
    status: "active"
  });
  assertNoError(`${spec.key} user_profiles fixture`, result.error);

  result = await admin.from("user_roles").insert({
    user_id: userId,
    role: spec.role,
    scope_id: spec.key === "partner" ? BUSINESS_ID : null,
    is_active: true
  });
  assertNoError(`${spec.key} user_roles fixture`, result.error);

  if (spec.key === "client") {
    result = await admin.from("client_profiles").insert({
      user_id: userId,
      default_address: "Local Auth QA client"
    });
    assertNoError("client_profiles fixture", result.error);
  }

  if (spec.key === "partner") {
    result = await admin.from("partner_profiles").insert({
      user_id: userId,
      business_id: BUSINESS_ID,
      position: "QA owner"
    });
    assertNoError("partner_profiles fixture", result.error);

    result = await admin.from("partner_staff").insert({
      user_id: userId,
      business_id: BUSINESS_ID,
      role: "partner_owner",
      permissions: {},
      is_active: true
    });
    assertNoError("partner_staff fixture", result.error);
  }

  if (spec.key === "courier") {
    result = await admin.from("courier_profiles").insert({
      user_id: userId,
      vehicle_type: "car",
      vehicle_number: "QA-LOCAL",
      working_zone: "Cholpon-Ata",
      availability_status: "online"
    });
    assertNoError("courier_profiles fixture", result.error);
  }

  if (spec.key === "admin") {
    result = await admin.from("admin_profiles").insert({
      user_id: userId,
      admin_level: "super_admin",
      department: "qa"
    });
    assertNoError("admin_profiles fixture", result.error);
  }
}

async function provisionUsers() {
  await removePreviousLocalUsers();
  const users = new Map();

  for (const spec of roleSpecs) {
    const { data, error } = await admin.auth.admin.createUser({
      email: spec.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: `QA ${spec.key}`, local_auth_qa: true }
    });
    assertNoError(`create ${spec.key} Auth user`, error);
    if (!data?.user?.id) {
      throw new Error(`create ${spec.key} Auth user returned no user id`);
    }
    await insertPublicFixture(spec, data.user.id);
    users.set(spec.key, data.user.id);
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

      await page.getByRole("heading", { name: spec.marker, exact: true }).waitFor({ timeout: 10000 });

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
