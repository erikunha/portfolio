import { describe, expect, it } from 'vitest';
import { buildHeaders, isBehind, parseVersion, readPin } from '../check-tool-pins.mjs';

describe('parseVersion', () => {
  it('parses a bare semver', () => {
    expect(parseVersion('8.30.0')).toEqual([8, 30, 0]);
  });

  it('strips a leading v (gitleaks tags are v8.30.1)', () => {
    expect(parseVersion('v8.30.1')).toEqual([8, 30, 1]);
  });

  it('throws on a non-version so a garbled upstream response cannot be read as "up to date"', () => {
    expect(() => parseVersion('not-a-version')).toThrow();
    expect(() => parseVersion('')).toThrow();
  });
});

describe('isBehind (numeric comparison, not lexical)', () => {
  it('a pin equal to latest is not behind', () => {
    expect(isBehind('8.30.0', '8.30.0')).toBe(false);
  });

  it('a pin one patch back is behind', () => {
    expect(isBehind('8.30.0', '8.30.1')).toBe(true);
  });

  it('8.9.0 is behind 8.30.0 -- the lexical-vs-numeric trap', () => {
    // String comparison would call "8.9.0" > "8.30.0" (because "9" > "3"). It is not.
    expect(isBehind('8.9.0', '8.30.0')).toBe(true);
    expect(isBehind('8.30.0', '8.9.0')).toBe(false);
  });

  it('1.100.0 is NOT behind 1.99.0 -- the other half of the same trap', () => {
    expect(isBehind('1.100.0', '1.99.0')).toBe(false);
    expect(isBehind('1.99.0', '1.100.0')).toBe(true);
  });

  it('a newer major beats any older minor/patch', () => {
    expect(isBehind('1.999.999', '2.0.0')).toBe(true);
    expect(isBehind('2.0.0', '1.999.999')).toBe(false);
  });

  it('the repo semgrep pin (1.97.0) is behind a far-newer PyPI release (1.169.0)', () => {
    expect(isBehind('1.97.0', '1.169.0')).toBe(true);
  });
});

describe('readPin (single source of truth: the pins live in ci.yml)', () => {
  const CI = [
    '        run: |',
    '          pip install "setuptools<81" semgrep==1.97.0',
    '    env:',
    '      GITLEAKS_VERSION: 8.30.0',
  ].join('\n');

  it('reads the gitleaks pin', () => {
    expect(readPin(CI, /GITLEAKS_VERSION:\s*(\d+\.\d+\.\d+)/, 'gitleaks')).toBe('8.30.0');
  });

  it('reads the semgrep pin', () => {
    expect(readPin(CI, /semgrep==(\d+\.\d+\.\d+)/, 'semgrep')).toBe('1.97.0');
  });

  it('throws when the pin cannot be found, rather than reporting a phantom version', () => {
    expect(() => readPin(CI, /NONEXISTENT==(\d+\.\d+\.\d+)/, 'ghost')).toThrow(/ghost/);
  });
});

describe('buildHeaders (the token reaches GitHub and nothing else)', () => {
  const GH = 'https://api.github.com/repos/gitleaks/gitleaks/releases/latest';
  const PYPI = 'https://pypi.org/pypi/semgrep/json';
  const TOKEN = 'ghs_secrettokenvalue';

  it('sends Authorization to api.github.com when a token is set', () => {
    expect(buildHeaders(GH, TOKEN).Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('NEVER sends Authorization to PyPI, even with a token set', () => {
    expect(
      buildHeaders(PYPI, TOKEN).Authorization,
      'The GITHUB_TOKEN must be scoped to the GitHub host. Sending it to PyPI (or any non-GitHub URL) would leak the credential to a third party over the network.',
    ).toBeUndefined();
  });

  it('sends no Authorization when no token is available (local runs, unauthenticated)', () => {
    expect(buildHeaders(GH, undefined).Authorization).toBeUndefined();
    expect(buildHeaders(GH, '').Authorization).toBeUndefined();
  });

  it('always sets a User-Agent (GitHub rejects requests without one)', () => {
    expect(buildHeaders(GH, TOKEN)['User-Agent']).toBeTruthy();
    expect(buildHeaders(PYPI, undefined)['User-Agent']).toBeTruthy();
  });
});
