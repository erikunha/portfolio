# PR B — Primitive Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Prerequisite:** PR A must be merged to `main` before starting this plan. All CSS must use `--ds-*` token names.

**Goal:** Extract 7 reusable primitive components (Button, Field, Badge, TerminalPanel, StatTile, CmdLine, KbdKey) into `design-system/components/`; refactor the portfolio to consume them; all 7 components ship with unit tests, Playwright visual baselines, and zero client JS.

**Architecture:** Components are RSC by default (no `'use client'`). Variants are plain CSS Module classes composed by a `cx()` utility (~20 LoC). Props use TypeScript literal unions for type safety. Each component directory is self-contained: `.tsx`, `.module.css`, `.test.tsx`, `index.ts`. A barrel `design-system/index.ts` re-exports all. Portfolio sections import from `@/design-system`.

**Tech Stack:** React 19 RSC, CSS Modules, TypeScript strict, Vitest + jsdom for unit tests, Playwright for visual regression, pnpm

---

## File Map

**Created:**
- `design-system/lib/cx.ts`
- `design-system/components/Button/{Button.tsx,Button.module.css,Button.test.tsx,index.ts}`
- `design-system/components/Field/{Field.tsx,Field.module.css,Field.test.tsx,index.ts}`
- `design-system/components/Badge/{Badge.tsx,Badge.module.css,Badge.test.tsx,index.ts}`
- `design-system/components/TerminalPanel/{TerminalPanel.tsx,TerminalPanel.module.css,TerminalPanel.test.tsx,index.ts}`
- `design-system/components/StatTile/{StatTile.tsx,StatTile.module.css,StatTile.test.tsx,index.ts}`
- `design-system/components/CmdLine/{CmdLine.tsx,CmdLine.module.css,CmdLine.test.tsx,index.ts}`
- `design-system/components/KbdKey/{KbdKey.tsx,KbdKey.module.css,KbdKey.test.tsx,index.ts}`
- `design-system/index.ts`
- `tests/e2e/design-system-components.spec.ts`

**Modified:**
- `components/sections/Hero.tsx` — adopt Button, Badge, CmdLine
- `components/sections/Hero.module.css` — remove extracted class definitions
- `components/client/ContactForm.tsx` (or `ContactForm.module.css`) — adopt Field
- `components/HeroStats.tsx` — adopt StatTile
- Various section `.tsx` files — adopt TerminalPanel for bordered panel wrappers
- Various section `.tsx` files — adopt KbdKey, CmdLine where applicable

---

## Task 1: cx() utility

**Files:**
- Create: `design-system/lib/cx.ts`

- [ ] **Step 1: Write the test first**

Create `design-system/lib/cx.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { cx } from './cx';

describe('cx', () => {
  it('joins truthy class strings', () => {
    expect(cx('a', 'b', 'c')).toBe('a b c');
  });

  it('filters out falsy values', () => {
    expect(cx('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('returns empty string for all-falsy input', () => {
    expect(cx(false, null, undefined)).toBe('');
  });

  it('handles single value', () => {
    expect(cx('only')).toBe('only');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm test design-system/lib/cx.test.ts
```

Expected: FAIL — `cx` is not exported from `./cx`.

- [ ] **Step 3: Implement `design-system/lib/cx.ts`**

```typescript
export function cx(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm test design-system/lib/cx.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add design-system/lib/cx.ts design-system/lib/cx.test.ts
git commit -m "feat(design-system): add cx() class composition utility"
```

---

## Task 2: Button component

**Files:**
- Create: `design-system/components/Button/Button.tsx`
- Create: `design-system/components/Button/Button.module.css`
- Create: `design-system/components/Button/Button.test.tsx`
- Create: `design-system/components/Button/index.ts`

- [ ] **Step 1: Write the test first**

