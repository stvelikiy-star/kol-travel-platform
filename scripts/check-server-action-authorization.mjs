// CI guard for every exported action under src/app/actions/**.
// No running application, database, credentials or external requests needed.
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve("src/app/actions");
const failures = [];
let files = 0;
let exportsChecked = 0;
let explicitDemos = 0;
const exemptions = new Map([
  ["shared/action-result.ts:createDemoActionResult", /mode:\s*"demo"/],
  ["auth.ts:signInAction", /signInWithPassword\s*\(/],
  ["auth.ts:signInClientWithEmailAction", /signInWithOtp\s*\(/],
  ["auth.ts:signOutAction", /signOut\s*\(/],
  ["client/onboarding.ts:requestClientAccessAction", /signInWithOtp\s*\(/],
  ["public/intake.ts:submitPublicIntakeRequest", /\.rpc\s*\(\s*["']kol_public_intake_atomic["']/]
]);

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) audit(file);
  }
}

function isExported(node) {
  return Boolean(node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword));
}

function audit(file) {
  files++;
  const source = fs.readFileSync(file, "utf8");
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const relative = path.relative(root, file).replaceAll(path.sep, "/");
  for (const node of tree.statements) {
    let actions = [];
    if (ts.isFunctionDeclaration(node) && isExported(node) && node.name) {
      actions = [{ name: node.name.text, code: node.body?.getText(tree) ?? "" }];
    } else if (ts.isVariableStatement(node) && isExported(node)) {
      actions = node.declarationList.declarations
        .filter(decl => ts.isIdentifier(decl.name) && decl.initializer &&
          (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)))
        .map(decl => ({ name: decl.name.getText(tree), code: decl.initializer.getText(tree) }));
    }
    for (const action of actions) {
      exportsChecked++;
      const id = relative + ":" + action.name;
      const code = action.code;
      const exemption = exemptions.get(id);
      if (exemption) {
        if (!exemption.test(code)) failures.push(id + " missing audited public/auth entrypoint contract");
        if (relative === "public/intake.ts" && (!source.includes("trustedIp(") || !source.includes("formStartedAt"))) {
          failures.push(id + " missing bot/IP guard");
        }
        continue;
      }
      if (/DemoAction$/.test(action.name)) {
        if (/\.(?:insert|update|delete|upsert|rpc|upload)\s*\(/.test(code) ||
            !/return\s+create(?:AiDispatcher|Courier)?DemoActionResult\s*\(/.test(code)) {
          failures.push(id + " demo action unexpectedly writes or lacks demo-only result");
        } else {
          explicitDemos++;
        }
        continue;
      }
      // A role check must be present in the exported action itself. This is a
      // conservative rule: even delegates to deeper write adapters require one.
      const guarded = /\brequire(?:Role|Client|Partner|Courier|Admin|SuperAdmin)\s*\(/.test(code) &&
        /if\s*\(\s*!\s*\w+\.ok\s*(?:\|\||\))/.test(code);
      if (!guarded) failures.push(id + " has no explicit checked-role guard");
    }
  }
}
walk(root);
console.log(JSON.stringify({files, exportedActions: exportsChecked, demoOnly: explicitDemos, failures}, null, 2));
if (failures.length) process.exitCode = 1;
