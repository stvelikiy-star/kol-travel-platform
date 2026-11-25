// This guard is intentionally separate from the workflow job-level guard.
// The cloud scripts hold service-role secrets and must reject manual invocation,
// forks, unreviewed PRs, or an unexpected repository/branch.
const allowedManualRefs = new Set([
  "refs/heads/release/kol-unified-p0-20261120",
  "refs/heads/feat/kol-content-visual-editor-20261123",
  "refs/heads/feat/kol-superadmin-user-access-20261124",
  "refs/heads/release/kol-unified-qa-candidate-20261125"
]);
export function isTrustedKolQaTrigger(env = process.env) {
  if (env.GITHUB_ACTIONS !== "true" ||
      env.GITHUB_REPOSITORY !== "stvelikiy-star/kol-travel-platform" ||
      env.GITHUB_ACTOR !== "stvelikiy-star") return false;
  if (env.GITHUB_EVENT_NAME === "workflow_dispatch") return allowedManualRefs.has(env.GITHUB_REF);
  return env.GITHUB_EVENT_NAME === "pull_request" &&
    env.GITHUB_HEAD_REF === "release/kol-unified-qa-candidate-20261125" &&
    env.GITHUB_REF === "refs/pull/182/merge";
}
