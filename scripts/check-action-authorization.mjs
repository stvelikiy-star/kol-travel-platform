import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

// Fail closed when any new exported Server Action lacks explicit authorization.
// Public/auth exceptions are exact names, never a wildcard for a directory.
const exceptions = new Map([
  ["src/app/actions/auth.ts", new Set(["signInAction", "signInClientWithEmailAction", "signOutAction"])],
  ["src/app/actions/public/intake.ts", new Set(["issuePublicIntakeFormProof", "submitPublicIntakeRequest"])]
]);
const guardNames = new Set([
  "requireSuperAdmin", "requireAdmin", "requireRole", "requirePartner",
  "requireClient", "requireCourier", "requireOwner"
]);
const root = "src/app/actions";
const errors = [];
const inventory = [];

function visit(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const filename = path.join(dir, ent.name);
    if (ent.isDirectory()) visit(filename);
    else if (/\.(tsx?|mts)$/.test(ent.name)) audit(filename);
  }
}
function modifiers(n) { return n.modifiers ?? []; }
function exported(n) { return modifiers(n).some(m => m.kind === ts.SyntaxKind.ExportKeyword); }
function blockContainsGuard(body) {
  let guarded = false;
  function walk(node) {
    if (ts.isAwaitExpression(node) && ts.isCallExpression(node.expression)) {
      const fn = node.expression.expression;
      if (ts.isIdentifier(fn) && guardNames.has(fn.text)) guarded = true;
    }
    ts.forEachChild(node, walk);
  }
  walk(body);
  // requireRole() must be followed by an authorization decision in action scope.
  return guarded && /\.ok\b/.test(body.getText());
}
function bodyHasMutation(body) {
  return /\.(?:rpc|insert|update|upsert|delete|upload|remove|createUser|signUp)\s*\(|(?:createSupabaseServiceRoleClient|serviceRoleKey)\b/.test(body.getText());
}
function audit(filename) {
  const rel = filename.split(path.sep).join("/");
  const source = fs.readFileSync(filename, "utf8");
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, rel.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  if (ast.parseDiagnostics.length) errors.push(`${rel}: TypeScript parser reported errors`);
  if (!/^\s*["']use server["'];/.test(source)) errors.push(`${rel}: missing file-level use server directive`);
  let exportsFound = 0;
  for (const node of ast.statements) {
    const candidates = [];
    if (ts.isFunctionDeclaration(node) && exported(node) && node.name) {
      candidates.push([node.name.text, node.body]);
    } else if (ts.isVariableStatement(node) && exported(node)) {
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) { errors.push(`${rel}: dynamic exported binding`); continue; }
        const init = decl.initializer;
        if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
          candidates.push([decl.name.text, init.body]);
        } else errors.push(`${rel}: exported non-callable value ${decl.name.text} needs explicit review`);
      }
    } else if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
      errors.push(`${rel}: re-export/assignment needs explicit security audit`);
    }
    for (const [name, body] of candidates) {
      exportsFound++;
      if (!body) { errors.push(`${rel}::${name}: missing body`); continue; }
      const isException = exceptions.get(rel)?.has(name) ?? false;
      const signedPublic = rel === "src/app/actions/public/intake.ts" && name === "submitPublicIntakeRequest";
      if (signedPublic) {
        const s = body.getText();
        if (!s.includes("validIntakeFormProof") || !s.includes("trustedIntakeIp") || !s.includes('rpc("public_intake_create_atomic"')) {
          errors.push(`${rel}::${name}: public intake protection is missing`);
        }
      } else if (isException) {
        if (bodyHasMutation(body) && name !== "signInAction" && name !== "signInClientWithEmailAction" && name !== "signOutAction") {
          errors.push(`${rel}::${name}: exception may not perform privileged writes`);
        }
      } else if (!blockContainsGuard(body)) {
        const explicitlyDemo = source.includes(`@kol-demo-no-write ${name}`);
        if (!explicitlyDemo || bodyHasMutation(body)) {
          errors.push(`${rel}::${name}: missing awaited role guard + authorization decision`);
        }
      }
      inventory.push({ file: rel, action: name, auth: signedPublic ? "signed_public_atomic" : isException ? "auth_or_proof_exception" : "role_guard_required", mutation: bodyHasMutation(body) });
    }
  }
  if (!exportsFound) errors.push(`${rel}: no statically auditable exported actions`);
}
visit(root);
console.log(JSON.stringify({ scannedActions: inventory.length, inventory }, null, 2));
if (errors.length) {
  for (const error of errors) console.error("ACTION_AUTH_FAIL: " + error);
  process.exitCode = 1;
} else console.log(`ACTION_AUTH_PASS: ${inventory.length} exported actions examined`);