```typescript
// design-system/components/Button/Button.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders as <button> by default', () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole('button')).toBeDefined();
  });

  it('renders as <a> when as="a"', () => {
    render(<Button as="a" href="/test">Link</Button>);
    expect(screen.getByRole('link')).toBeDefined();
  });

  it('applies disabled state and aria-disabled on anchor', () => {
    render(<Button as="a" href="/test" disabled>Disabled</Button>);
    const el = screen.getByRole('link');
    expect(el.getAttribute('aria-disabled')).toBe('true');
  });

  it('applies primary variant class by default', () => {
    const { container } = render(<Button>Primary</Button>);
    expect(container.firstChild?.classList.toString()).toContain('primary');
  });

  it('applies secondary variant class', () => {
    const { container } = render(<Button variant="secondary">Secondary</Button>);
    expect(container.firstChild?.classList.toString()).toContain('secondary');
  });

  it('applies size classes', () => {
    const { container: smContainer } = render(<Button size="sm">Sm</Button>);
    expect(smContainer.firstChild?.classList.toString()).toContain('sm');
    const { container: lgContainer } = render(<Button size="lg">Lg</Button>);
    expect(lgContainer.firstChild?.classList.toString()).toContain('lg');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm test design-system/components/Button/Button.test.tsx
```

Expected: FAIL — Button component not found.

- [ ] **Step 3: Write `Button.tsx`**

```typescript
// design-system/components/Button/Button.tsx
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonBaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

type AsButton = ButtonBaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { as?: 'button' };

type AsAnchor = ButtonBaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { as: 'a'; disabled?: boolean };

type ButtonProps = AsButton | AsAnchor;

export function Button({
  variant = 'primary',
  size = 'md',
  as = 'button',
  className,
  ...rest
}: ButtonProps) {
  const classes = cx(styles.root, styles[variant], styles[size], className);

  if (as === 'a') {
    const { disabled, ...anchorRest } = rest as AsAnchor;
    return (
      <a
        className={classes}
        aria-disabled={disabled ? 'true' : undefined}
        {...anchorRest}
      />
    );
  }

  return <button type="button" className={classes} {...(rest as AsButton)} />;
}
```

- [ ] **Step 4: Write `Button.module.css`**

```css
.root {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 14px;
  border: 1px solid var(--ds-color-signal-subtle);
  font-size: var(--ds-font-size-body);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition:
    box-shadow var(--ds-duration-base) var(--ds-ease-out),
    background var(--ds-duration-base) var(--ds-ease-out);
  text-decoration: none;
}

.root:focus-visible {
  outline: 2px solid var(--ds-color-signal);
  outline-offset: 2px;
}

.root[aria-disabled='true'],
.root:disabled {
  opacity: 0.4;
  pointer-events: none;
}

/* Variants */
.primary {
  background: var(--ds-color-signal);
  color: var(--ds-color-surface-base);
  border-color: var(--ds-color-signal);
}

.primary:hover {
  box-shadow: 0 0 12px var(--ds-color-signal);
}

.secondary {
  background: transparent;
  color: var(--ds-color-signal);
}

.secondary:hover {
  box-shadow: 0 0 12px var(--ds-color-signal);
  background: var(--ds-color-signal-quiet);
}

/* Sizes */
.sm {
  min-height: 36px;
}

.md {
  min-height: 44px;
}

.lg {
  min-height: 52px;
}
```

- [ ] **Step 5: Write `index.ts`**

```typescript
export { Button } from './Button';
```

- [ ] **Step 6: Run the test and verify it passes**

```bash
pnpm test design-system/components/Button/Button.test.tsx
```

Expected: 6 tests pass.

- [ ] **Step 7: Commit**

```bash
git add design-system/components/Button/
git commit -m "feat(design-system): add Button primitive component"
```

---

## Task 3: Field component

**Files:**
- Create: `design-system/components/Field/{Field.tsx,Field.module.css,Field.test.tsx,index.ts}`

- [ ] **Step 1: Write the test**

