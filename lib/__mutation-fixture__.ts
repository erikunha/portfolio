// THROWAWAY — mutation-testing liveness fixture. Deleted in the same plan
// (Task 6). Exists only to prove Stryker produces a SURVIVED mutant for a
// weakly-tested branch and a KILLED mutant once the test asserts the boundary.
// Do NOT import this from any production code.
//
// `sign` is used instead of a clamp because clamp boundaries (`n < 0` vs
// `n <= 0` at n=0) are EQUIVALENT mutants — no test can kill them, so a
// clamp can never reach a clean 100% mutation score. `sign` returns a
// value distinct from its boundary, so every conditional/equality/literal
// mutant is observable and killable, giving a true SURVIVED -> 100% proof.
export function sign(n: number): number {
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}
