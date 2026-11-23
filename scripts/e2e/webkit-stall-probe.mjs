import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const DEFAULT_ITERATIONS = 12_000;
export const DEFAULT_BASE_URL = 'http://localhost:3000';
export const DEFAULT_PATH = '/links/en';
export const DEFAULT_GOTO_TIMEOUT_MS = 12_000;
export const EXIT_CLEAN = 0;
export const EXIT_STALLED = 1;
export const EXIT_BAD_ARGUMENTS = 2;
export const REQUIRED_PLATFORM = 'linux';
const WAIT_UNTIL = 'domcontentloaded';
const PROGRESS_EVERY = 500;
const FLAG_PREFIX = '--';

const NUMERIC_FLAGS = {
  '--iterations': 'iterations',
  '--goto-timeout': 'gotoTimeoutMs',
};
const TEXT_FLAGS = {
  '--base-url': 'baseUrl',
  '--path': 'path',
};

export function platformError(platform, version) {
  if (platform === REQUIRED_PLATFORM) return undefined;
  return `the probe measures the Linux WebKit build and refuses to run on ${platform}; run it in the mcr.microsoft.com/playwright:v${version}-noble image`;
}

export function parseArguments(argv) {
  const options = {
    iterations: DEFAULT_ITERATIONS,
    baseUrl: DEFAULT_BASE_URL,
    path: DEFAULT_PATH,
    gotoTimeoutMs: DEFAULT_GOTO_TIMEOUT_MS,
  };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (value === undefined || value.startsWith(FLAG_PREFIX)) {
      return { error: `${flag} needs a value` };
    }
    if (flag in NUMERIC_FLAGS) {
      const number = Number(value);
      if (!Number.isInteger(number) || number < 1) {
        return { error: `${flag} needs a positive integer, got ${value}` };
      }
      options[NUMERIC_FLAGS[flag]] = number;
    } else if (flag in TEXT_FLAGS) {
      options[TEXT_FLAGS[flag]] = value;
    } else {
      return { error: `unknown argument ${flag}` };
    }
  }
  return { options };
}

export function summarize(navigations, stalls) {
  return {
    navigations,
    stalls: stalls.length,
    stallEvery: stalls.length === 0 ? null : Math.round(navigations / stalls.length),
    verdict: stalls.length === 0 ? 'clean' : 'stalled',
    details: stalls,
  };
}

export async function runProbe(options, launchBrowser) {
  const browser = await launchBrowser();
  const stalls = [];
  try {
    for (let count = 1; count <= options.iterations; count += 1) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const startedAt = Date.now();
      try {
        await page.goto(`${options.baseUrl}${options.path}`, {
          waitUntil: WAIT_UNTIL,
          timeout: options.gotoTimeoutMs,
        });
      } catch (error) {
        stalls.push({
          navigation: count,
          waitedMs: Date.now() - startedAt,
          pageUrl: page.url(),
          message: error instanceof Error ? error.message.split('\n')[0] : String(error),
        });
      }
      await context.close();
      if (count % PROGRESS_EVERY === 0) {
        process.stderr.write(
          `${count}/${options.iterations} navigations, ${stalls.length} stalls\n`,
        );
      }
    }
  } finally {
    await browser.close();
  }
  return summarize(options.iterations, stalls);
}

async function main() {
  const parsed = parseArguments(process.argv.slice(2));
  if (parsed.error) {
    process.stderr.write(`${parsed.error}\n`);
    process.exit(EXIT_BAD_ARGUMENTS);
  }
  const { version } = createRequire(import.meta.url)('@playwright/test/package.json');
  const unsupported = platformError(process.platform, version);
  if (unsupported) {
    process.stderr.write(`${unsupported}\n`);
    process.exit(EXIT_BAD_ARGUMENTS);
  }
  const { webkit } = await import('@playwright/test');
  const summary = await runProbe(parsed.options, () => webkit.launch());
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  process.exit(summary.stalls === 0 ? EXIT_CLEAN : EXIT_STALLED);
}

const entry = process.argv[1];
if (entry && realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url))) {
  await main();
}
