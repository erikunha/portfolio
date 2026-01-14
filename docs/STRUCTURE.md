# Component Structure & Organization

> **Last Updated**: January 2026

## Overview

This document explains the component organization strategy for the erikunha-portifolio project. Components are organized by **purpose** rather than size or complexity, making the codebase intuitive and maintainable.

---

## Purpose-Based Organization

We organize components by **what they do**:

```
apps/shell/components/
├── layout/         → Structure & navigation
├── sections/       → Page content blocks
├── seo/            → Metadata & structured data
└── providers/      → Context & analytics

apps/shell/lib/
└── infrastructure/ → System-level utilities
```

**Benefits**:

- **Clear Intent**: Component location indicates its purpose immediately
- **Easy Discovery**: "Where's the skip links?" → `layout/`
- **Stable Structure**: Purpose changes less frequently than size/complexity
- **No Subjectivity**: Clear rules for placement (see Decision Matrix below)

---

## Component Categories

### 1. `components/layout/`

**Purpose**: Structure, navigation, and accessibility
**Examples**: skip-links, header, footer, sidebar

**When to use**:

- Component provides page structure
- Required for accessibility (WCAG)
- Present across multiple pages consistently

```
layout/
└── skip-links/
    ├── index.tsx
    ├── skip-links.module.css
    └── index.spec.tsx
```

---

### 2. `components/sections/`

**Purpose**: Page content blocks (Hero, About, Projects, Contact)
**Examples**: hero-section, about-section, projects-grid, contact-form

**When to use**:

- Component represents a complete page section
- Contains multiple sub-components or content blocks
- Usually full-width or major layout element

```
sections/
├── hero/
│   ├── index.tsx
│   ├── hero.module.css
│   └── index.spec.tsx
└── projects/
    ├── index.tsx
    ├── projects.module.css
    └── index.spec.tsx
```

> **Note**: Currently empty. Sections will be created as the portfolio evolves.

---

### 3. `components/seo/`

**Purpose**: SEO metadata and structured data
**Examples**: seo (meta tags), structured-data (JSON-LD)

**When to use**:

- Component generates SEO-related output
- Works with Next.js Metadata API
- Implements Schema.org structured data

```
seo/
├── seo/
│   └── index.tsx
└── structured-data/
    └── index.tsx
```

---

### 4. `components/providers/`

**Purpose**: React Context providers, analytics, tracking
**Examples**: web-vitals-tracker, analytics-provider, error-boundary

**When to use**:

- Component wraps children with context/state
- Provides observability (analytics, monitoring)
- Handles global concerns (errors, performance)

```
providers/
└── web-vitals-tracker/
    ├── index.tsx
    └── index.spec.tsx
```

---

### 5. `lib/infrastructure/`

**Purpose**: System-level utilities (not React components)
**Examples**: bfcache-handler, route-announcer, service-worker-registration

**When to use**:

- Low-level browser API interactions
- Performance optimizations (BFCache, Service Workers)
- Accessibility utilities (route announcements)
- NOT visual components

```
lib/
└── infrastructure/
    ├── bfcache-handler/
    ├── route-announcer/
    └── service-worker-registration/
```

---

## Decision Matrix

Use this flowchart when deciding where to place a new component:

```
┌─────────────────────────────────────┐
│  Does it provide page structure or  │
│  accessibility scaffolding?          │
└───────────┬─────────────────────────┘
            │ YES → components/layout/
            │
            NO
            │
┌───────────▼─────────────────────────┐
│  Is it a complete page section?     │
│  (Hero, About, Projects, etc.)       │
└───────────┬─────────────────────────┘
            │ YES → components/sections/
            │
            NO
            │
┌───────────▼─────────────────────────┐
│  Is it SEO/metadata related?         │
│  (Meta tags, JSON-LD)                │
└───────────┬─────────────────────────┘
            │ YES → components/seo/
            │
            NO
            │
┌───────────▼─────────────────────────┐
│  Does it wrap children with context, │
│  analytics, or global state?         │
└───────────┬─────────────────────────┘
            │ YES → components/providers/
            │
            NO
            │
┌───────────▼─────────────────────────┐
│  Is it a system utility without UI?  │
│  (BFCache, Service Workers, etc.)    │
└───────────┬─────────────────────────┘
            │ YES → lib/infrastructure/
            │
            NO → Reconsider if component is needed
```

