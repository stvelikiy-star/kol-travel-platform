import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = {
  register: "src/app/register/page.tsx",
  action: "src/app/actions/client/onboarding.ts",
  callback: "src/app/auth/callback/route.ts",
  clientData: "src/lib/data/client-onboarding-supabase.ts",
  migration: "supabase/schema/024_client_onboarding_atomic_DRAFT_NOT_APPLIED.sql"
};

function read(name) {
  const relative = files[name];
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) throw new Error(`${relative} is missing`);
  return fs.readFileSync(absolute, "utf8");
}

const register = read("register");
const action = read("action");
const callback = read("callback");
const clientData = read("clientData");
const migration = read("migration");

const required = [
  ["register form", register, "requestClientAccessAction"],
  ["passwordless Auth", action, "signInWithOtp"],
  ["user creation opt-in", action, "shouldCreateUser: true"],
  ["pending onboarding cookie", action, "kol_client_onboarding"],
  ["callback exchange", callback, "exchangeCodeForSession"],
  ["callback onboarding", callback, "completeClientOnboarding"],
  ["callback cookie fallback", callback, "pending.fullName"],
  ["RPC call", clientData, 'rpc("client_onboarding_complete_atomic"'],
  ["migration function", migration, "client_onboarding_complete_atomic"],
  ["migration not-applied marker", migration, "DRAFT / NOT APPLIED"],
  ["authenticated-only grant", migration, "grant execute on function public.client_onboarding_complete_atomic"]
];

for (const [label, source, needle] of required) {
  if (!source.includes(needle)) throw new Error(`${label} check failed: ${needle}`);
}

if (/name=["']password["']|type=["']password["']/.test(register)) {
  throw new Error("register page must not ask for a password");
}

if (migration.includes("grant execute on function public.client_onboarding_complete_atomic") && !migration.includes("revoke all on function public.client_onboarding_complete_atomic")) {
  throw new Error("public onboarding RPC must be explicitly revoked before authenticated grant");
}

if (action.includes("service_role") || clientData.includes("service_role") || callback.includes("service_role")) {
  throw new Error("client onboarding must not use service_role credentials");
}

console.log("Client onboarding checks: PASS");
console.log("- passwordless email link flow is wired");
console.log("- registration page has no password field");
console.log("- callback completes the profile through the RPC");
console.log("- migration is present and explicitly marked DRAFT / NOT APPLIED");
