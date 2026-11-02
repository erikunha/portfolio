import { describe, expect, it } from 'vitest';
import {
  buildRegenPlan,
  DEFAULT_UPDATE_MODE,
  listChangedBaselines,
  VISUAL_SPEC,
} from '../scripts/regen-baselines.mjs';

const BASE_URL = 'http://localhost:3000';
const SNAPSHOT_DIR = 'tests/visual/visual.spec.ts-snapshots';

describe('buildRegenPlan', () => {
  it('runs playwright test on the visual spec for the four page browser projects', () => {
    const plan = buildRegenPlan({ baseUrl: BASE_URL, baseEnv: {} });

    expect(plan.args).toEqual([
      'playwright',
      'test',
      VISUAL_SPEC,
      '--project=chromium',
      '--project=chromium-mobile',
      '--project=webkit-desktop',
      '--project=webkit-mobile',
      '--update-snapshots=changed',
    ]);
  });

  it('defaults to the changed update mode', () => {
    const plan = buildRegenPlan({ baseUrl: BASE_URL, baseEnv: {} });

    expect(plan.args).toContain(`--update-snapshots=${DEFAULT_UPDATE_MODE}`);
    expect(plan.args).not.toContain('-g');
  });

  it('scopes a forced rewrite to the grep subject', () => {
    const plan = buildRegenPlan({
      mode: 'all',
      grep: 'hero above-the-fold',
      baseUrl: BASE_URL,
      baseEnv: {},
    });

    expect(plan.args).toEqual([
      'playwright',
      'test',
      VISUAL_SPEC,
      '--project=chromium',
      '--project=chromium-mobile',
      '--project=webkit-desktop',
      '--project=webkit-mobile',
      '--update-snapshots=all',
      '-g',
      'hero above-the-fold',
    ]);
  });

  it('refuses a forced rewrite without a grep subject', () => {
    const build = () => buildRegenPlan({ mode: 'all', baseUrl: BASE_URL, baseEnv: {} });

    expect(build).toThrow(/GREP/);
  });

  it('rejects an unknown update mode', () => {
    const build = () => buildRegenPlan({ mode: 'everything', baseUrl: BASE_URL, baseEnv: {} });

    expect(build).toThrow(/UPDATE_MODE/);
  });

  it('rejects an empty update mode', () => {
    const build = () => buildRegenPlan({ mode: '', baseUrl: BASE_URL, baseEnv: {} });

    expect(build).toThrow(/UPDATE_MODE/);
  });

  it('fails closed without a base URL', () => {
    const build = () => buildRegenPlan({ baseEnv: {} });

    expect(build).toThrow(/E2E_BASE_URL/);
  });

  it('passes the base URL to the Playwright environment', () => {
    const plan = buildRegenPlan({ baseUrl: BASE_URL, baseEnv: { PATH: '/usr/bin' } });

    expect(plan.env.E2E_BASE_URL).toBe(BASE_URL);
    expect(plan.env.PATH).toBe('/usr/bin');
  });
});

describe('listChangedBaselines', () => {
  it('lists the changed PNG paths and skips the other files', () => {
    const output = [
      ` M ${SNAPSHOT_DIR}/hero-chromium-darwin.png`,
      `?? ${SNAPSHOT_DIR}/contact-webkit-mobile-darwin.png`,
      ' M tests/visual/visual.spec.ts',
    ].join('\n');

    expect(listChangedBaselines(output)).toEqual([
      `${SNAPSHOT_DIR}/hero-chromium-darwin.png`,
      `${SNAPSHOT_DIR}/contact-webkit-mobile-darwin.png`,
    ]);
  });

  it('returns nothing when no baseline changed', () => {
    expect(listChangedBaselines(' M tests/visual/visual.spec.ts')).toEqual([]);
  });
});