---

## Shared UI Library (`libs/shared/ui/`)

**Purpose**: Truly reusable components that could work in ANY app.

**Key Differences**:

1. **Storybook Required**: All components MUST have `.stories.tsx` files
2. **Exported via Barrel**: `libs/shared/ui/src/index.ts`
3. **Zero App Dependencies**: No imports from `apps/shell/`
4. **Framework Agnostic**: Components should be generic, not domain-specific

**Current Structure**: Flat organization (1 component)

```
libs/shared/ui/src/lib/
└── button/         # Generic button component
    ├── button.tsx
    ├── button.module.css
    ├── button.spec.tsx
    └── button.stories.tsx
```

**Guidelines**:

- Only add components that are:
  - **Generic**: Not coupled to portfolio domain
  - **Reusable**: Could be used in another project
  - **Well-tested**: 70%+ coverage
  - **Documented**: Storybook stories with all variants

### Growth Strategy

**Flat-First Approach**: Keep flat structure until reaching **8+ components** OR **3+ natural groups** emerge.

**When to Group** (Future State):

Once the library reaches critical mass, introduce purpose-based grouping:

```
libs/shared/ui/src/lib/
├── forms/
│   ├── button/
│   ├── input/
│   ├── select/
│   └── checkbox/
├── feedback/
│   ├── alert/
│   ├── toast/
│   └── spinner/
└── layout/
    ├── container/
    ├── grid/
    └── stack/
```

**Grouping Criteria**:

- **Functional cohesion**: Components serve similar purposes
- **Usage patterns**: Frequently imported together (5+ co-imports)
- **Maintenance burden**: Category has 3+ components OR components >100 LOC each

**Pre-approved Categories**:

- `forms/` - Input, select, checkbox, textarea, radio
- `feedback/` - Alert, toast, banner, spinner, progress
- `layout/` - Container, grid, stack, spacer, divider
- `overlays/` - Modal, dialog, popover, tooltip, drawer
- `data-display/` - Table, card, badge, avatar, list
- `navigation/` - Tabs, breadcrumb, pagination, menu, stepper

### Storybook Title Conventions

**Current State** (Flat Structure):

```typescript
// button.stories.tsx
export default {
  title: 'Components/Button', // Flat category
  component: Button,
};
```

**Future State** (Grouped Structure):

```typescript
// forms/button/button.stories.tsx
export default {
  title: 'Forms/Button', // Mirrors directory structure
  component: Button,
};
```

**Rule**: Story titles MUST mirror directory structure for consistency.

- Flat structure → `'Components/ComponentName'`
- Grouped structure → `'CategoryName/ComponentName'`
- Maximum 1-level nesting (no `'Forms/Inputs/Button'`)

### Import Path Stability Guarantee

**Public API Contract**: All components are exported from package root regardless of internal structure.

```typescript
// ✅ ALWAYS CORRECT - Import from package root
import { Button } from '@erikunha-portifolio/ui';

// ❌ NEVER DO THIS - No deep imports
import { Button } from '@erikunha-portifolio/ui/forms/button';
import { Button } from '@erikunha-portifolio/ui/button';
```

**Guarantee**: Internal reorganization (flat → grouped) will NEVER break consumer imports.

**Implementation**: Two-tier barrel export system (when grouped):

1. **Category barrels** (`lib/forms/index.ts`) - Export all category components
2. **Root barrel** (`src/index.ts`) - Re-export from category barrels

```typescript
// lib/forms/index.ts (internal)
export * from './button/button';
export * from './input/input';

// src/index.ts (public API)
export * from './lib/forms'; // Consumers see flat imports
```

**Benefits**:

- Consumer code never breaks during reorganization
- Tree-shaking optimized via category barrels
- Clear separation between public API and internal structure

```
libs/shared/ui/src/lib/
└── button/
    ├── button.tsx
    ├── button.module.css
    ├── button.spec.tsx
    └── button.stories.tsx  ← REQUIRED
```

---

## File Naming Conventions

