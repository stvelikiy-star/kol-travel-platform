// Concurrency and replay checks ONLY against disposable localhost Supabase.
// Intentionally does not obtain/use any remote Supabase credentials.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
const exec = promisify(execFile);
const db = process.env.KOL_DISPOSABLE_DB_URL;
if (!db || process.env.KOL_CONFIRMED_EPHEMERAL_DB !== "true") {
  console.error("NOT VERIFIED: explicitly disposable local DB is required");
  process.exit(2);
}
const u = new URL(db);
if (!["127.0.0.1","localhost","[::1]"].includes(u.hostname) || u.port !== "54322" ||
    !["postgres:", "postgresql:"].includes(u.protocol)) {
  throw new Error("Refusing non-local database endpoint");
}
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const hash = value => createHash("sha256").update(value).digest("hex");
const ipHash = hash("disposable:test:single-ip:" + randomUUID());
const userPhoneHash = id => hash("disposable:test:phone:" + id);
async function sql(query) {
  const { stdout } = await exec("psql", [db, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", query], {
    timeout: 10000, maxBuffer: 1024 * 1024
  });
  return stdout.trim();
}
async function submit(id, phone, ip, fingerprint = hash("payload:" + id), title = "Disposable test request") {
  const request = {
    id, fingerprint, phone, ip,
    query: `select public.kol_public_intake_atomic(
      ${quote(id)}::uuid,'support',${quote(title)},null,
      '{"request_type":"qa_disposable"}'::jsonb,${quote(fingerprint)},
      ${quote(phone)},${quote(ip)})`
  };
  return sql(request.query);
}
const ids = Array.from({ length: 10 }, () => randomUUID());
const concurrent = await Promise.all(ids.map((id, i) => submit(id, userPhoneHash(i), ipHash)));
const accepted = concurrent.filter(value => value === "inserted").length;
const throttled = concurrent.filter(value => value === "rate_limited").length;
if (accepted !== 4 || throttled !== 6) {
  throw new Error("10 concurrent same-IP different-phone submissions bypassed gate: " + concurrent.join(","));
}
if (await sql(`select count(*) from public.support_tickets where request_payload->>'contact_ip_hash'=${quote(ipHash)}`) !== "4") {
  throw new Error("Concurrent gate persisted more than four rows");
}
const changedPhone = await submit(randomUUID(), userPhoneHash("changed"), ipHash);
if (changedPhone !== "rate_limited") throw new Error("Changing phone bypassed IP limit");
const winnerIndex = concurrent.indexOf("inserted");
const original = ids[winnerIndex];
const originalPhone = userPhoneHash(winnerIndex);
const replay = await submit(original, originalPhone, ipHash);
if (replay !== "replay") throw new Error("Lost-network replay did not preserve original ID");
const mismatch = await submit(original, originalPhone, ipHash, hash("modified payload"));
if (mismatch !== "conflict") throw new Error("Changed payload with original ID did not conflict");
if (await sql(`select count(*) from public.support_tickets where id=${quote(original)}::uuid`) !== "1") {
  throw new Error("Lost-network replay persisted duplicate row");
}
let badUuidRejected = false;
try {
  await sql("select public.kol_public_intake_atomic('invalid-uuid'::uuid,'support','test',null,'{}'::jsonb,'"
    + hash("x") + "','" + userPhoneHash("bad") + "','" + ipHash + "')");
} catch { badUuidRejected = true; }
if (!badUuidRejected) throw new Error("Invalid UUID unexpectedly accepted");
const action = fs.readFileSync("src/app/actions/public/intake.ts", "utf8");
if (!action.includes("uuidV4.test(input.requestId)")) throw new Error("Action UUID validation is missing");
console.log(JSON.stringify({
  test: "disposable_public_intake_atomic",
  status: "PASS",
  concurrent: 10,
  accepted,
  rateLimited: throttled,
  phoneRotationDenied: true,
  replayAfterLostResponse: true,
  changedRequestConflict: true,
  invalidUuidRejected: true
}, null, 2));
