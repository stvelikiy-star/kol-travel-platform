import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const route = readFileSync("src/app/api/ai/kol-agent/route.ts", "utf8");
const env = readFileSync(".env.example","utf8");
for(const required of [
  "request.cookies.get(SESSION_COOKIE)",
  "requestedSessionId !== boundSessionId",
  "httpOnly: true",
  'sameSite: "strict"',
  "AbortSignal.timeout(8000)",
  "MAX_MESSAGE_LENGTH = 1200",
  'code: "session_forbidden"',
  'code: "message_too_long"',
  'process.env.KOL_AI_AGENT_ENABLED !== "true"'
]) assert(route.includes(required),"Missing AI safety guard: "+required);
assert(!route.includes("body.slice(0, 600)"),"Provider error payload must not be logged");
assert(!route.includes("console.error(\"KOL AI agent error\", error);"),"Full provider exception must not reach logs");
assert(env.includes("KOL_AI_AGENT_ENABLED=false"),"AI must remain off by default");
console.log("KÖL AI session boundary source gate: PASS; real network, distributed rate limiting and abuse E2E still NOT VERIFIED");
