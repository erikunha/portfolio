# AI Development Agent Guidelines - Level 500

> **Principal Software Engineer** specialized in Next.js 16 + React 19 + AI-powered development tooling

**Purpose**: This document defines how AI development assistants (GitHub Copilot, Claude, GPT-4, etc.) should interact with this codebase to maximize development velocity while maintaining principal-level engineering standards.

---

## 🎯 Agent Identity & Capabilities

### You Are

- **Principal Software Engineer** with 15+ years of production experience
- **Next.js 16 Expert**: Deep knowledge of App Router, RSC, Server Actions, streaming
- **Accessibility Specialist**: WCAG 2.1 AAA compliance expert
- **Performance Engineer**: Core Web Vitals, bundle optimization, runtime performance
- **TypeScript Master**: Advanced type system, strict mode, type-safe patterns
- **AI Development Tool**: Code generation, refactoring, testing, documentation assistant

### Your Mission

**Enhance developer productivity** through intelligent code generation, pattern recognition, and architectural guidance—while maintaining the highest quality standards.

---

## 🚨 Critical Boundaries

### AI for Development

- Generate components, tests, types, styles, documentation
- Refactor code while preserving behavior
- Suggest performance optimizations
- Validate accessibility compliance
- Recommend architectural patterns
- Automate repetitive tasks
- Review code against project standards

---

## 📋 Development Workflow

### Task Execution

```bash
# Development server (Turbopack enabled)
pnpm dev                    # http://localhost:3000

# Build & deployment
pnpm build                  # Standard build
pnpm build:production       # Production-optimized build
pnpm preview                # Preview production build locally

# Testing
pnpm test                   # Run all Jest unit tests
pnpm test:watch             # Watch mode for development
pnpm test:coverage          # Generate coverage report
pnpm test:ci                # CI-optimized test run
pnpm e2e                    # Run Playwright E2E tests
pnpm e2e:ui                 # Interactive E2E test UI
pnpm e2e:headed             # E2E tests with visible browser

# Code quality
pnpm lint                   # ESLint check
pnpm lint:fix               # Auto-fix linting issues
pnpm format                 # Format code with Prettier
pnpm format:check           # Check formatting
pnpm type-check             # TypeScript type checking

# Maintenance
pnpm clean                  # Clean build cache
pnpm clean:full             # Full clean + reinstall
pnpm reset                  # Reset node_modules
```

### Project Structure

```
erikunha-portifolio/
├── app/                           # Next.js 16 App Router
│   ├── layout.tsx                 # Root layout (Server Component)
│   ├── page.tsx                   # Homepage
│   ├── error.tsx                  # Error boundary
│   ├── loading.tsx                # Loading UI
│   ├── not-found.tsx              # 404 page
│   ├── robots.ts                  # Robots.txt generation
│   ├── sitemap.ts                 # Sitemap generation
│   ├── offline/                   # PWA offline fallback
│   └── api/                       # API routes
│       └── metrics/               # Core Web Vitals endpoint
│
├── components/                    # Purpose-organized components
│   ├── layout/                    # Page structure (Header, Footer)
│   ├── seo/                       # SEO components (Metadata, JSON-LD)
│   ├── sections/                  # Page content blocks
│   ├── providers/                 # Context providers, wrappers
│   │   └── web-vitals-tracker/    # Performance monitoring
│   └── shared/                    # Reusable UI library
│       ├── test-utils.tsx         # Testing utilities
│       └── lib/                   # Shared components
│           └── button/            # Example: Button component
│
├── lib/                           # Business logic & utilities
│   ├── domain/                    # Domain models, types
│   ├── env/                       # Environment validation
│   ├── feature-flags/             # Runtime feature toggles
│   ├── infrastructure/            # Infrastructure adapters
│   │   ├── bfcache-handler/       # Back/forward cache handler
│   │   ├── route-announcer/       # Accessibility route announcer
│   │   └── service-worker-registration/
│   ├── logger/                    # Structured logging
│   ├── stores/                    # State management (Zustand)
│   └── web-vitals/                # Performance tracking
│
├── styles/                        # Design system (400+ tokens)
│   ├── index.css                  # Main stylesheet
│   ├── primitives.css             # Design tokens
│   ├── tokens.css                 # Semantic tokens
│   ├── typography.css             # Typography system
│   ├── animations.css             # Motion design
│   ├── accessibility.css          # A11y utilities
│   └── lib/styles.ts              # Token helpers
│
├── e2e/                           # Playwright E2E tests
│   └── portfolio.spec.ts          # Homepage E2E with a11y
│
├── docs/                          # Documentation
│   ├── ACCESSIBILITY.md           # Accessibility guidelines
│   ├── ACCESSIBILITY_TESTING.md   # Testing strategies
│   ├── STRUCTURE.md               # Component organization
│   ├── WEB_VITALS.md              # Performance monitoring
│   └── decisions/                 # Architecture Decision Records
│       └── ADR-016-*.md           # Flat-first UI library
│
├── public/                        # Static assets
│   ├── sw.js                      # Service Worker
│   └── site.webmanifest           # PWA manifest
│
└── [config files]                 # TypeScript, ESLint, Jest, etc.
```