```typescript
// design-system/components/Field/Field.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field } from './Field';

describe('Field', () => {
  it('renders a label associated with the input', () => {
    render(<Field name="email" label="Email" />);
    const label = screen.getByText('Email');
    const input = screen.getByRole('textbox');
    expect(label.getAttribute('for')).toBe(input.getAttribute('id'));
  });

  it('renders textarea when multiline=true', () => {
    render(<Field name="msg" label="Message" multiline rows={4} />);
    expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA');
  });

  it('renders error text and aria-invalid on error', () => {
    render(<Field name="email" label="Email" error="Required" />);
    expect(screen.getByText('Required')).toBeDefined();
    expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe('true');
  });

  it('links error text via aria-describedby', () => {
    render(<Field name="email" label="Email" error="Bad input" />);
    const input = screen.getByRole('textbox');
    const errId = input.getAttribute('aria-describedby');
    expect(errId).toBeDefined();
    expect(document.getElementById(errId!)?.textContent).toBe('Bad input');
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm test design-system/components/Field/Field.test.tsx
```

- [ ] **Step 3: Write `Field.tsx`**

```typescript
// design-system/components/Field/Field.tsx
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import styles from './Field.module.css';

type FieldBase = {
  name: string;
  label: string;
  error?: string;
};

type SingleLineProps = FieldBase &
  InputHTMLAttributes<HTMLInputElement> & { multiline?: false };

type MultiLineProps = FieldBase &
  TextareaHTMLAttributes<HTMLTextAreaElement> & { multiline: true; rows?: number };

type FieldProps = SingleLineProps | MultiLineProps;

export function Field({ name, label, error, multiline, ...rest }: FieldProps) {
  const id = `field-${name}`;
  const errId = error ? `${id}-error` : undefined;

  const inputProps = {
    id,
    name,
    className: styles.input,
    'aria-invalid': error ? ('true' as const) : undefined,
    'aria-describedby': errId,
  };

  return (
    <div className={styles.root}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {multiline ? (
        <textarea
          {...inputProps}
          {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          rows={(rest as MultiLineProps).rows ?? 4}
        />
      ) : (
        <input {...inputProps} {...(rest as InputHTMLAttributes<HTMLInputElement>)} />
      )}
      {error && (
        <span id={errId} className={styles.error}>
          {error}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write `Field.module.css`**

```css
.root {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: var(--ds-font-size-xs);
  color: var(--ds-color-text-muted);
  letter-spacing: 0.08em;
}

.input {
  background: transparent;
  border: 1px solid var(--ds-color-border-default);
  color: var(--ds-color-text-body);
  font-family: var(--ds-font-family-mono);
  font-size: var(--ds-font-size-body);
  padding: 8px 10px;
  min-height: 44px;
  resize: vertical;
  transition: border-color var(--ds-duration-base) var(--ds-ease-out);
}

.input:focus {
  outline: none;
  border-color: var(--ds-color-signal);
}

.input[aria-invalid='true'] {
  border-color: var(--ds-color-feedback-error);
}

.error {
  font-size: var(--ds-font-size-xs);
  color: var(--ds-color-feedback-error);
}
```

- [ ] **Step 5: Write `index.ts`**

```typescript
export { Field } from './Field';
```

- [ ] **Step 6: Run and verify tests pass**

```bash
pnpm test design-system/components/Field/Field.test.tsx
```

- [ ] **Step 7: Commit**

```bash
git add design-system/components/Field/
git commit -m "feat(design-system): add Field primitive component"
```

---

## Task 4: Badge component

**Files:**
- Create: `design-system/components/Badge/{Badge.tsx,Badge.module.css,Badge.test.tsx,index.ts}`

- [ ] **Step 1: Write the test**

```typescript
// design-system/components/Badge/Badge.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>OPEN_TO_WORK</Badge>);
    expect(screen.getByText('OPEN_TO_WORK')).toBeDefined();
  });

  it('renders dot as aria-hidden when variant=dot', () => {
    const { container } = render(<Badge variant="dot">Status</Badge>);
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).toBeDefined();
  });

  it('does not render dot when variant=default', () => {
    const { container } = render(<Badge variant="default">Status</Badge>);
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).toBeNull();
  });

  it('applies sm size class', () => {
    const { container } = render(<Badge size="sm">Small</Badge>);
    expect(container.firstChild?.classList.toString()).toContain('sm');
  });
});
```

- [ ] **Step 2: Run to verify failure, then implement**

```bash
pnpm test design-system/components/Badge/Badge.test.tsx
```

- [ ] **Step 3: Write `Badge.tsx`**

```typescript
// design-system/components/Badge/Badge.tsx
import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Badge.module.css';

