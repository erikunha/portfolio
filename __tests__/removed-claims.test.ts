import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ASK_EVAL_CALIBRATION } from '@/content/ask-eval-calibration';
import { ASK_EVAL_CORPUS } from '@/content/ask-eval-corpus';
import { askFacts } from '@/content/ask-facts';
import { contactCopy } from '@/content/contact-copy';
import { personSchema } from '@/content/seo';
import SHELL_RESPONSES from '@/content/shell-commands';
import { shellUi } from '@/content/shell-ui';
import { SITE_LOCALE } from '@/content/site-locale';
import { SYSTEM_TEXT } from '@/lib/ask/system-prompt';
import { buildJudgeFactSheet } from '@/lib/eval/fact-sheet';
import { HIRING_PROFILE } from '@/lib/hiring-profile';
import { readContentSurfaces } from './helpers/content-surfaces';
import { RETIRED_CLAIMS } from './helpers/retired-claims';

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_TEXT_FILES = [
  'public/llms.txt',
  'public/robots.txt',
  'public/site.webmanifest',
  'public/.well-known/agent.json',
];
const EVAL_FILE_PREFIX = 'content/ask-eval-';
const PROBE_IDS = new Set([
  'edge-visa-sponsorship-not-claimed',
  'edge-relocation-not-claimed',
  'edge-pt-work-permit-not-claimed',
]);

const publicSurfaces = (): Array<[string, string]> =>
  PUBLIC_TEXT_FILES.map((file) => [file, readFileSync(path.join(ROOT, file), 'utf8')]);

const evalSurfaces = (): Array<[string, string]> => [
  ...ASK_EVAL_CORPUS.filter((item) => !PROBE_IDS.has(item.id)).map((item): [string, string] => [
    `ask-eval-corpus:${item.id}`,
    JSON.stringify(item),
  ]),
  ...ASK_EVAL_CALIBRATION.map((item): [string, string] => [
    `ask-eval-calibration:${item.id}`,
    JSON.stringify(item),
  ]),
];

const surfaces = (): Array<[string, string]> => [
  ...readContentSurfaces().filter(([file]) => !file.startsWith(EVAL_FILE_PREFIX)),
  ...publicSurfaces(),
  ...evalSurfaces(),
  ['SYSTEM_TEXT', SYSTEM_TEXT],
  ['askFacts', JSON.stringify(askFacts)],
  ['judge fact sheet', buildJudgeFactSheet(new Date())],
  ['shell canned answers', JSON.stringify(SHELL_RESPONSES)],
  ['shell suggestions and commands', JSON.stringify(shellUi)],
  ['HIRING_PROFILE', JSON.stringify(HIRING_PROFILE)],
  ['personSchema', JSON.stringify(personSchema)],
];

describe('retired claims stay off every published surface', () => {
  it.each(RETIRED_CLAIMS)('publishes no $name', ({ pattern, reason }) => {
    const offenders = surfaces()
      .filter(([, text]) => pattern.test(text))
      .map(([surface]) => surface);
    expect(offenders, reason).toEqual([]);
  });

  it('keeps the ask probes that ask about a retired claim, and only those, exempt', () => {
    const present = ASK_EVAL_CORPUS.filter((item) => PROBE_IDS.has(item.id)).map((item) => item.id);
    expect(
      present.sort(),
      'a probe id with no corpus item exempts nothing and hides a gap',
    ).toEqual([...PROBE_IDS].sort());
  });

  it('publishes a contact fact row for neither a visa nor a relocation', () => {
    for (const locale of Object.values(SITE_LOCALE)) {
      const keys = Object.keys(contactCopy[locale].timezone.facts);
      expect(
        keys.filter((key) => /relocation|visa/i.test(key)),
        'the contact facts list start, mode, type and reply only',
      ).toEqual([]);
    }
  });
});