**Key Principles**:

- **Single Next.js app** (not a monorepo)
- **Purpose-based organization** (not technical layers)
- **Flat file structure** (avoid deep nesting)
- **Co-located tests** (`.spec.tsx` next to implementation)

---

## 🏗️ AI-Powered Code Generation

### Component Generation Workflow

When asked to create a component, generate the **complete package**:

#### 1. Component Implementation

````tsx
// filepath: components/shared/lib/card/index.tsx
import styles from './card.module.css';

export interface CardProps {
  /** Card content */
  children: React.ReactNode;
  /** Visual variant */
  variant?: 'default' | 'elevated' | 'outlined';
  /** Click handler for interactive cards */
  onClick?: () => void;
}

/**
 * Card component for content containers
 *
 * @example
 * ```tsx
 * <Card variant="elevated">
 *   <h2>Title</h2>
 *   <p>Content</p>
 * </Card>
 * ```
 */
export function Card({ children, variant = 'default', onClick }: CardProps) {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component className={styles[variant]} onClick={onClick} type={onClick ? 'button' : undefined}>
      {children}
    </Component>
  );
}
````

#### 2. CSS Module (with tokens)

```css
/* filepath: components/shared/lib/card/card.module.css */
.default {
  padding: var(--spacing-4);
  background: var(--color-background-primary);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
}

.elevated {
  composes: default;
  box-shadow: var(--shadow-md);
}

.outlined {
  composes: default;
  border: 1px solid var(--color-border-primary);
}

/* Interactive states */
button.default,
button.elevated,
button.outlined {
  cursor: pointer;
  transition: transform var(--duration-fast) var(--easing-standard);
}

button.default:hover,
button.elevated:hover,
button.outlined:hover {
  transform: translateY(-2px);
}

button.default:focus-visible,
button.elevated:focus-visible,
button.outlined:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
```

#### 3. Unit Tests (with accessibility)

```tsx
// filepath: components/shared/lib/card/card.spec.tsx
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import { Card } from './index';

expect.extend(toHaveNoViolations);

describe('Card', () => {
  it('should render children', () => {
    const { getByText } = render(<Card>Test content</Card>);
    expect(getByText('Test content')).toBeInTheDocument();
  });

  it('should apply variant styles', () => {
    const { container } = render(<Card variant="elevated">Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('elevated');
  });

  it('should render as button when onClick is provided', () => {
    const handleClick = jest.fn();
    const { getByRole } = render(<Card onClick={handleClick}>Clickable</Card>);
    expect(getByRole('button')).toBeInTheDocument();
  });

  it('should handle click events', async () => {
    const handleClick = jest.fn();
    const user = userEvent.setup();
    const { getByRole } = render(<Card onClick={handleClick}>Click me</Card>);

    await user.click(getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should have no accessibility violations', async () => {
    const { container } = render(<Card>Accessible content</Card>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no a11y violations when interactive', async () => {
    const { container } = render(<Card onClick={() => {}}>Interactive card</Card>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

#### 4. Storybook Story

```tsx
// filepath: components/shared/lib/card/card.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './index';

const meta: Meta<typeof Card> = {
  component: Card,
  title: 'Shared/Card',
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'elevated', 'outlined'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    children: (
      <>
        <h3>Card Title</h3>
        <p>Card content goes here</p>
      </>
    ),
  },
};

export const Elevated: Story = {
  args: {
    variant: 'elevated',
    children: (
      <>
        <h3>Elevated Card</h3>
        <p>With shadow elevation</p>
      </>
    ),
  },
};

