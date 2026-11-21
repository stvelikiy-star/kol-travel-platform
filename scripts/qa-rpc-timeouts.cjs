/* Regression tests for bounded HTTP RPC calls, without live credentials. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const UUID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const repoRoot = path.resolve(__dirname, "..");
const savedFetch = globalThis.fetch;

function loadSource(relative) {
  const filename = path.join(repoRoot, relative);
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = (specifier) => {
    if (specifier === "@/lib/data/authenticated-read-utils") {
      return {
        getAuthenticatedRestConfig: async () => ({ restUrl: "https://unit.invalid/rest/v1" }),
        getAuthenticatedRestHeaders: () => ({ authorization: "Bearer test" })
      };
    }
    return module.require(specifier);
  };
  loaded._compile(transpiled, filename);
  return loaded.exports;
}

function assertTimeout(init) {
  assert.ok(init.signal instanceof AbortSignal, "RPC should have an AbortSignal");
  assert.equal(init.signal.aborted, false, "RPC signal must not be pre-aborted");
}

test("unsupported delivery and order type are rejected before HTTP", async () => {
  const { createAtomicOrderFromSupabase } = loadSource("src/lib/data/order-write-supabase.ts");
  const input = { businessId: UUID, orderType: "food", deliveryMethod: "delivery",
    items: [{ itemId: OTHER, qty: 1 }], idempotencyKey: "request-1234" };
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("unexpected network call"); };
  try {
    assert.equal((await createAtomicOrderFromSupabase(input)).code, "delivery_not_configured");
    assert.equal((await createAtomicOrderFromSupabase({ ...input, deliveryMethod: "pickup", orderType: "other" })).code, "invalid_order_type");
    assert.equal((await createAtomicOrderFromSupabase({ ...input, deliveryMethod: "pickup", idempotencyKey: "        " })).code, "invalid_idempotency_key");
    assert.equal(calls, 0);
  } finally { globalThis.fetch = savedFetch; }
});

test("order RPC is bounded and returns its validated identifier", async () => {
  const { createAtomicOrderFromSupabase } = loadSource("src/lib/data/order-write-supabase.ts");
  globalThis.fetch = async (url, init) => {
    assert.match(url, /\/rpc\/create_order_atomic$/);
    assertTimeout(init);
    return { ok: true, json: async () => UUID };
  };
  try {
    const r = await createAtomicOrderFromSupabase({ businessId: UUID, orderType: "food",
      deliveryMethod: "pickup", items: [{ itemId: OTHER, qty: 1 }], idempotencyKey: "request-1234" });
    assert.equal(r.ok, true);
    assert.equal(r.orderId, UUID);
  } finally { globalThis.fetch = savedFetch; }
});

test("tour booking RPC is bounded", async () => {
  const { createAtomicTourBookingFromSupabase } = loadSource("src/lib/data/booking-write-supabase.ts");
  globalThis.fetch = async (url, init) => {
    assert.match(url, /\/rpc\/create_tour_booking_atomic$/);
    assertTimeout(init);
    return { ok: true, json: async () => UUID };
  };
  try {
    const r = await createAtomicTourBookingFromSupabase({ tourScheduleId: UUID, participants: 2, idempotencyKey: "request-1234" });
    assert.equal(r.bookingId, UUID);
  } finally { globalThis.fetch = savedFetch; }
});

test("stay inventory and canonical booking RPCs are bounded", async () => {
  const { createAtomicStayBookingFromSupabase } = loadSource("src/lib/data/booking-write-supabase.ts");
  const startDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const endDate = new Date(Date.parse(startDate + "T00:00:00Z") + 86400000).toISOString().slice(0, 10);
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    assertTimeout(init);
    calls++;
    if (url.endsWith("/rpc/get_public_stay_inventory"))
      return { ok: true, json: async () => [{ stay_id: UUID, room_id: OTHER, availability_date: startDate, available_count: 1, availability_status: "available" }] };
    assert.match(url, /\/rpc\/create_stay_booking_atomic$/);
    return { ok: true, json: async () => UUID };
  };
  try {
    const r = await createAtomicStayBookingFromSupabase({ stayId: UUID, roomId: OTHER, startDate, endDate, guestsCount: 2, idempotencyKey: "request-1234" });
    assert.equal(r.bookingId, UUID);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = savedFetch; }
});
