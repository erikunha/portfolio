# GitHub Copilot Instructions - Principal Level Frontend Engineering

**Platform**: Enterprise React + Next.js Monorepo
**Tech Stack**: Next.js 16 (App Router), React 19, TypeScript 5.9, Nx, pnpm
**Standards**: WCAG 2.1 AAA, Principal-Level Engineering Practices

---

## 🎯 Core Principles

### 1. Server-First Architecture

- **Default**: Server Components (async functions, no 'use client')
- **Client Components**: Only when required (state, effects, browser APIs, event handlers)
- **Data Fetching**: Server Components with native `fetch()`, React `cache()` for deduplication
- **Example**:

  ```tsx
  // ✅ GOOD - Server Component (default)
  export default async function Page() {
    const data = await fetch('https://api.example.com/data');
    return <div>{data.title}</div>;
  }

  // ✅ GOOD - Client Component (when needed)
  ('use client');
  export function Counter() {
    const [count, setCount] = useState(0);
    return <button onClick={() => setCount(count + 1)}>{count}</button>;
  }
  ```

### 2. Zero-Runtime CSS Architecture

- **Primary**: CSS Modules (`.module.css`) with design tokens
- **Tokens**: Import from `apps/shell/styles`
- **Never**: Runtime CSS-in-JS (Emotion, styled-components)
- **Example**:

  ```tsx
  // ✅ GOOD - CSS Modules
  import styles from './component.module.css';
  import { getColor, getSpacing } from '../styles';

  export function Component() {
    return <div className={styles.container}>Content</div>;
  }
  ```

### 3. Accessibility-First Development

- **Standard**: WCAG 2.1 Level AAA (7:1 contrast minimum)
- **Testing**: `jest-axe` for automated a11y checks in every component test
- **Required**:
  - Semantic HTML (`<button>`, `<nav>`, `<main>`)
  - ARIA labels for interactive elements
  - Keyboard navigation (Tab, Enter, Space, Escape)
  - Focus management
- **Example**:

  ```tsx
  // ✅ GOOD - Accessible component
  <button
    type="button"
    aria-label="Close dialog"
    onClick={handleClose}
  >
    ×
  </button>

  // ❌ BAD - Missing semantics
  <div onClick={handleClose}>×</div>
  ```

### 4. Type Safety & Strict Mode

- **TypeScript**: Strict mode enabled (`strict: true`)
- **No `any`**: Use `unknown` or proper types
- **Props**: Interface or type alias with JSDoc comments
- **Example**:

  ```tsx
  /**
   * Button component with variant support
   * @see {@link https://storybook.example.com/?path=/docs/button}
   */
  export interface ButtonProps {
    /** Button text content */
    children: React.ReactNode;
    /** Visual style variant */
    variant?: 'primary' | 'secondary' | 'ghost';
    /** Click event handler */
    onClick?: () => void;
    /** Accessible label (required if children is not text) */
    'aria-label'?: string;
  }

  export function Button({ children, variant = 'primary', ...props }: ButtonProps) {
    return (
      <button className={styles[variant]} {...props}>
        {children}
      </button>
    );
  }
  ```

---

## 📁 File Structure Conventions

### Component Organization (Purpose-Based)

Components are organized by **purpose**, not technical layer:

```
apps/shell/components/
├── layout/           # Page structure & navigation
│   ├── header/
│   └── footer/
├── seo/              # SEO & metadata
│   ├── seo/
│   └── structured-data/
├── providers/        # Context, analytics, tracking
│   └── web-vitals-tracker/
└── features/         # Feature-specific components
    └── auth/
```

**Decision Tree for Placement**:

1. **Is it layout/navigation?** → `components/layout/`
2. **Is it SEO-related?** → `components/seo/`
3. **Is it a provider/wrapper?** → `components/providers/`
4. **Is it feature-specific?** → `components/features/{feature-name}/`

**Shared UI Library** (`apps/shell/components/shared/`):

- Flat-first structure (no unnecessary nesting)
- Pre-approved categories: `forms/`, `feedback/`, `layout/`, `overlays/`, `data-display/`, `navigation/`
- See [ADR-016](docs/decisions/ADR-016-flat-first-ui-library.md) for grouping rules

### File Naming

```
component-name/
├── index.tsx              # Component implementation
├── component-name.module.css  # Styles
├── component-name.spec.tsx    # Jest unit tests
├── component-name.stories.tsx # Storybook stories
└── component-name-docs.mdx    # Documentation (optional)
```

---

## 🧪 Testing Standards

### Unit Tests (Jest + React Testing Library)

**Required for**: Every component, utility function, hook
**Coverage Thresholds**:

- Statements: 90%
- Branches: 85%
- Functions: 90%
- Lines: 90%
- Critical components (Button): 95%

**Testing Utilities**:

- Use `renderWithProviders` from `apps/shell/components/shared/test-utils`
- Use `setupUser()` instead of `fireEvent` for user interactions
- Always run `jest-axe` accessibility checks