type BadgeVariant = 'default' | 'dot';
type BadgeSize = 'sm' | 'md';

type BadgeProps = {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
};

export function Badge({ variant = 'default', size = 'md', children }: BadgeProps) {
  return (
    <span className={cx(styles.root, styles[variant], styles[size])}>
      {variant === 'dot' && (
        <span className={styles.dot} aria-hidden="true" />
      )}
      {children}
    </span>
  );
}
```

- [ ] **Step 4: Write `Badge.module.css`**

```css
.root {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--ds-color-signal-subtle);
  color: var(--ds-color-signal);
  font-family: var(--ds-font-family-mono);
  letter-spacing: 0.12em;
  padding: 4px 10px;
  white-space: nowrap;
  text-transform: uppercase;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ds-color-signal);
  flex-shrink: 0;
  animation: badge-pulse 1.6s ease-in-out infinite;
}

@keyframes badge-pulse {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 4px var(--ds-color-signal);
  }
  50% {
    opacity: 0.35;
    box-shadow: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dot {
    animation: none;
  }
}

/* Sizes */
.sm {
  font-size: var(--ds-font-size-xs);
  padding: 3px 8px;
}

.md {
  font-size: var(--ds-font-size-xs);
}
```

- [ ] **Step 5: Write `index.ts`, run tests, commit**

```typescript
export { Badge } from './Badge';
```

```bash
pnpm test design-system/components/Badge/Badge.test.tsx
git add design-system/components/Badge/
git commit -m "feat(design-system): add Badge primitive component"
```

---

## Task 5: TerminalPanel component

**Files:**
- Create: `design-system/components/TerminalPanel/{TerminalPanel.tsx,TerminalPanel.module.css,TerminalPanel.test.tsx,index.ts}`

TerminalPanel is the bordered green panel used as the wrapper for Hero, Shell, ContactForm, and every section.

- [ ] **Step 1: Write the test**

```typescript
// design-system/components/TerminalPanel/TerminalPanel.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TerminalPanel } from './TerminalPanel';

