// A key-shaped literal. The rule is a pattern, so it fires on the shape.
// The value is the one fake Stripe token this repository already owns and
// allowlists by value (.gitleaks.toml): the secret scan reads git history, so a
// probe that planted a NEW key shape would red the gitleaks job on this commit.
export const STRIPE_KEY = 'sk_test_51HxFakeFixtureTokenABCDEFGHIJ';
