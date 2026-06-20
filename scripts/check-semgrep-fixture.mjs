#!/usr/bin/env node
// Semgrep fixture self-test. Proves the content-pinned vendored rules in
// .semgrep/ still fire. A clean tree makes the report-only scan find nothing
// whether the rules work or not, so this scans the fixtures (temp copy, since
// .semgrepignore excludes tests/fixtures/) with --config .semgrep ONLY and
// fails if a vendored rule stopped firing. See DECISIONS.md.
// Plain node (no deps) so the CI semgrep job runs it without pnpm install.

// The two vendored rule ids (from .semgrep/owasp-top-ten.yml and .semgrep/
// secrets.yml). Single update site: if a rule file renames its id, sync here
// and the self-test fails loudly until then (which is correct). Match by
// check_id SUFFIX: Semgrep namespaces a local-config rule id by file path.
export const EXPECTED_RULES = ['child-process-shell-injection', 'hardcoded-stripe-secret-key'];

// Pure. Given Semgrep `results[]`, assert each EXPECTED_RULES id fires on
// vulnerable.ts and clean.ts has zero findings. Returns a tagged verdict.
export function assertExpectedFindings(results) {
  const byFile = new Map(); // fixture basename -> check_id[]
  for (const r of results) {
    const base =
      String(r.path ?? '')
        .split('/')
        .pop() ?? '';
    if (!byFile.has(base)) byFile.set(base, []);
    byFile.get(base).push(String(r.check_id ?? ''));
  }
  const vulnIds = byFile.get('vulnerable.ts') ?? [];
  for (const rule of EXPECTED_RULES) {
    if (!vulnIds.some((id) => id.endsWith(rule))) {
      return {
        ok: false,
        reason: `vulnerable.ts did not trigger expected rule "${rule}" (found: ${vulnIds.join(', ') || 'none'})`,
      };
    }
  }
  const cleanIds = byFile.get('clean.ts') ?? [];
  if (cleanIds.length > 0) {
    return {
      ok: false,
      reason: `clean.ts produced ${cleanIds.length} vendored-rule finding(s), expected 0: ${cleanIds.join(', ')}`,
    };
  }
  return { ok: true };
}
