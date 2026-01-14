# Contributing Guide

Welcome to the **Enterprise React + Next.js Platform**! This guide will help you get started contributing to the codebase.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Workflow](#development-workflow)
3. [Code Standards](#code-standards)
4. [Commit Guidelines](#commit-guidelines)
5. [Testing Requirements](#testing-requirements)
6. [Pull Request Process](#pull-request-process)
7. [Architecture Guidelines](#architecture-guidelines)

---

## Getting Started

### Prerequisites

- **Node.js** 22+ (LTS)
- **pnpm** 10+
- **Git**

### Installation

1. Clone the repository:

```bash
git clone https://github.com/your-org/erikunha-portifolio.git
cd erikunha-portifolio/erikunha-portifolio
```

2. Install dependencies:

```bash
pnpm install
```

3. Start the development server:

```bash
pnpm start
```

4. Open [http://localhost:3000](http://localhost:3000)

---

## Development Workflow

### Running Tasks

```bash
# Serve an app
pnpm nx serve <app-name>

# Build an app
pnpm nx build <app-name>

# Run tests
pnpm nx test <lib-name>

# Run E2E tests
pnpm nx e2e <app-name>-e2e

# Lint
pnpm nx lint <project-name>

# Run Storybook
pnpm nx storybook ui
```

### Affected Commands

Only run tasks on projects affected by your changes:

```bash
pnpm nx affected -t lint
pnpm nx affected -t test
pnpm nx affected -t build
```

---

## Code Standards

### TypeScript

- **Strict mode enabled**: No `any` without justification
- **Explicit return types** for public APIs
- **No unused variables** (enforced by ESLint)

```typescript
// ✅ GOOD
export function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ❌ BAD
export function calculateTotal(items: any) {
  return items.reduce((sum: any, item: any) => sum + item.price, 0);
}
```

### React

- **Server Components by default**
- **Client Components only when needed**

```tsx
// ✅ GOOD - Server Component (default)
export default async function Page() {
  const data = await fetch('...');
  return <div>{data.title}</div>;
}

// ✅ GOOD - Client Component (when needed)
('use client');

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

### Styling

- **CSS Modules only** (no Tailwind, no styled-components)
- **Design tokens for all values** (no hardcoded colors/spacing)

```tsx
// ✅ GOOD
import styles from './button.module.css';

export function Button() {
  return <button className={styles.primary}>Click</button>;
}
```

```css
/* button.module.css */
.primary {
  background-color: var(--color-brand-primary);
  padding: var(--space-3) var(--space-4);
}
```

---

## Commit Guidelines

We use **Conventional Commits** for automated versioning and changelog generation.

### Interactive Commit (Recommended)

Use commitizen for guided commit creation:

```bash
pnpm commit
```

This will prompt you through:

1. **Select commit type** (feat, fix, docs, etc.)
2. **Choose scope** (layout, seo, providers, shared, domain, infrastructure, ui, docs, config)
3. **Write short description** (imperative mood: "add" not "added")
4. **Add longer description** (optional)
5. **Confirm breaking changes** (optional)
6. **Reference issues** (optional)

**Example Interactive Flow**:

```bash
$ pnpm commit

? Select the type of change that you're committing: feat
? What is the scope of this change (e.g. component or file name)? ui
? Write a short, imperative tense description of the change:
  add Button component with primary and secondary variants
? Provide a longer description of the change (optional):
  - Supports size variants (sm, md, lg)
  - Includes loading state
  - Fully accessible with ARIA labels
? Are there any breaking changes? No
? Does this change affect any open issues? No
```

### Manual Commit Format

If you prefer manual commits:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature (triggers minor version bump)
- `fix`: Bug fix (triggers patch version bump)
- `docs`: Documentation only
- `style`: Code formatting (no functional changes)
- `refactor`: Code restructuring (no functional changes)
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `build`: Build system changes
- `ci`: CI configuration changes
- `chore`: Other maintenance tasks

### Scopes

Use component categories as scopes:

- `layout` - Page structure components (header, footer)
- `seo` - SEO and metadata components
- `providers` - Context providers and wrappers
- `shared` - Shared UI library components
- `domain` - Domain models and business logic
- `infrastructure` - System-level utilities
- `ui` - UI components
- `docs` - Documentation files
- `config` - Configuration files

### Examples

**Feature**:

```bash
feat(ui): add Button component with variants

- Supports primary, secondary, and ghost variants
- Includes size options (sm, md, lg)
- Fully accessible with ARIA labels
- 95% test coverage
```

**Bug Fix**:

```bash
fix(seo): resolve structured data schema validation

Fixed JSON-LD schema validation errors for Article type
```

**Breaking Change**:

```bash
feat(domain)!: change PortfolioProject model schema

BREAKING CHANGE: PortfolioProject.tags is now required and must be non-empty array
```

**With Issue Reference**:

```bash
fix(providers): resolve WebVitalsTracker memory leak

Fixes #42
```

### Enforcement

Commits are validated via **Commitlint** (Husky commit-msg hook). Invalid commits are rejected.

### Versioning

Semantic Release automatically determines version bumps:

- `feat` → Minor version (0.1.0 → 0.2.0)
- `fix` → Patch version (0.1.0 → 0.1.1)
- `feat!` or `BREAKING CHANGE:` → Major version (0.1.0 → 1.0.0)

---

## Testing Requirements

### Unit Tests

- **Location**: `*.spec.ts` next to source files
- **Coverage**: 80%+ for domain logic
- **Tools**: Jest

```typescript
// domain.spec.ts
import { calculateDiscount } from './domain';

describe('calculateDiscount', () => {
  it('should apply 10% discount for orders over $100', () => {
    expect(calculateDiscount(150)).toBe(15);
  });
});
```

### Integration Tests

- **Location**: `tests/integration/`
- **Coverage**: 70%+ for feature flows
- **Tools**: Jest + Testing Library

### E2E Tests

- **Location**: `e2e/`
- **Scope**: Critical user journeys, accessibility testing
- **Tools**: Playwright 1.57+, @axe-core/playwright

```typescript
// portfolio.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('should display hero section', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await expect(page.getByRole('heading', { name: /Erik Henrique Alves Cunha/i })).toBeVisible();
});

test('should pass accessibility scan', async ({ page }) => {
  await page.goto('http://localhost:3000');
  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});
```

---

## Pull Request Process

### Before Submitting

1. **Run affected checks**:

```bash
pnpm nx affected -t lint
pnpm nx affected -t test
pnpm nx affected -t build
```

2. **Ensure tests pass**:

```bash
pnpm nx test <your-lib>
```

3. **Check code formatting**:

```bash
pnpm prettier --check .
```

### PR Template

```markdown
## Description

[Describe the change]

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Checklist

- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Storybook stories added (if UI component)
- [ ] Performance budgets checked
- [ ] Conventional commit format used

## Screenshots (if applicable)

[Add screenshots]
```

### Review Process

1. **Automated checks** (CI):
   - Lint, test, build
   - Performance budgets
   - Bundle analysis

2. **Code review** (required):
   - Minimum 1 approval
   - No unresolved comments

3. **Merge**:
   - Squash and merge (enforced)
   - Semantic Release handles versioning

---

## Architecture Guidelines

### Dependency Rules

- **Apps** can depend on `libs/shared/*`
- **libs/shared/ui** can depend on `libs/shared/styles`
- **libs/shared/domain** depends on NOTHING

### File Organization

```
component/
  component.tsx              # Component logic
  component.module.css       # Scoped styles
  component.spec.ts          # Unit tests
  component.stories.tsx      # Storybook stories
```

### Naming Conventions

- **Components**: PascalCase (`Button.tsx`)
- **Files**: kebab-case (`user-profile.tsx`)
- **CSS Modules**: `*.module.css`
- **Tests**: `*.spec.ts`, `*.spec.tsx`

---

## Storybook

All UI components must have Storybook stories:

```tsx
// button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';

const meta: Meta<typeof Button> = {
  component: Button,
  title: 'Components/Button',
};

export default meta;

export const Primary: StoryObj<typeof Button> = {
  args: {
    children: 'Primary Button',
    variant: 'primary',
  },
};
```

Run Storybook:

```bash
pnpm nx storybook ui
```

---

## Performance

### Budgets

All PRs are checked against performance budgets:

- **FCP**: < 1.5s
- **LCP**: < 2.5s
- **CLS**: < 0.1
- **TBT**: < 200ms

### Bundle Analysis

Run bundle analysis:

```bash
pnpm nx build shell --analyze
```

---

## Documentation

Update documentation when:

- Adding new features
- Changing architecture
- Introducing breaking changes

Required files:

- `ARCHITECTURE.md`: System design
- `DECISIONS.md`: ADR log
- `CSS_GUIDELINES.md`: Styling rules
- `CONTRIBUTING.md`: This file

---

## Getting Help

- **Architecture questions**: Read `ARCHITECTURE.md`
- **Styling questions**: Read `CSS_GUIDELINES.md`
- **Bugs**: Open an issue
- **Discussions**: Use GitHub Discussions

---

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person

---

## License

[Your License Here]

---

**Thank you for contributing!**
