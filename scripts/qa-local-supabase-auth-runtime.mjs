import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const playwrightModule = process.env.KOL_PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(playwrightModule);

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
const ROOM_ID = "42000000-0000-0000-0000-000000000001";
const TOUR_ID = "40000000-0000-0000-0000-000000000001";
const TOUR_SCHEDULE_ID = "45000000-0000-0000-0000-000000000001";
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

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
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

function queryDbScalar(sql, label = "database query") {
  try {
    return execFileSync(
      "psql",
      [localDbUrl, "-X", "-tA", "-v", "ON_ERROR_STOP=1", "-c", sql],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    ).trim();
  } catch (error) {
    const stderr = error?.stderr ? String(error.stderr).trim() : "";
    throw new Error(`${label}: ${stderr || errorMessage(error)}`);
  }
}

function queryDbRows(sql, label = "database rows") {
  const payload = queryDbScalar(
    `select coalesce(json_agg(row_to_json(q)), '[]'::json)::text from (${sql}) as q`,
    label
  );
  try {
    return JSON.parse(payload || "[]");
  } catch {
    throw new Error(`${label}: invalid JSON result`);
  }
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

async function assertOnlyOwnRow(client, table, userId, label) {
  const { data, error } = await client.from(table).select("user_id");
  assertNoError(label, error);
  if (!Array.isArray(data) || data.length !== 1 || data[0]?.user_id !== userId) {
    const visibleIds = Array.isArray(data) ? data.map((row) => row?.user_id).filter(Boolean).join(",") : "invalid result";
    throw new Error(`${label}: expected RLS to expose only the caller row, got ${visibleIds || "no rows"}`);
  }
}

async function assertIdentityIsolation(client, userId, label) {
  await assertOnlyOwnRow(client, "user_profiles", userId, `${label} user_profiles isolation`);
  await assertOnlyOwnRow(client, "user_roles", userId, `${label} user_roles isolation`);
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
  await assertIdentityIsolation(client, users.get("client"), "client");
  await assertOnlyOwnRow(client, "client_profiles", users.get("client"), "client own-only profile RLS");
  await assertNoRows(client, "partner_profiles", "client cannot read partner profiles");
  await client.auth.signOut({ scope: "local" });

  const partner = await signInForRls(partnerSpec);
  await assertIdentityIsolation(partner, users.get("partner"), "partner");
  await assertOnlyOwnRow(partner, "partner_profiles", users.get("partner"), "partner own-only profile RLS");
  await assertNoRows(partner, "client_profiles", "partner cannot read client profiles");
  await partner.auth.signOut({ scope: "local" });

  const courier = await signInForRls(courierSpec);
  await assertIdentityIsolation(courier, users.get("courier"), "courier");
  await assertOnlyOwnRow(courier, "courier_profiles", users.get("courier"), "courier own-only profile RLS");
  await assertNoRows(courier, "partner_profiles", "courier cannot read partner profiles");
  await courier.auth.signOut({ scope: "local" });

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
  await adminClient.auth.signOut({ scope: "local" });

  console.log("Local Supabase authenticated RLS matrix: PASS");
}

async function loginBrowserPage(page, spec, nextPath) {
  await page.goto(`${appBaseUrl}/login?next=${encodeURIComponent(nextPath)}`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill(spec.email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await Promise.all([
    page.waitForURL((url) => url.pathname === nextPath, { timeout: 15000 }),
    page.locator('button[type="submit"]').click()
  ]);
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
      await loginBrowserPage(page, spec, spec.route);
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

function extractBookingId(text, label) {
  const match = text.match(/\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i);
  if (!match) throw new Error(`${label}: booking id not found in success state`);
  return match[1];
}

function assertBookingRow(row, expected, label) {
  if (!row) throw new Error(`${label}: booking row not found`);
  for (const [key, value] of Object.entries(expected)) {
    assertEqual(row[key], value, `${label} ${key}`);
  }
}

function assertInitialHistory(bookingId, clientId, reason, label) {
  const rows = queryDbRows(
    `select changed_by::text as changed_by, from_status, to_status, reason from public.booking_status_history where booking_id = ${sqlLiteral(bookingId)}::uuid order by created_at, id`,
    `${label} history query`
  );
  const initial = rows.find((row) => row.reason === reason);
  if (!initial) throw new Error(`${label}: initial history event missing`);
  assertEqual(initial.changed_by, clientId, `${label} history changed_by`);
  assertEqual(initial.from_status, null, `${label} history from_status`);
  assertEqual(initial.to_status, "pending", `${label} history to_status`);
}

async function assertGuestStayBookingDenied(stayStart, stayEnd) {
  const beforeCount = Number(queryDbScalar("select count(*) from public.bookings", "guest booking pre-count"));
  const beforeInventory = Number(
    queryDbScalar(
      `select available_count from public.room_availability where room_id = ${sqlLiteral(ROOM_ID)}::uuid and date = ${sqlLiteral(stayStart)}::date`,
      "guest booking pre-inventory"
    )
  );

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${appBaseUrl}/stays/demo-guest-house`, { waitUntil: "domcontentloaded" });
    await page.getByLabel("Заезд", { exact: true }).fill(stayStart);
    await page.getByLabel("Выезд", { exact: true }).fill(stayEnd);
    await page.getByLabel("Гостей", { exact: true }).fill("1");
    await page.getByRole("button", { name: "Забронировать", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Для бронирования войдите в аккаунт KÖL." }).waitFor({ timeout: 10000 });
    await context.close();
  } finally {
    await browser.close();
  }

  const afterCount = Number(queryDbScalar("select count(*) from public.bookings", "guest booking post-count"));
  const afterInventory = Number(
    queryDbScalar(
      `select available_count from public.room_availability where room_id = ${sqlLiteral(ROOM_ID)}::uuid and date = ${sqlLiteral(stayStart)}::date`,
      "guest booking post-inventory"
    )
  );
  assertEqual(afterCount, beforeCount, "guest booking must not create booking row");
  assertEqual(afterInventory, beforeInventory, "guest booking must not decrement inventory");
  console.log("Guest real Stay booking fail-closed: PASS");
}

async function assertAuthenticatedBookingRuntime(users) {
  const clientSpec = roleSpecs.find((spec) => spec.key === "client");
  const clientId = users.get("client");
  const stayStart = queryDbScalar("select (current_date + 7)::text", "stay fixture start date");
  const stayEnd = queryDbScalar("select (current_date + 8)::text", "stay fixture end date");
  const tourDate = queryDbScalar("select (current_date + 8)::text", "tour fixture date");

  await assertGuestStayBookingDenied(stayStart, stayEnd);

  const stayInventoryBefore = Number(
    queryDbScalar(
      `select available_count from public.room_availability where room_id = ${sqlLiteral(ROOM_ID)}::uuid and date = ${sqlLiteral(stayStart)}::date`,
      "stay inventory before browser booking"
    )
  );
  const stayServerPrice = Number(
    queryDbScalar(
      `select coalesce(ra.price_override, r.price_per_night) from public.room_availability ra join public.rooms r on r.id = ra.room_id where ra.room_id = ${sqlLiteral(ROOM_ID)}::uuid and ra.date = ${sqlLiteral(stayStart)}::date`,
      "stay authoritative server price"
    )
  );
  const tourBookedBefore = Number(
    queryDbScalar(
      `select booked_count from public.tour_schedules where id = ${sqlLiteral(TOUR_SCHEDULE_ID)}::uuid`,
      "tour booked count before browser booking"
    )
  );
  const tourServerPrice = Number(
    queryDbScalar(
      `select t.price from public.tour_schedules ts join public.tours t on t.id = ts.tour_id where ts.id = ${sqlLiteral(TOUR_SCHEDULE_ID)}::uuid`,
      "tour authoritative server price"
    )
  );

  const browser = await chromium.launch({ headless: true });
  let stayBookingId;
  let tourBookingId;
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await loginBrowserPage(page, clientSpec, "/stays/demo-guest-house");
    await page.getByRole("heading", { name: "Demo guest house", exact: true, level: 1 }).waitFor({ timeout: 10000 });
    await page.getByLabel("Заезд", { exact: true }).fill(stayStart);
    await page.getByLabel("Выезд", { exact: true }).fill(stayEnd);
    await page.getByLabel("Гостей", { exact: true }).fill("1");
    await page.getByRole("button", { name: "Забронировать", exact: true }).click();
    const stayStatus = page.getByRole("status").filter({ hasText: "Бронь создана. Цена и доступность подтверждены системой." });
    await stayStatus.waitFor({ timeout: 15000 });
    stayBookingId = extractBookingId(await stayStatus.innerText(), "Stay browser booking");

    const stayRows = queryDbRows(
      `select id::text as id, client_id::text as client_id, business_id::text as business_id, booking_type, object_id::text as object_id, start_date::text as start_date, end_date::text as end_date, guests_count, total, status, payment_status, metadata ->> 'idempotency_key' as idempotency_key from public.bookings where id = ${sqlLiteral(stayBookingId)}::uuid`,
      "stay booking DB truth"
    );
    assertBookingRow(stayRows[0], {
      id: stayBookingId,
      client_id: clientId,
      business_id: BUSINESS_ID,
      booking_type: "stay",
      object_id: ROOM_ID,
      start_date: stayStart,
      end_date: stayEnd,
      guests_count: 1,
      total: stayServerPrice,
      status: "pending",
      payment_status: "pending"
    }, "Stay browser booking");
    if (!stayRows[0]?.idempotency_key?.startsWith("kol-stay-")) {
      throw new Error("Stay browser booking: generated idempotency key missing");
    }
    const stayKey = stayRows[0].idempotency_key;
    assertInitialHistory(stayBookingId, clientId, "atomic_stay_booking_created", "Stay browser booking");

    const stayInventoryAfter = Number(
      queryDbScalar(
        `select available_count from public.room_availability where room_id = ${sqlLiteral(ROOM_ID)}::uuid and date = ${sqlLiteral(stayStart)}::date`,
        "stay inventory after browser booking"
      )
    );
    assertEqual(stayInventoryAfter, stayInventoryBefore - 1, "Stay browser booking inventory decrement");

    const stayRetryClient = await signInForRls(clientSpec);
    const { data: stayRetryId, error: stayRetryError } = await stayRetryClient.rpc("create_stay_booking_atomic", {
      p_room_id: ROOM_ID,
      p_start_date: stayStart,
      p_end_date: stayEnd,
      p_guests_count: 1,
      p_idempotency_key: stayKey
    });
    assertNoError("Stay authenticated idempotency retry", stayRetryError);
    assertEqual(stayRetryId, stayBookingId, "Stay authenticated idempotency retry booking id");
    await stayRetryClient.auth.signOut({ scope: "local" });
    const stayInventoryAfterRetry = Number(
      queryDbScalar(
        `select available_count from public.room_availability where room_id = ${sqlLiteral(ROOM_ID)}::uuid and date = ${sqlLiteral(stayStart)}::date`,
        "stay inventory after idempotency retry"
      )
    );
    assertEqual(stayInventoryAfterRetry, stayInventoryAfter, "Stay idempotency retry must not decrement inventory twice");
    assertEqual(
      Number(queryDbScalar(`select count(*) from public.bookings where client_id = ${sqlLiteral(clientId)}::uuid and metadata ->> 'idempotency_key' = ${sqlLiteral(stayKey)}`, "stay idempotency booking count")),
      1,
      "Stay idempotency retry must keep one booking"
    );
    console.log("Authenticated real Stay booking + DB truth + idempotency: PASS");

    await page.goto(`${appBaseUrl}/tours/demo-boat-trip`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Demo boat trip", exact: true, level: 1 }).waitFor({ timeout: 10000 });
    await page.getByLabel("Участников", { exact: true }).fill("2");
    await page.getByRole("button", { name: "Забронировать", exact: true }).click();
    const tourStatus = page.getByRole("status").filter({ hasText: "Бронь тура создана. Цена и количество мест подтверждены системой." });
    await tourStatus.waitFor({ timeout: 15000 });
    tourBookingId = extractBookingId(await tourStatus.innerText(), "Tour browser booking");

    const tourRows = queryDbRows(
      `select id::text as id, client_id::text as client_id, business_id::text as business_id, booking_type, object_id::text as object_id, start_date::text as start_date, end_date::text as end_date, guests_count, total, status, payment_status, metadata ->> 'idempotency_key' as idempotency_key, metadata ->> 'tour_schedule_id' as tour_schedule_id from public.bookings where id = ${sqlLiteral(tourBookingId)}::uuid`,
      "tour booking DB truth"
    );
    assertBookingRow(tourRows[0], {
      id: tourBookingId,
      client_id: clientId,
      business_id: BUSINESS_ID,
      booking_type: "tour",
      object_id: TOUR_ID,
      start_date: tourDate,
      end_date: null,
      guests_count: 2,
      total: tourServerPrice * 2,
      status: "pending",
      payment_status: "pending",
      tour_schedule_id: TOUR_SCHEDULE_ID
    }, "Tour browser booking");
    if (!tourRows[0]?.idempotency_key?.startsWith("kol-tour-")) {
      throw new Error("Tour browser booking: generated idempotency key missing");
    }
    const tourKey = tourRows[0].idempotency_key;
    assertInitialHistory(tourBookingId, clientId, "atomic_tour_booking_created", "Tour browser booking");

    const tourBookedAfter = Number(
      queryDbScalar(
        `select booked_count from public.tour_schedules where id = ${sqlLiteral(TOUR_SCHEDULE_ID)}::uuid`,
        "tour booked count after browser booking"
      )
    );
    assertEqual(tourBookedAfter, tourBookedBefore + 2, "Tour browser booking capacity increment");

    const tourRetryClient = await signInForRls(clientSpec);
    const { data: tourRetryId, error: tourRetryError } = await tourRetryClient.rpc("create_tour_booking_atomic", {
      p_tour_schedule_id: TOUR_SCHEDULE_ID,
      p_participants: 2,
      p_idempotency_key: tourKey
    });
    assertNoError("Tour authenticated idempotency retry", tourRetryError);
    assertEqual(tourRetryId, tourBookingId, "Tour authenticated idempotency retry booking id");
    await tourRetryClient.auth.signOut({ scope: "local" });
    const tourBookedAfterRetry = Number(
      queryDbScalar(
        `select booked_count from public.tour_schedules where id = ${sqlLiteral(TOUR_SCHEDULE_ID)}::uuid`,
        "tour booked count after idempotency retry"
      )
    );
    assertEqual(tourBookedAfterRetry, tourBookedAfter, "Tour idempotency retry must not consume capacity twice");
    assertEqual(
      Number(queryDbScalar(`select count(*) from public.bookings where client_id = ${sqlLiteral(clientId)}::uuid and metadata ->> 'idempotency_key' = ${sqlLiteral(tourKey)}`, "tour idempotency booking count")),
      1,
      "Tour idempotency retry must keep one booking"
    );
    console.log("Authenticated real Tour booking + DB truth + idempotency: PASS");

    await page.goto(`${appBaseUrl}/client/bookings`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Кабинет клиента", exact: true, level: 1 }).waitFor({ timeout: 10000 });
    await page.getByText(stayBookingId, { exact: false }).waitFor({ timeout: 10000 });
    await page.getByText(tourBookingId, { exact: false }).waitFor({ timeout: 10000 });
    console.log("Authenticated Client booking readback UI: PASS");

    await context.close();
  } finally {
    await browser.close();
  }

  console.log("KÖL local authenticated booking browser runtime: PASS");
}

const users = await provisionUsers();
await assertRls(users);
await assertBrowserAuth();
await assertAuthenticatedBookingRuntime(users);
