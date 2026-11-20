import path from 'node:path';
import { defineConfig } from 'vitest/config';
import type { Reporter, TestModule } from 'vitest/node';

const ISO_DATE_LENGTH = 10;
const SECOND_MS = 1000;
const FAILED_EXIT_CODE = 1;

export const UNIT_FILE_BUDGET_MS = 45 * SECOND_MS;
const IN_FLIGHT_POLL_MS = 15 * SECOND_MS;

// The thresholds the README states, exported so the documentation and the gate
// cannot drift apart: a threshold lowered here has to be restated there.
export const COVERAGE_THRESHOLDS = {
  lines: 80,
  branches: 70,
  functions: 80,
  statements: 80,
} as const;

interface FileBudgetOptions {
  budgetMs: number;
  pollMs: number;
}

export class FileBudgetReporter implements Reporter {
  private readonly running = new Map<string, { name: string; since: number }>();
  private readonly named = new Set<string>();
  private readonly late: string[] = [];
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly options: FileBudgetOptions) {}

  onTestRunStart(): void {
    this.timer = setInterval(() => this.nameStalled(), this.options.pollMs);
    this.timer.unref();
  }

  onTestModuleStart(module: TestModule): void {
    this.running.set(module.moduleId, { name: module.relativeModuleId, since: Date.now() });
  }

  onTestModuleEnd(module: TestModule): void {
    this.running.delete(module.moduleId);
    const { environmentSetupDuration, prepareDuration, collectDuration, setupDuration, duration } =
      module.diagnostic();
    const total =
      environmentSetupDuration + prepareDuration + collectDuration + setupDuration + duration;
    if (total <= this.options.budgetMs) return;
    this.late.push(
      `${module.relativeModuleId} took ${Math.round(total)}ms, over the ${this.options.budgetMs}ms per-file budget`,
    );
  }

  onTestRunEnd(): void {
    clearInterval(this.timer);
    if (this.late.length === 0) return;
    process.stderr.write(`unit file budget exceeded:\n${this.late.join('\n')}\n`);
    process.exitCode = FAILED_EXIT_CODE;
  }

  private nameStalled(): void {
    const now = Date.now();
    for (const [id, { name, since }] of this.running) {
      if (now - since <= this.options.budgetMs || this.named.has(id)) continue;
      this.named.add(id);
      process.stderr.write(
        `${name} still running after ${now - since}ms, over the ${this.options.budgetMs}ms per-file budget\n`,
      );
    }
  }
}

const DOM_TS_TESTS = [
  '__tests__/api-log-shape.test.ts',
  '__tests__/ask/ask-log-persistence.test.ts',
  '__tests__/boot-animation-advanced.test.ts',
  '__tests__/boot-animation.test.ts',
  '__tests__/boot-slots.test.ts',
  '__tests__/css-paint-cost.test.ts',
  '__tests__/error-bridge-backoff.test.ts',
  '__tests__/error-bridge-events.test.ts',
  '__tests__/error-bridge-session-cap.test.ts',
  '__tests__/error-bridge.test.ts',
  '__tests__/helpers/shell.test.ts',
  '__tests__/is-rendered.test.ts',
  '__tests__/match-media-helper.test.ts',
  '__tests__/motion-bootstrap.test.ts',
  '__tests__/motion.test.ts',
  '__tests__/section-mobile-variants.test.ts',
  '__tests__/skip-to-content.test.ts',
  'components/client/InteractiveShell/ask-request.test.ts',
  'components/client/InteractiveShell/receipt-view.test.ts',
  'components/client/InteractiveShell/reveal-shell.test.ts',
  'components/responsive/MatrixRain/rain-palette.test.ts',
  'components/responsive/SectionNavigation/sectionScroll.test.ts',
  'content/section-registry.test.ts',
  'lib/ask/conversation.test.ts',
  'lib/ask/forget-request.test.ts',
  'lib/ask/forget-request.timeout.test.ts',
  'lib/crt-effect-stepper.test.ts',
  'lib/dom/longest-transition-ms.test.ts',
  'lib/error-bridge.missing-body.test.ts',
  'lib/error-bridge.release.test.ts',
  'lib/frame-governor.test.ts',
  'lib/in-view.test.ts',
  'lib/pause-when-hidden.test.ts',
  'lib/report-client-error.digest.test.ts',
  'lib/request-refs.test.ts',
  'lib/section-spy.test.ts',
] as const;

const EXCLUDED = [
  '**/node_modules/**',
  '**/tests/a11y/**',
  '**/tests/e2e/**',
  '**/tests/visual/**',
  '**/.claude/**',
  '**/.worktrees/**',
];

export default defineConfig({
  test: {
    env: { BUILD_DATE: new Date().toISOString().slice(0, ISO_DATE_LENGTH) },
    reporters: [
      ...(process.env.GITHUB_ACTIONS ? ['github-actions' as const] : []),
      'verbose',
      new FileBudgetReporter({ budgetMs: UNIT_FILE_BUDGET_MS, pollMs: IN_FLIGHT_POLL_MS }),
    ],
    globals: false,
    globalSetup: ['./tests/global-tmpdir.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          setupFiles: ['./tests/mocks/rtl-setup.ts'],
          include: ['**/*.test.tsx', ...DOM_TS_TESTS],
          exclude: EXCLUDED,
        },
      },
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['**/*.test.{ts,mjs}'],
          exclude: [...EXCLUDED, ...DOM_TS_TESTS],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      thresholds: {
        ...COVERAGE_THRESHOLDS,
      },
      include: ['lib/**', 'components/**', 'app/**', 'design-system/components/**'],
      exclude: [
        '**/node_modules/**',
        '**/__tests__/**',
        '**/tests/**',
        '**/content/**',
        '**/*.test.*',
        '**/*.spec.*',
        '**/index.ts',
        '**/*.e2e.ts',
        '**/*.module.css',
        '**/*.mjs',
        '**/*.md',
        '**/*.mdx',
      ],
      reportsDirectory: 'coverage',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
      'server-only': path.resolve(import.meta.dirname, 'tests/mocks/server-only.ts'),
    },
  },
});