describe('TerminalPanel', () => {
  it('renders children', () => {
    render(<TerminalPanel>content</TerminalPanel>);
    expect(screen.getByText('content')).toBeDefined();
  });

  it('renders as div by default', () => {
    const { container } = render(<TerminalPanel>x</TerminalPanel>);
    expect(container.firstChild?.nodeName).toBe('DIV');
  });

  it('renders as section when as="section"', () => {
    const { container } = render(<TerminalPanel as="section">x</TerminalPanel>);
    expect(container.firstChild?.nodeName).toBe('SECTION');
  });

  it('applies dashed border class when borderStyle=dashed', () => {
    const { container } = render(
      <TerminalPanel borderStyle="dashed">x</TerminalPanel>
    );
    expect(container.firstChild?.classList.toString()).toContain('dashed');
  });

  it('renders header bar when header prop provided', () => {
    render(<TerminalPanel header="[ PANEL ]">x</TerminalPanel>);
    expect(screen.getByText('[ PANEL ]')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify failure, then implement**

```bash
pnpm test design-system/components/TerminalPanel/TerminalPanel.test.tsx
```

- [ ] **Step 3: Write `TerminalPanel.tsx`**

```typescript
// design-system/components/TerminalPanel/TerminalPanel.tsx
import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './TerminalPanel.module.css';

type BorderStyle = 'solid' | 'dashed';
type AsElement = 'div' | 'section' | 'article';

type TerminalPanelProps = {
  borderStyle?: BorderStyle;
  as?: AsElement;
  header?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function TerminalPanel({
  borderStyle = 'solid',
  as: Element = 'div',
  header,
  children,
  className,
}: TerminalPanelProps) {
  return (
    <Element className={cx(styles.root, styles[borderStyle], className)}>
      {header && <div className={styles.header}>{header}</div>}
      {children}
    </Element>
  );
}
```

- [ ] **Step 4: Write `TerminalPanel.module.css`**

```css
.root {
  border: 1px solid var(--ds-color-signal-subtle);
  background: transparent;
}

.dashed {
  border-style: dashed;
}

.header {
  border-bottom: 1px solid var(--ds-color-signal-subtle);
  padding: 6px var(--ds-space-pad);
  font-size: var(--ds-font-size-xs);
  letter-spacing: 0.12em;
  color: var(--ds-color-signal);
  font-family: var(--ds-font-family-mono);
}
```

- [ ] **Step 5: Write `index.ts`, run tests, commit**

```typescript
export { TerminalPanel } from './TerminalPanel';
```

```bash
pnpm test design-system/components/TerminalPanel/TerminalPanel.test.tsx
git add design-system/components/TerminalPanel/
git commit -m "feat(design-system): add TerminalPanel primitive component"
```

---

## Task 6: StatTile component

**Files:**
- Create: `design-system/components/StatTile/{StatTile.tsx,StatTile.module.css,StatTile.test.tsx,index.ts}`

- [ ] **Step 1: Write the test**

```typescript
// design-system/components/StatTile/StatTile.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatTile } from './StatTile';

describe('StatTile', () => {
  it('renders value and label as dl/dt/dd', () => {
    render(<StatTile value="99%" label="uptime" />);
    const dl = screen.getByRole('definition').closest('dl');
    expect(dl).toBeDefined();
    expect(screen.getByText('99%').tagName).toBe('DD');
    expect(screen.getByText('uptime').tagName).toBe('DT');
  });

  it('applies compact class when variant=compact', () => {
    const { container } = render(<StatTile value="1" label="x" variant="compact" />);
    expect(container.firstChild?.classList.toString()).toContain('compact');
  });
});
```

- [ ] **Step 2: Run to verify failure, then implement**

```bash
pnpm test design-system/components/StatTile/StatTile.test.tsx
```

- [ ] **Step 3: Write `StatTile.tsx`**

```typescript
// design-system/components/StatTile/StatTile.tsx
import { cx } from '../../lib/cx';
import styles from './StatTile.module.css';

type StatTileProps = {
  value: string;
  label: string;
  variant?: 'default' | 'compact';
};

export function StatTile({ value, label, variant = 'default' }: StatTileProps) {
  return (
    <dl className={cx(styles.root, styles[variant])}>
      <dd className={styles.value}>{value}</dd>
      <dt className={styles.label}>{label}</dt>
    </dl>
  );
}
```

- [ ] **Step 4: Write `StatTile.module.css`**

```css
.root {
  display: flex;
  flex-direction: column;
  padding: 7px 10px;
  margin: 0;
}

.value {
  color: var(--ds-color-signal);
  font-size: var(--ds-font-size-sm);
  font-weight: 700;
  letter-spacing: 0.04em;
  font-family: var(--ds-font-family-mono);
  line-height: 1.3;
  margin: 0;
}

.label {
  color: var(--ds-color-text-body);
  font-size: var(--ds-font-size-2xs);
  letter-spacing: 0.08em;
  opacity: 0.65;
  font-family: var(--ds-font-family-mono);
  line-height: 1.3;
}

.compact .value {
  font-size: var(--ds-font-size-xs);
}

.compact .label {
  font-size: var(--ds-font-size-2xs);
}
```

- [ ] **Step 5: Write `index.ts`, run tests, commit**

```typescript
export { StatTile } from './StatTile';
```

```bash
pnpm test design-system/components/StatTile/StatTile.test.tsx
git add design-system/components/StatTile/
git commit -m "feat(design-system): add StatTile primitive component"
```

---

## Task 7: CmdLine component

**Files:**
- Create: `design-system/components/CmdLine/{CmdLine.tsx,CmdLine.module.css,CmdLine.test.tsx,index.ts}`

- [ ] **Step 1: Write the test**

```typescript
// design-system/components/CmdLine/CmdLine.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CmdLine } from './CmdLine';

describe('CmdLine', () => {
  it('renders user, prompt, and command', () => {
    render(<CmdLine command="ls -la" />);
    expect(screen.getByText(/erik@portfolio/)).toBeDefined();
    expect(screen.getByText(':~$')).toBeDefined();
    expect(screen.getByText('ls -la')).toBeDefined();
  });

  it('renders custom user and prompt', () => {
    render(<CmdLine user="root@box" prompt="#" command="whoami" />);
    expect(screen.getByText(/root@box/)).toBeDefined();
    expect(screen.getByText('#')).toBeDefined();
  });

  it('renders output slot when output provided', () => {
    render(<CmdLine command="echo hi" output={<span>hi</span>} />);
    expect(screen.getByText('hi')).toBeDefined();
  });

  it('does not render output wrapper when output is undefined', () => {
    const { container } = render(<CmdLine command="ls" />);
    const lines = container.querySelectorAll('[class*="output"]');
    expect(lines.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure, then implement**

```bash
pnpm test design-system/components/CmdLine/CmdLine.test.tsx
```

- [ ] **Step 3: Write `CmdLine.tsx`**

```typescript
// design-system/components/CmdLine/CmdLine.tsx
import type { ReactNode } from 'react';
import styles from './CmdLine.module.css';

type CmdLineProps = {
  user?: string;
  command: string;
  output?: ReactNode;
  prompt?: string;
};

export function CmdLine({
  user = 'erik@portfolio',
  command,
  output,
  prompt = ':~$',
}: CmdLineProps) {
  return (
    <div className={styles.root}>
      <div className={styles.prompt}>
        <span className={styles.user}>{user}</span>
        <span className={styles.sep}>{prompt}</span>
        <span className={styles.cmd}>{command}</span>
      </div>
      {output && <div className={styles.output}>{output}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Write `CmdLine.module.css`**

```css
.root {
  font-family: var(--ds-font-family-mono);
  font-size: var(--ds-font-size-body);
  line-height: 1.55;
}

.prompt {
  display: flex;
  flex-wrap: wrap;
  gap: 0 4px;
}

.user {
  color: var(--ds-color-text-muted);
}

.sep {
  color: var(--ds-color-text-muted);
}

.cmd {
  color: var(--ds-color-text-body);
}

.output {
  color: var(--ds-color-text-body);
  margin-top: 4px;
}
```

- [ ] **Step 5: Write `index.ts`, run tests, commit**

```typescript
export { CmdLine } from './CmdLine';
```

```bash
pnpm test design-system/components/CmdLine/CmdLine.test.tsx
git add design-system/components/CmdLine/
git commit -m "feat(design-system): add CmdLine primitive component"
```

---

## Task 8: KbdKey component

**Files:**
- Create: `design-system/components/KbdKey/{KbdKey.tsx,KbdKey.module.css,KbdKey.test.tsx,index.ts}`

- [ ] **Step 1: Write the test**

```typescript
// design-system/components/KbdKey/KbdKey.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KbdKey } from './KbdKey';

describe('KbdKey', () => {
  it('renders as <kbd> element', () => {
    const { container } = render(<KbdKey>Ctrl</KbdKey>);
    expect(container.firstChild?.nodeName).toBe('KBD');
  });

  it('renders children text', () => {
    render(<KbdKey>Enter</KbdKey>);
    expect(screen.getByText('Enter')).toBeDefined();
  });

  it('applies sm size class', () => {
    const { container } = render(<KbdKey size="sm">Tab</KbdKey>);
    expect(container.firstChild?.classList.toString()).toContain('sm');
  });
});
```

- [ ] **Step 2: Run to verify failure, then implement**

```bash
pnpm test design-system/components/KbdKey/KbdKey.test.tsx
```

- [ ] **Step 3: Write `KbdKey.tsx`**

```typescript
// design-system/components/KbdKey/KbdKey.tsx
import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './KbdKey.module.css';

type KbdKeyProps = {
  size?: 'sm' | 'md';
  children: ReactNode;
};

export function KbdKey({ size = 'md', children }: KbdKeyProps) {
  return <kbd className={cx(styles.root, styles[size])}>{children}</kbd>;
}
```

- [ ] **Step 4: Write `KbdKey.module.css`**

```css
.root {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--ds-color-border-default);
  color: var(--ds-color-text-body);
  font-family: var(--ds-font-family-mono);
  padding: 1px 6px;
  border-radius: var(--ds-radius-sharp);
}

.sm {
  font-size: var(--ds-font-size-xs);
  padding: 0px 4px;
}

.md {
  font-size: var(--ds-font-size-sm);
}
```

- [ ] **Step 5: Write `index.ts`, run tests, commit**

```typescript
export { KbdKey } from './KbdKey';
```

```bash
pnpm test design-system/components/KbdKey/KbdKey.test.tsx
git add design-system/components/KbdKey/
git commit -m "feat(design-system): add KbdKey primitive component"
```

---

## Task 9: Barrel export and full unit test run

**Files:**
- Create: `design-system/index.ts`

- [ ] **Step 1: Write `design-system/index.ts`**

```typescript
export { Button } from './components/Button';
export { Field } from './components/Field';
export { Badge } from './components/Badge';
export { TerminalPanel } from './components/TerminalPanel';
export { StatTile } from './components/StatTile';
export { CmdLine } from './components/CmdLine';
export { KbdKey } from './components/KbdKey';
```

- [ ] **Step 2: Run all design-system tests**

```bash
pnpm test design-system/
```

Expected: All tests across all 7 components pass.

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add design-system/index.ts
git commit -m "feat(design-system): add barrel export for all 7 primitives"
```

---

## Task 10: Adopt Button, Badge, CmdLine in Hero

Read `components/sections/Hero.tsx` and `components/sections/Hero.module.css` first. The changes below replace inline `.cta`, `.ctaPrimary`, `.ctaSecondary`, `.status`, `.statusDot` patterns with primitives.

**Files:**
- Modify: `components/sections/Hero.tsx`
- Modify: `components/sections/Hero.module.css`

- [ ] **Step 1: Update imports in Hero.tsx**

Add to the top of `Hero.tsx`:

```typescript
import { Badge, Button, CmdLine } from '@/design-system';
```

- [ ] **Step 2: Replace CTA elements in Hero.tsx**

Find the CTA anchor elements (currently using `styles.cta`, `styles.ctaPrimary`, `styles.ctaSecondary`). Replace with:

```tsx
// Primary CTA (e.g., HIRE_ME / contact link)
<Button as="a" variant="primary" href="#sec-contact">
  HIRE_ME
</Button>

// Secondary CTA (e.g., DOWNLOAD_CV)
<Button as="a" variant="secondary" href="/erik-cunha-cv.pdf" download>
  DOWNLOAD_CV
</Button>
```

- [ ] **Step 3: Replace the status badge in Hero.tsx**

Find the `.status` + `.statusDot` elements. Replace with:

```tsx
<Badge variant="dot">OPEN_TO_WORK</Badge>
```

- [ ] **Step 4: Replace command-line patterns in Hero.tsx**

If Hero renders a `user@terminal:~$ command` pattern (in the boot animation or bio section), replace with:

```tsx
<CmdLine user="erik@portfolio" command="cat README.md" />
```

- [ ] **Step 5: Remove extracted class definitions from Hero.module.css**

Delete `.cta`, `.ctaPrimary`, `.ctaSecondary`, `.status`, `.statusDot`, `@keyframes status-pulse` blocks from `Hero.module.css`. These are now owned by the primitive components.

- [ ] **Step 6: Run the build to check for broken imports or class references**

```bash
pnpm build
```

Expected: Success. No missing class or import errors.

- [ ] **Step 7: Run all unit tests**

```bash
pnpm test
```

Expected: All pass.

- [ ] **Step 8: Commit**

```bash
git add components/sections/Hero.tsx components/sections/Hero.module.css
git commit -m "refactor(hero): adopt Button, Badge, CmdLine from design-system"
```

---

## Task 11: Adopt Field in ContactForm

**Files:**
- Modify: `components/client/ContactForm.tsx` (or wherever the form inputs are rendered)

- [ ] **Step 1: Find the form inputs**

```bash
grep -n "input\|textarea\|label" components/client/ContactForm.tsx | head -20
```

- [ ] **Step 2: Add import and replace inputs**

Add to imports:
```typescript
import { Field } from '@/design-system';
```

Replace each form field group (label + input/textarea) with:

```tsx
<Field name="name" label="$ name:" type="text" required />
<Field name="email" label="$ email:" type="email" required />
<Field name="message" label="$ message:" multiline rows={5} required />
```

Pass `error={errors.fieldName}` where error state exists.

- [ ] **Step 3: Run build and tests, commit**

```bash
pnpm build && pnpm test
git add components/client/ContactForm.tsx components/client/ContactForm.module.css
git commit -m "refactor(contact): adopt Field from design-system"
```

---

## Task 12: Adopt StatTile in HeroStats

**Files:**
- Modify: `components/HeroStats.tsx`
- Modify: `components/HeroStats.module.css`

- [ ] **Step 1: Add import and replace stat items**

In `HeroStats.tsx`, add:
```typescript
import { StatTile } from '@/design-system';
```

Replace the `.item` + `.value` + `.label` pattern with:

```tsx
<StatTile value="5+" label="YRS_EXP" />
<StatTile value="99" label="LH_SCORE" />
// etc.
```

- [ ] **Step 2: Remove extracted styles from HeroStats.module.css**

Delete `.item`, `.value`, `.label` class definitions (now owned by StatTile).

- [ ] **Step 3: Run build and tests, commit**

```bash
pnpm build && pnpm test
git add components/HeroStats.tsx components/HeroStats.module.css
git commit -m "refactor(hero-stats): adopt StatTile from design-system"
```

---

## Task 13: Add Playwright visual spec for components and regenerate baselines

**Files:**
- Create: `tests/e2e/design-system-components.spec.ts`

- [ ] **Step 1: Write the visual spec**

```typescript
// tests/e2e/design-system-components.spec.ts
import { expect, test } from '@playwright/test';

// These tests capture visual baselines for each component.
// The components are rendered via the /design-system/components route (PR C).
// Until that route exists, these tests are marked as skipped — activate in PR C.
test.describe('design-system components (visual baselines)', () => {
  test.skip('components route not yet available — enable in PR C');

  test('Button variants', async ({ page }) => {
    await page.goto('/design-system/components#button');
    await expect(page.locator('#button')).toHaveScreenshot('button-variants.png');
  });

  test('Field states', async ({ page }) => {
    await page.goto('/design-system/components#field');
    await expect(page.locator('#field')).toHaveScreenshot('field-states.png');
  });

  test('Badge variants', async ({ page }) => {
    await page.goto('/design-system/components#badge');
    await expect(page.locator('#badge')).toHaveScreenshot('badge-variants.png');
  });
});
```

- [ ] **Step 2: Regenerate portfolio-level visual baselines (components changed)**

```bash
pnpm build && pnpm start &
sleep 5
pnpm playwright test tests/e2e/visual.spec.ts --update-snapshots --project=chromium
pnpm playwright test tests/e2e/visual.spec.ts --update-snapshots --project=chromium-mobile
kill %1
```

- [ ] **Step 3: Run full CI gate and commit**

```bash
pnpm ci:local
git add tests/e2e/design-system-components.spec.ts tests/e2e/visual.spec.ts-snapshots/
git commit -m "test(design-system): add component visual spec + regenerate baselines"
```

---

## Task 14: Final verification

- [ ] `pnpm ci:local` passes
- [ ] `pnpm build` succeeds
- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint:token-boundary` passes (no primitive refs in new component CSS)
- [ ] `pnpm bundle-check --max-client-kb=220` passes (components are RSC, no client JS added)
- [ ] All 7 component tests pass
- [ ] Portfolio renders correctly (no missing styles from removed CSS classes)
