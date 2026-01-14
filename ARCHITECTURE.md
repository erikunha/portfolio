# Enterprise React + Next.js Platform Architecture

## Executive Summary

This platform is designed for **long-term evolution**, **enterprise scalability**, and **predictable operations**. Every architectural decision prioritizes maintainability, performance, and team autonomy over short-term convenience.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architectural Principles](#architectural-principles)
3. [Technology Stack](#technology-stack)
4. [Repository Structure](#repository-structure)
5. [Portfolio Features](#portfolio-features)
6. [Domain Architecture](#domain-architecture)
7. [Styling Strategy](#styling-strategy)
8. [Data Flow & State Management](#data-flow--state-management)
9. [Performance Strategy](#performance-strategy)
10. [Security Model](#security-model)
11. [Testing Strategy](#testing-strategy)
12. [Deployment Architecture](#deployment-architecture)

---

## System Overview

### What This Platform Is

A **modern portfolio platform** built on Next.js 16+ with:

- **Server-first architecture** (React Server Components as default)
- **Nx monorepo** for deterministic builds and dependency management
- **Zero runtime styling** (CSS Modules + CSS Variables only)
- **Strict TypeScript** (no `any` without explicit justification)
- **SEO & Accessibility** (Metadata API, JSON-LD, WCAG AA)
- **Performance Optimization** (Core Web Vitals tracking, font optimization)
- **Automated versioning** via Semantic Release

### What This Platform Is NOT

- ❌ A rapid prototyping sandbox
- ❌ A playground for experimental libraries
- ❌ A Tailwind/styled-components codebase
- ❌ A client-side single-page application

---

## Architectural Principles

### 1. Build-Time Over Runtime

All decisions that can be made at build time MUST be made at build time:

- CSS compilation (no runtime CSS-in-JS)
- Type checking (strict TypeScript)
- Bundle optimization
- Dead code elimination

### 2. Explicit Over Magical

Framework "magic" is minimized:

- No hidden conventions
- No implicit state management
- No auto-generated files that developers don't control
- Explicit imports, explicit contracts

### 3. Predictability Over Elegance

Code should be:

- **Boring** and **obvious**
- Debuggable without deep framework knowledge
- Understandable by any senior engineer within 30 minutes

### 4. Long-Term Cost Over Short-Term Speed

- Dependencies are evaluated as **liabilities**
- Abstractions are added only after patterns repeat 3+ times
- Performance is measured and enforced via budgets

### 5. No Framework Lock-In

All business logic resides in framework-agnostic code:

- Domain logic never imports React
- Use cases never import Next.js
- Infrastructure adapters are replaceable

---

## Technology Stack

### Core Framework

| Layer               | Technology               | Justification                        |
| ------------------- | ------------------------ | ------------------------------------ |
| **Framework**       | Next.js 16+ (App Router) | SSR, Streaming, RSC, Edge support    |
| **Runtime**         | Node.js 22+              | LTS, modern JS features              |
| **Package Manager** | pnpm 10+                 | Fast, deterministic, disk-efficient  |
| **Monorepo**        | Nx 22+ (Integrated Mode) | Task orchestration, dependency graph |

### Styling

| Layer             | Technology                           | Justification                      |
| ----------------- | ------------------------------------ | ---------------------------------- |
| **Scoped Styles** | CSS Modules                          | Zero runtime, compile-time scoping |
| **Design Tokens** | CSS Variables                        | Theme-able, zero JS runtime        |
| **❌ Forbidden**  | Tailwind, Styled Components, Emotion | Runtime cost, hard to audit        |

### State Management

| Type             | Strategy                          | Tools                  |
| ---------------- | --------------------------------- | ---------------------- |
| **Server State** | Server Components + Fetch         | Native Next.js caching |
| **Client State** | React `useState` / `useReducer`   | Minimal, isolated      |
| **Global State** | Explicit context (justified only) | No Redux without ADR   |

### Testing

| Layer           | Tool                   | Coverage Target                     |
| --------------- | ---------------------- | ----------------------------------- |
| **Unit**        | Jest                   | Pure functions, domain logic (80%+) |
| **Integration** | Jest + Testing Library | Feature flows (70%+)                |
| **E2E**         | Playwright             | Critical paths (core journeys only) |
| **Visual**      | Storybook              | UI components (100% of shared lib)  |

---

## Repository Structure

```
apps/
  shell/                    # Portfolio application (Next.js 16 + App Router)
    components/
      layout/               # Page structure & navigation
      sections/             # Page content blocks
      ui/                   # Interactive controls
      seo/                  # Metadata & structured data
      providers/            # Context & analytics

libs/
  shared/
    ui/                     # Pure UI components (purpose-based organization)
      src/lib/
        button/             # Generic button with variants
    styles/                 # Design tokens (CSS Variables, 400+ tokens)
    domain/                 # Portfolio types and business logic

e2e/                        # Playwright E2E tests with accessibility checks

tools/
  semantic-release/         # Release automation
```

### Component Organization (Purpose-Based)

This project follows **Purpose-Based Organization**:

- **layout/** → Page structure and navigation (skip-links, header, footer)
- **sections/** → Page content blocks (hero, about, projects)
- **seo/** → SEO metadata and structured data
- **providers/** → Context providers and analytics
- **lib/infrastructure/** → System utilities (BFCache, Service Workers)

**Benefits**:

- Clear component purpose
- Intuitive discoverability
- Predictable testing strategy
- Easy onboarding

**Documentation**: See [docs/STRUCTURE.md](docs/STRUCTURE.md) for detailed guidelines.

### Dependency Rules (Enforced by ESLint)

- **Apps** can depend on: `libs/shared/*`
- **libs/shared/ui** can depend on: `libs/shared/styles`
- **libs/shared/domain** can depend on: NOTHING (pure logic)
- **Violations block commits** (Husky pre-commit hook)

---

## Portfolio Features

### SEO Optimization

- **Next.js Metadata API**: Type-safe metadata with OpenGraph and Twitter cards
- **Structured Data**: JSON-LD for Person and WebSite schemas (Google-compatible)
- **Dynamic Sitemap**: Auto-generated sitemap.xml with proper priorities
- **Robots.txt**: SEO-friendly crawling configuration

### Accessibility

- **WCAG AA Compliance**: Semantic HTML, ARIA labels, keyboard navigation
- **Skip Links**: Direct navigation to main content
- **Automated Testing**: Playwright + @axe-core/playwright in E2E tests
- **Focus Management**: Clear focus indicators and logical tab order

### Performance

- **Core Web Vitals**: Client-side tracking with console logging
- **Font Optimization**: font-display: swap, preconnect to Google Fonts
- **Standalone Build**: Optimized output for minimal deployment size
- **Server Components**: Default to RSC for minimal JavaScript

---

## Domain Architecture

### Layers

```
UI Layer (React Components)
    ↓
Application Layer (Use Cases)
    ↓
Domain Layer (Business Rules)
    ↓
Infrastructure Layer (HTTP, DB, etc.)
```

### Rules

- **UI never imports Infrastructure**
- **Domain never imports React**
- **Infrastructure contains no business logic**

---

## Styling Strategy

### Design Tokens (CSS Variables)

All visual decisions are defined in `libs/shared/styles/src/tokens.css`:

- Colors (semantic + primitive)
- Typography (font families, sizes, weights)
- Spacing (8pt grid system)
- Border radius, shadows, z-index layers
- Motion (durations, easing functions)

### CSS Modules

All components use CSS Modules:

```tsx
import styles from './button.module.css';

<button className={styles.primary}>Click Me</button>;
```

---

## Data Flow & State Management

### Server State

Handled by Server Components:

```tsx
// Server Component (default)
export default async function Page() {
  const data = await fetch('https://api.example.com/data');
  return <div>{data.title}</div>;
}
```

### Client State

Isolated to UI concerns:

```tsx
'use client';

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

### Global State

Requires ADR (Architectural Decision Record) justification.

---

## Performance Strategy

### Constraints (Enforced in CI)

| Metric                             | Budget  |
| ---------------------------------- | ------- |
| **First Contentful Paint (FCP)**   | < 1.5s  |
| **Largest Contentful Paint (LCP)** | < 2.5s  |
| **Cumulative Layout Shift (CLS)**  | < 0.1   |
| **Total Blocking Time (TBT)**      | < 200ms |

### Enforcement

- **Bundle analysis** on every PR
- **Core Web Vitals** tracked in production
- **PRs that violate budgets are blocked**

---

## Security Model

### Headers

All apps include security headers:

- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `X-Frame-Options`
- `X-XSS-Protection`
- `Referrer-Policy`

### CSP (Content Security Policy)

Defined per app, evaluated server-side.

---

## Testing Strategy

### Unit Tests

- Pure functions
- Domain logic
- 80%+ coverage required

### Integration Tests

- Feature-level flows
- Boundary validation
- 70%+ coverage required

### E2E Tests

- Critical user journeys only
- No brittle selectors
- Executed in CI on every merge

### Visual Regression

- Storybook snapshots
- Percy or Chromatic integration

---

## Deployment Architecture

### Build Pipeline

1. **Lint affected** → ESLint + TypeScript
2. **Test affected** → Jest + Playwright
3. **Build affected** → Next.js production build
4. **Bundle analysis** → Check performance budgets
5. **Deploy** → Vercel/AWS/GCP (per app)

### Release Process

Automated via **Semantic Release**:

1. Conventional Commits analyzed
2. Version bumped automatically
3. Changelog generated
4. Git tags created
5. Published to registry

---

## Observability

### Logging

- Structured JSON logs
- Correlation IDs for request tracing
- No `console.log` in production

### Metrics

- Feature-level metrics (not just infrastructure)
- Core Web Vitals tracked
- Error rates by feature

---

## Governance

### Code Review

- All code requires review
- PRs must pass CI (lint, test, build)
- Performance budgets enforced
- Husky pre-commit hooks block bad commits

### Documentation

All architectural decisions are documented in:

- `ARCHITECTURE.md` (this file)
- `DECISIONS.md` (ADR log)
- `CSS_GUIDELINES.md` (styling rules)
- `CONTRIBUTING.md` (onboarding guide)

---

## Onboarding

New engineers should:

1. Read this document (30 minutes)
2. Read `CONTRIBUTING.md` (20 minutes)
3. Run the app locally (10 minutes)
4. Complete first PR (modify a component)

**Expected time to first commit: 2 hours**

---

## Contact

For questions, open an issue or contact the platform team.