**Example**:

```tsx
// filepath: apps/shell/components/layout/button/button.spec.tsx
import { axe, toHaveNoViolations } from 'jest-axe';
import { renderWithProviders, setupUser } from '../../shared/test-utils';
import { Button } from './button';

expect.extend(toHaveNoViolations);

describe('Button', () => {
  it('should render with correct text', () => {
    const { getByRole } = renderWithProviders(<Button>Click me</Button>);
    expect(getByRole('button')).toHaveTextContent('Click me');
  });

  it('should handle click events', async () => {
    const handleClick = jest.fn();
    const user = setupUser();
    const { getByRole } = renderWithProviders(<Button onClick={handleClick}>Click me</Button>);

    await user.click(getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should have no accessibility violations', async () => {
    const { container } = renderWithProviders(<Button>Click me</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### E2E Tests (Playwright)

**Required for**: Critical user flows (checkout, auth, navigation)
**Location**: [`apps/shell-e2e/src`](apps/shell-e2e/src)

---

## 🎨 Styling Guidelines

### Design Token Usage

**Always use tokens** from `apps/shell/styles`:

```tsx
import { getColor, getSpacing, getFontSize } from '../styles';

// ✅ GOOD - Using tokens
.container {
  background: var(--color-background-primary);
  padding: var(--spacing-4);
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
}

// ❌ BAD - Hardcoded values
.container {
  background: #000;
  padding: 16px;
  font-size: 16px;
  color: #1aff1a;
}
```

### CSS Modules Best Practices

```css
/* ✅ GOOD - BEM-like naming, token usage */
.component {
  display: flex;
  gap: var(--spacing-4);
}

.component__title {
  font-size: var(--font-size-lg);
  color: var(--color-text-primary);
}

.component--variant-primary {
  background: var(--color-brand-primary);
}

/* ❌ BAD - Generic names, hardcoded values */
.title {
  font-size: 24px;
  color: #1aff1a;
}
```

---

## 🔧 Code Generation Patterns

### When Creating Components

1. **Determine if Server or Client Component**:
   - Server: Default (no state, effects, or browser APIs)
   - Client: Add `'use client'` directive

2. **Generate Component File**:

   ````tsx
   // filepath: apps/shell/components/layout/header/index.tsx
   'use client'; // Only if needed

   import styles from './header.module.css';

   export interface HeaderProps {
     /** Component description */
     children: React.ReactNode;
   }

   /**
    * Header Component
    *
    * @example
    * ```tsx
    * <Header>
    *   <Logo />
    *   <Navigation />
    * </Header>
    * ```
    */
   export function Header({ children }: HeaderProps) {
     return <header className={styles.header}>{children}</header>;
   }
   ````

3. **Generate CSS Module**:

   ```css
   /* filepath: apps/shell/components/layout/header/header.module.css */
   .header {
     display: flex;
     align-items: center;
     padding: var(--spacing-4);
     background: var(--color-background-primary);
     border-bottom: 1px solid var(--color-border-primary);
   }
   ```

4. **Generate Test File**:

   ```tsx
   // filepath: apps/shell/components/layout/header/header.spec.tsx
   import { axe, toHaveNoViolations } from 'jest-axe';
   import { renderWithProviders } from '@erikunha/shared/ui/test-utils';
   import { Header } from './index';

   expect.extend(toHaveNoViolations);

   describe('Header', () => {
     it('should render children', () => {
       const { getByText } = renderWithProviders(
         <Header>
           <div>Test Content</div>
         </Header>,
       );
       expect(getByText('Test Content')).toBeInTheDocument();
     });

     it('should have no accessibility violations', async () => {
       const { container } = renderWithProviders(
         <Header>
           <div>Test Content</div>
         </Header>,
       );
       const results = await axe(container);
       expect(results).toHaveNoViolations();
     });
   });
   ```

5. **Generate Storybook Story**:

   ```tsx
   // filepath: apps/shell/components/layout/header/header.stories.tsx
   import type { Meta, StoryObj } from '@storybook/react';
   import { Header } from './index';

   const meta: Meta<typeof Header> = {
     component: Header,
     title: 'Layout/Header',
     tags: ['autodocs'],
   };

   export default meta;
   type Story = StoryObj<typeof Header>;

   export const Default: Story = {
     args: {
       children: <div>Header Content</div>,
     },
   };
   ```

---

## 🚀 Performance Patterns

### Code Splitting

```tsx
// ✅ GOOD - Dynamic import for heavy components
const HeavyChart = dynamic(() => import('./heavy-chart'), {
  loading: () => <Skeleton />,
  ssr: false, // Only if component requires browser APIs
});
```

### Image Optimization

```tsx
// ✅ GOOD - Next.js Image component
import Image from 'next/image';

