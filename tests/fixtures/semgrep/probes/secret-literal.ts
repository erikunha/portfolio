// A key-shaped literal. The rule is a pattern, so it fires on the shape.
// The value is the one fake Anthropic key this repository owns and allowlists
// by value (.gitleaks.toml): the secret scan reads git history, so a probe
// that planted a NEW key shape would red the gitleaks job on this commit.
export const ANTHROPIC_KEY =
  'sk-ant-api03-4ISu6Ooxjf89GsKUoIzjzkg8OloU2EGM_77qzvv1Tx8_y0KerI5ZspIdYWiQB-y5S-0KCcFS9IaAuZwNoWGK-2hjmScpJAA';
