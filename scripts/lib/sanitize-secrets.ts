const GH_TOKEN_PATTERNS = [/gh[psoru]_[A-Za-z0-9]{20,}/g, /github_pat_[A-Za-z0-9_]{20,}/g];

export function sanitizeSecrets(input: string): string {
  let out = input;
  for (const pat of GH_TOKEN_PATTERNS) {
    out = out.replace(pat, '[REDACTED]');
  }
  return out;
}
