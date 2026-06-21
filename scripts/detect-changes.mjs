// Runner for the detect-changes job. Plain node, zero deps. Reads the pathspec
// manifest, runs git diff per category, and writes ai/app/ui to $GITHUB_OUTPUT.
// Pure decision helpers (canonicalJSON, computeCategories) are exported and unit
// tested; the git/IO lives in a thin main().

// Pure. Deterministic, whitespace-free JSON with recursively sorted OBJECT keys
// and PRESERVED array order (the node equivalent of `jq -cS`). undefined -> null
// so an absent field is not silently omitted (the omit-vs-null hazard that would
// flip the ui decision).
export function canonicalJSON(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJSON).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJSON(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}
