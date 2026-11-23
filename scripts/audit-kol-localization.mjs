// KÖL localization source audit — all application pages and shared components.
// Exact translations remain the canonical requirement. Reports existing mixed
// script copy without suppressing production builds for unrelated legacy pages.
// Strictly rejects regressions in the P0-reviewed admin pages.
import fs from "node:fs";
import path from "node:path";

const fullReport = process.argv.includes("--full");
const roots = ["src/app", "src/components"];
const priority = new Set([
  "src/app/admin/settings/page.tsx",
  "src/app/admin/ai-dispatcher/page.tsx",
  "src/app/admin/orders/page.tsx",
  "src/app/admin/clients/page.tsx",
  "src/app/owner/page.tsx",
  "src/app/partner/finance/page.tsx",
  "src/app/courier/earnings/page.tsx"
]);
const brandOrTechnical = new Set([
  "KÖL", "AI", "ИИ", "API", "RLS", "RPC", "JWT", "URL", "ID",
  "KGS", "USD", "HTML", "CSS", "HTTP", "CRM", "QR", "SMS",
  "Supabase", "PostgreSQL", "Vercel", "WhatsApp", "Telegram",
  "OAuth", "WiFi", "Wi-Fi", "SKU", "SLA", "web", "online"
]);
const forbidden = [
  /Settings locked/i, /Finance locked/i, /Courier finance locked/i,
  /Browser UI/i, /Safety invariants/i, /Typed allowlist/i,
  /demo-значени/iu, /mock-значени/iu, /event stream/iu,
  /timestamped events/iu, /server workflow/iu, /payout balance/iu
];
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
    const file=path.join(dir,e.name);
    if(e.isDirectory()) return e.name==="i18n"||e.name==="__tests__"||e.name==="ui" ? []:walk(file);
    return file.endsWith(".tsx") ? [file.replaceAll(path.sep,"/")] : [];
  });
}
function pickText(line) {
  const chunks=[];
  for(const match of line.matchAll(/>([^<>]+)</g)) chunks.push(match[1]);
  for(const match of line.matchAll(/(?:placeholder|title|label|description|aria-label|alt)="([^"]+)"/g))chunks.push(match[1]);
  // Ordinary JSX values and user-facing messages may be stored as string literals.
  for(const match of line.matchAll(/(?:"([^"\\]{4,180})"|'([^'\\]{4,180})')/g)){
    const text=match[1]||match[2];
    if(/[А-Яа-яЁё]/u.test(text))chunks.push(text);
  }
  return [...new Set(chunks.filter(x=>/[А-Яа-яЁё]/u.test(x)))];
}
const all=[...new Set(roots.flatMap(walk))].sort();
const report=[];
let hardFailures=0;
for(const file of all) {
  const src=fs.readFileSync(file,"utf8");
  const issues=[];
  src.split("\n").forEach((line,i)=>{
    if(line.trimStart().startsWith("//")||line.trimStart().startsWith("import "))return;
    for(const phrase of pickText(line)){
      const words=[...phrase.matchAll(/[A-Za-z][A-Za-z-]{3,}/g)].map(m=>m[0]);
      const unknown=words.filter(w=>!brandOrTechnical.has(w));
      const banned=forbidden.filter(p=>p.test(phrase));
      if(unknown.length||banned.length)issues.push({line:i+1,text:phrase.slice(0,170),words:unknown});
      if(priority.has(file)&&banned.length)hardFailures++;
    }
  });
  if(issues.length)report.push({path:file,issues:issues.length,examples:fullReport ? issues : issues.slice(0,3)});
}
const pages=all.filter(p=>p.startsWith("src/app/")&&p.endsWith("/page.tsx"));
console.log("KÖL localization audit: "+pages.length+" pages, "+all.length+" TSX source files, "+report.length+" files with potential mixed-language copy.");
console.log(JSON.stringify({files:fullReport ? report : report.slice(0,35),totalIssues:report.reduce((sum,x)=>sum+x.issues,0)},null,2));
if(hardFailures) { console.error("KÖL priority RU copy regression: "+hardFailures+" forbidden expressions."); process.exitCode=1; }
