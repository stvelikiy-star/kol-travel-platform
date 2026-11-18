import fs from "node:fs";
const [file, code] = process.argv.slice(2);
const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean) : [];
const steps = lines.map(line=>{
  const [status,label,source] = line.split("\t");
  return { status, label, source };
});
const failures = steps.filter(x=>x.status!=="PASS");
const report={ status: Number(code)===0 && failures.length===0 ? "PASS" : "FAIL",
  executed:steps.length, passed:steps.length-failures.length, failed:failures.length,
  steps, runner:"disposable_local_supabase",
  restored_17_migration_cloud_baseline:"NOT_VERIFIED",
  live_database:"NOT_TOUCHED" };
console.log("KOL_DISPOSABLE_MIGRATION_REPORT="+JSON.stringify(report));
if(failures.length)process.exitCode=1;