### App-Specific Components (apps/shell/components/)

```
components/layout/skip-links/
├── index.tsx                    ← Default export, main component
├── skip-links.module.css        ← Co-located styles (zero-runtime)
└── index.spec.tsx               ← Tests (70%+ coverage target)
```

**Rules**:

- ❌ **NO** `.stories.tsx` files (app-coupled, not for Storybook)
- ❌ **NO** barrel exports (direct imports only)
- ✅ Single `index.tsx` with default export or named component
- ✅ CSS Modules with design tokens from `libs/shared/styles`
- ✅ Tests co-located in same folder

### Shared UI Components (libs/shared/ui/)

```
libs/shared/ui/src/lib/button/
├── button.tsx                   ← Named export
├── button.module.css            ← Styles
├── button.spec.tsx              ← Tests
└── button.stories.tsx           ← REQUIRED for Storybook
```

**Rules**:

- ✅ **MUST** have `.stories.tsx` files
- ✅ Exported from `libs/shared/ui/src/index.ts`
- ✅ Named exports, not default
- ✅ Storybook documentation for all variants
- ✅ Flat structure until 8+ components, then purpose-based grouping

---

## Best Practices

### 1. Keep Components Focused

**Good**:

```tsx
// components/layout/skip-links/index.tsx
export function SkipLinks() {
  // Single responsibility: accessibility navigation
}
```

**Bad**:

```tsx
// components/layout/skip-links/index.tsx
export function SkipLinks() {
  // Mixing concerns: skip links + header + footer
}
```

### 2. Co-locate Related Files

```
layout/skip-links/
├── index.tsx               ← Component logic
├── skip-links.module.css   ← Styles (right next to component)
└── index.spec.tsx          ← Tests (right next to component)
```

### 3. Use Design Tokens

```css
/* ✅ CORRECT - skip-links.module.css */
.link {
  background: var(--color-primary-500);
  padding: var(--spacing-3);
  transition: all var(--transition-normal);
}

/* ❌ WRONG - hardcoded values */
.link {
  background: #3b82f6;
  padding: 12px;
}
```

### 4. Write Purpose-Driven Tests

Test behavior and outcomes, not implementation details. Focus on what the component does for users.

---

## When to Add New Categories

**Only if**:

1. You have 5+ components that don't fit existing categories
2. The new category represents a clear, distinct purpose
3. The team agrees on the definition

**Example scenarios**:

- Adding `forms/` if building complex multi-step forms
- Adding `charts/` if adding extensive data visualization
- Adding `admin/` if building admin-specific features

**DO NOT**:

- Create categories for 1-2 components
- Use vague names like `common/`, `shared/`, `utils/`
- Create categories based on component size or complexity

---

## Related Documentation

- [.github/copilot-instructions.md](.github/copilot-instructions.md) - AI-optimized guidelines with decision trees
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System design and technical stack
- [CSS_GUIDELINES.md](../CSS_GUIDELINES.md) - Styling best practices
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Developer onboarding

---

## FAQ

### Q: What if a component fits multiple categories?

**A**: Choose based on **primary purpose**:

- `skip-links` provides navigation → `layout/` (even though it has UI)
- `web-vitals-tracker` is analytics → `providers/` (even though it's infrastructure)
- `structured-data` is SEO → `seo/` (even though it could be considered infrastructure)

### Q: Should I create sections/ components now?

**A**: No. Wait until you have actual content sections to implement. Empty folders add noise without value.

### Q: Can I move components between categories?

**A**: Yes, if their purpose changes. Update imports and tests, then commit with a `refactor(shell)` message explaining the rationale.

### Q: How do I organize shared UI components?

**A**: Keep them **flat** in `libs/shared/ui/src/lib/` until reaching 8+ components. Each component gets its own folder with all related files (tsx, css, spec, stories).

**Current** (1 component):

```
lib/
└── button/
```

**Future** (8+ components):

```
lib/
├── forms/
│   ├── button/
│   └── input/
└── feedback/
    └── alert/
```

**Import stability**: Always import from package root (`@erikunha-portifolio/ui`), never deep imports. Internal structure changes won't break consumer code.

---

**Platform Version**: 0.0.0
