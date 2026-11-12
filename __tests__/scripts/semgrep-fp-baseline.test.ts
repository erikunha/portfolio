import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Probe } from '../../scripts/measure-semgrep-fp.mjs';
import {
  classifyProbes,
  decideExit,
  EXPECTED_KNOWN_FALSE_POSITIVES,
  loadManifest,
} from '../../scripts/measure-semgrep-fp.mjs';

const manifest = loadManifest();

const finding = (file: string, rule: string) => ({
  path: `/tmp/probes/${file}`,
  check_id: `semgrep.rules.${rule}`,
  start: { line: 1 },
});

describe('semgrep false-positive baseline', () => {
  it('declares a probe for every file in the probe set', () => {
    const declared = manifest.probes.map((probe) => probe.file).sort();
    expect(declared).toEqual([
      'secret-literal.ts',
      'secret-placeholder.ts',
      'shell-constant.ts',
      'shell-execfile.ts',
      'shell-execsync.ts',
      'shell-interpolated.ts',
    ]);
  });

  it('reads the probe set from files the manifest names', () => {
    for (const probe of manifest.probes) {
      const src = readFileSync(
        `${process.cwd()}/tests/fixtures/semgrep/probes/${probe.file}`,
        'utf8',
      );
      expect(src.length).toBeGreaterThan(0);
    }
  });

  it('classifies the declared findings as true positives and one known false positive', () => {
    const results = [
      finding('shell-interpolated.ts', 'child-process-shell-injection'),
      finding('shell-constant.ts', 'child-process-shell-injection'),
      finding('secret-literal.ts', 'hardcoded-anthropic-api-key'),
    ];
    const measurement = classifyProbes(results, manifest);
    expect(measurement.truePositives).toHaveLength(2);
    expect(measurement.knownFalsePositives).toHaveLength(1);
    expect(measurement.knownFalsePositives[0]?.file).toBe('shell-constant.ts');
    expect(measurement.falsePositives).toHaveLength(0);
    expect(measurement.falseNegatives).toHaveLength(0);
  });

  it('treats a probe that fires when it is declared quiet as a false positive', () => {
    const results = [finding('shell-execfile.ts', 'child-process-shell-injection')];
    const measurement = classifyProbes(results, manifest);
    expect(measurement.falsePositives).toHaveLength(1);
    expect(measurement.falsePositives[0]?.file).toBe('shell-execfile.ts');
    const decision = decideExit(measurement);
    expect(decision.code).toBe(1);
    expect(decision.level).toBe('FALSE POSITIVE');
  });

  it('treats a probe that stays quiet when it is declared a finding as a rule regression', () => {
    const measurement = classifyProbes([], manifest);
    expect(measurement.falseNegatives).toHaveLength(3);
    const decision = decideExit(measurement);
    expect(decision.code).toBe(1);
    expect(decision.level).toBe('RULE REGRESSION');
  });

  it('fails when the known false positive count moves, because the decision records it', () => {
    // A second probe declared as a known false positive: the rules still
    // behave, the recorded count does not.
    const grown = {
      probes: manifest.probes.map(
        (probe): Probe =>
          probe.file === 'shell-execsync.ts'
            ? {
                file: 'shell-execsync.ts',
                expect: 'finding',
                rule: 'child-process-shell-injection',
                kind: 'known-false-positive',
                why: 'a second declared false positive',
              }
            : probe,
      ),
    };
    const results = [
      finding('shell-interpolated.ts', 'child-process-shell-injection'),
      finding('shell-constant.ts', 'child-process-shell-injection'),
      finding('shell-execsync.ts', 'child-process-shell-injection'),
      finding('secret-literal.ts', 'hardcoded-anthropic-api-key'),
    ];
    const measurement = classifyProbes(results, grown);
    expect(measurement.knownFalsePositives).toHaveLength(2);
    const decision = decideExit(measurement);
    expect(decision.code).toBe(1);
    expect(decision.level).toBe('BASELINE MOVED');
    expect(decision.message).toContain(String(EXPECTED_KNOWN_FALSE_POSITIVES));
  });

  it('reads a known false positive that went quiet as a rule regression, not as a moved baseline', () => {
    const results = [
      finding('shell-interpolated.ts', 'child-process-shell-injection'),
      finding('secret-literal.ts', 'hardcoded-anthropic-api-key'),
    ];
    const measurement = classifyProbes(results, manifest);
    expect(measurement.falseNegatives.map((f) => f.file)).toContain('shell-constant.ts');
    expect(decideExit(measurement).level).toBe('RULE REGRESSION');
  });

  it('fails on a rule that fires where the manifest names another', () => {
    const results = [
      finding('shell-interpolated.ts', 'child-process-shell-injection'),
      finding('shell-interpolated.ts', 'some-other-rule'),
      finding('shell-constant.ts', 'child-process-shell-injection'),
      finding('secret-literal.ts', 'hardcoded-anthropic-api-key'),
    ];
    const measurement = classifyProbes(results, manifest);
    expect(measurement.unexpectedRules).toHaveLength(1);
    expect(decideExit(measurement).code).toBe(1);
  });

  it('fails on a file the manifest does not name', () => {
    const results = [finding('stray-file.ts', 'child-process-shell-injection')];
    const measurement = classifyProbes(results, manifest);
    expect(measurement.unexpectedFiles).toContain('stray-file.ts');
    expect(decideExit(measurement).code).toBe(1);
  });

  it('passes the real probe set, which is what the CI step runs', () => {
    const results = [
      finding('shell-interpolated.ts', 'child-process-shell-injection'),
      finding('shell-constant.ts', 'child-process-shell-injection'),
      finding('secret-literal.ts', 'hardcoded-anthropic-api-key'),
    ];
    const decision = decideExit(classifyProbes(results, manifest));
    expect(decision.code).toBe(0);
    expect(decision.message).toContain('precision=66.7%');
  });
});