<Image src="/avatar.jpg" alt="User avatar" width={48} height={48} priority={false} />;
```

### Metadata (SEO)

```tsx
// filepath: apps/shell/app/about/page.tsx
import { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'About - Erik Henrique',
    description: 'Learn more about Erik Henrique, Frontend Engineer',
  };
}

export default async function AboutPage() {
  return <main>About content</main>;
}
```

---

## 📚 Key Documentation References

- **Architecture**: [ARCHITECTURE.md](ARCHITECTURE.md)
- **Component Organization**: [docs/STRUCTURE.md](docs/STRUCTURE.md)
- **CSS Guidelines**: [CSS_GUIDELINES.md](CSS_GUIDELINES.md)
- **Contributing**: [CONTRIBUTING.md](CONTRIBUTING.md)
- **Design System**: [libs/shared/styles/README.md](libs/shared/styles/README.md)
- **Accessibility Testing**: [docs/ACCESSIBILITY_TESTING.md](docs/ACCESSIBILITY_TESTING.md)
- **ADRs**: [docs/decisions/](docs/decisions/)

---

## 🚫 Anti-Patterns to Avoid

### ❌ Runtime CSS-in-JS

```tsx
// ❌ BAD - Never use
const StyledDiv = styled.div`
  color: red;
`;
```

### ❌ Client Components Without Justification

```tsx
// ❌ BAD - Unnecessary 'use client'
'use client';
export default function StaticContent() {
  return <div>Static text</div>; // No state, effects, or browser APIs
}
```

### ❌ Hardcoded Values

```tsx
// ❌ BAD
<div style={{ padding: '16px', color: '#1aff1a' }}>

// ✅ GOOD
<div className={styles.container}>
```

### ❌ Missing Accessibility

```tsx
// ❌ BAD
<div onClick={handleClick}>Click me</div>

// ✅ GOOD
<button type="button" onClick={handleClick}>Click me</button>
```

### ❌ Skipping Tests

```tsx
// ❌ BAD - No tests
// Every component MUST have tests with accessibility checks
```

---

## 🔍 Code Review Checklist

When generating code, ensure:

- [ ] Server Component by default (no `'use client'` unless needed)
- [ ] CSS Modules with design tokens (no hardcoded values)
- [ ] TypeScript strict types (no `any`)
- [ ] Accessibility: semantic HTML, ARIA labels, keyboard support
- [ ] Tests: Jest unit tests with `jest-axe` checks
- [ ] Storybook story (for UI components)
- [ ] JSDoc comments for public APIs
- [ ] Performance: dynamic imports for heavy components
- [ ] SEO: metadata for pages

---

## 💡 Context-Aware Suggestions

### When User Asks About...

**"Create a button component"**:

1. Check if one exists in `apps/shell/components/shared/lib/button`
2. If yes, reference it: `import { Button } from '../shared/lib/button'`
3. If no, generate with full test suite and Storybook story

**"How to style this?"**:

1. Always suggest CSS Modules
2. Reference design tokens: `apps/shell/styles`
3. Show example with `var(--color-*)` and `var(--spacing-*)`

**"Add state to component"**:

1. Confirm it's a Client Component
2. Add `'use client'` directive if missing
3. Use `useState` or `useReducer`

**"Make it accessible"**:

1. Reference [docs/ACCESSIBILITY_TESTING.md](docs/ACCESSIBILITY_TESTING.md)
2. Add semantic HTML
3. Add ARIA labels
4. Add keyboard handlers (Enter, Space, Escape)
5. Add `jest-axe` test

---

## 🎓 Principal-Level Best Practices

### 1. Component Composition Over Inheritance

```tsx
// ✅ GOOD - Composition
<Card>
  <CardHeader title="Title" />
  <CardBody>Content</CardBody>
</Card>;

// ❌ BAD - Inheritance
class Card extends React.Component {}
```

### 2. Controlled Components

```tsx
// ✅ GOOD - Controlled
<Input value={value} onChange={setValue} />

// ⚠️ Use Uncontrolled only for forms with native validation
<Input defaultValue="initial" />
```

### 3. Error Boundaries

```tsx
// ✅ GOOD - Error boundary for critical sections
<ErrorBoundary fallback={<ErrorFallback />}>
  <CriticalFeature />
</ErrorBoundary>
```

### 4. Performance Monitoring

```tsx
// ✅ GOOD - Use WebVitalsTracker
// See: apps/shell/components/providers/web-vitals-tracker/index.tsx
<WebVitalsTracker />
```

---

## 📞 Getting Help

- **Architecture Questions**: See [ARCHITECTURE.md](ARCHITECTURE.md)
- **Component Placement**: See [docs/STRUCTURE.md](docs/STRUCTURE.md)
- **Styling Issues**: See [CSS_GUIDELINES.md](CSS_GUIDELINES.md)
- **ADR Context**: See [DECISIONS.md](DECISIONS.md)

---

**Last Updated**: 2026-01-13
**Copilot Version**: Principal-Level Frontend React/Next.js Engineering