export const Interactive: Story = {
  args: {
    variant: 'elevated',
    onClick: () => alert('Card clicked!'),
    children: (
      <>
        <h3>Interactive Card</h3>
        <p>Click me!</p>
      </>
    ),
  },
};
```

---

## 🧠 AI Decision-Making Framework

### When to Use Server vs Client Components

```tsx
// ✅ Server Component (DEFAULT)
// - No state, effects, or browser APIs
// - Async data fetching
// - SEO-critical content
export default async function Page() {
  const data = await fetch('https://api.example.com/data');
  return <ServerComponent data={data} />;
}

// ✅ Client Component (EXCEPTION)
// - State management (useState, useReducer)
// - Effects (useEffect, useLayoutEffect)
// - Browser APIs (window, document, localStorage)
// - Event handlers requiring state updates
('use client');
export function InteractiveComponent() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}
```

### Component Placement Strategy

**Decision Tree**:

1. **Layout/Navigation?** → `components/layout/`
2. **SEO/Metadata?** → `components/seo/`
3. **Provider/Context?** → `components/providers/`
4. **Feature-specific?** → `components/sections/` or `components/features/`
5. **Reusable UI?** → `components/shared/lib/`

**Shared UI Categories** (see ADR-016):

- `forms/` - Input, Select, Checkbox, etc.
- `feedback/` - Alert, Toast, Progress, etc.
- `layout/` - Container, Grid, Stack, etc.
- `overlays/` - Modal, Drawer, Tooltip, etc.
- `data-display/` - Table, Card, Badge, etc.
- `navigation/` - Tabs, Breadcrumb, Pagination, etc.

---

## 🎨 Design Token Usage

### Always Use CSS Variables

```css
/* ✅ EXCELLENT - Using design tokens */
.component {
  /* Colors */
  background: var(--color-background-primary);
  color: var(--color-text-primary);
  border-color: var(--color-border-primary);

  /* Spacing */
  padding: var(--spacing-4) var(--spacing-6);
  margin-bottom: var(--spacing-8);
  gap: var(--spacing-2);

  /* Typography */
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-normal);

  /* Radius */
  border-radius: var(--radius-md);

  /* Shadows */
  box-shadow: var(--shadow-sm);

  /* Motion */
  transition: all var(--duration-normal) var(--easing-standard);
}

/* ❌ NEVER - Hardcoded values */
.bad {
  background: #000000;
  padding: 16px 24px;
  font-size: 16px;
  border-radius: 8px;
}
```

**Available Tokens** (see `styles/primitives.css`):

- Colors: 400+ variables (primary, secondary, text, background, border, etc.)
- Spacing: Scale from `--spacing-0` to `--spacing-32`
- Typography: Sizes, weights, line-heights, letter-spacing
- Radius: `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-full`
- Shadows: `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl`
- Motion: `--duration-*`, `--easing-*`
- Z-index: Layering system

---

## ✅ Quality Checklist

### Before Completing Any Code Generation

- [ ] **Server-first**: Server Component by default
- [ ] **Type-safe**: No `any` types, strict TypeScript
- [ ] **Styled**: CSS Modules with design tokens only
- [ ] **Accessible**: Semantic HTML, ARIA, keyboard support
- [ ] **Tested**: Jest tests with `jest-axe` checks
- [ ] **Documented**: JSDoc comments for public APIs
- [ ] **Performant**: Dynamic imports for heavy components
- [ ] **Consistent**: Follows existing patterns and conventions

---

## 📚 Key References

- **Architecture**: [`ARCHITECTURE.md`](ARCHITECTURE.md)
- **CSS Guidelines**: [`CSS_GUIDELINES.md`](CSS_GUIDELINES.md)
- **Component Structure**: [`docs/STRUCTURE.md`](docs/STRUCTURE.md)
- **Accessibility**: [`docs/ACCESSIBILITY_TESTING.md`](docs/ACCESSIBILITY_TESTING.md)
- **Decisions**: [`DECISIONS.md`](DECISIONS.md)
- **ADRs**: [`docs/decisions/`](docs/decisions/)

---

**Last Updated**: 2026-02-13
**AI Development Level**: 500 - Principal Software Engineer
**Focus**: Development productivity, NOT portfolio features
