// FIXTURE: deliberately vulnerable. Excluded from the real scan via .semgrepignore.
// Exists only to prove the Semgrep wrapper produces a finding. Never imported.
import { exec } from 'node:child_process';

// Hardcoded secret — the secrets ruleset must flag this token shape.
// Uses the sk_test_ prefix: Semgrep flags it, but GitHub push-protection does
// NOT block test keys (unlike sk_live_), so it is safe to commit. The vendored
// rule keys on sk_(live|test)_ so it still catches a real sk_live_ leak too.
const STRIPE_KEY = 'sk_test_51HxFakeFixtureTokenABCDEFGHIJ';

export function runUserCommand(userInput: string): void {
  // Command-injection sink: untrusted input concatenated into a shell command.
  exec(`ls ${userInput}`, () => {
    void STRIPE_KEY;
  });
}
