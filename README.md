# Erik Henrique - Portfolio Platform

> Production-grade React + Next.js platform demonstrating enterprise architecture patterns, zero-runtime styling, and principal-level engineering practices.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.1+-black?logo=next.js)](https://nextjs.org/)
[![Turbopack](https://img.shields.io/badge/Turbopack-Enabled-ff6a00?logo=vercel)](https://turbo.build/)
[![Tests](https://img.shields.io/badge/tests-181%20passing-success)]()
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## Why This Exists

This isn't a portfolio template. It's a **reference implementation** of production patterns that scale:

- **Zero-runtime CSS** (build-time only, no CSS-in-JS bloat)
- **Server-first architecture** (RSC by default, client components are exceptions)
- **Type-safe everything** (strict TypeScript, no escape hatches)
- **Production infrastructure** (logging, monitoring, error tracking, rate limiting)
- **Enterprise patterns** (feature flags, structured logging, environment validation)

**Target audience**: Senior+ engineers evaluating architectural decisions for greenfield projects or migrations.

---

## Quick Start

```bash
# Prerequisites: Node.js 22+, pnpm 10+
pnpm install
pnpm dev                # http://localhost:3000 (with Turbopack)
```

**Development tools**:

```bash
pnpm test               # Jest unit tests
pnpm test:watch         # Watch mode
pnpm test:coverage      # Coverage report
pnpm e2e                # Playwright E2E
pnpm e2e:ui             # E2E interactive mode
pnpm build              # Production build
pnpm lint               # ESLint
pnpm format:write       # Format code
pnpm type-check         # TypeScript check
```

---

## Architecture Decisions

### 1. Build-Time Over Runtime

**Decision**: All styling compiled at build time. Zero JavaScript for CSS.

**Why**:

- Predictable bundle sizes
- No hydration cost for styles
- CSP-friendly (no `unsafe-inline` for dynamic styles)
- Easier to audit and debug

**Trade-off**: Less DX convenience vs. Tailwind, but orders of magnitude better runtime performance.

**Implementation**: CSS Modules + CSS Variables (400+ design tokens). See [CSS_GUIDELINES.md](CSS_GUIDELINES.md).

---

### 2. Server Components as Default

**Decision**: Every component is a Server Component unless it needs interactivity.

**Why**:

- Smaller JavaScript bundles (50%+ reduction)
- Better initial page load (no hydration waterfall)
- Direct database/API access without client-side fetching

**Trade-off**: Requires mindset shift from SPA patterns. Careful state management.

**Implementation**: Next.js 16 App Router. Client components marked with `'use client'` directive.

---

### 3. Standard Next.js Structure

**Decision**: Single Next.js application with flat, purpose-based component organization.

**Why**:

- Optimal for Next.js 16 with Turbopack
- Faster builds (no monorepo overhead)
- Simpler CI/CD (standard deployment)
- Better Vercel integration

**Trade-off**: Less separation between shared code. Must maintain internal boundaries.

**Implementation**:

```text
components/
  layout/       → Page structure & navigation
  seo/          → Metadata & structured data
  sections/     → Page content blocks
  shared/       → Reusable UI components
lib/            → Business logic, utilities, infrastructure
styles/         → Design tokens + global CSS
```

---

### 4. TypeScript Strict Mode

**Decision**: `strict: true` + additional checks (`noUncheckedIndexedAccess`, `noImplicitReturns`).

**Why**:

- Catch errors at compile time
- Self-documenting code
- Better IDE support
- Refactoring confidence

**Trade-off**: Slightly slower development. More explicit code.

**Implementation**: See [tsconfig.base.json](tsconfig.base.json).

---

### 5. Production Infrastructure (Zero-Cost)

**Decision**: Built-in logging, monitoring, error tracking, rate limiting—no external services required.

**Why**:

- Works everywhere (local dev, any cloud, on-prem)
- No vendor lock-in
- Full control over data
- Zero operational cost

**Implementation**:

- **Logging**: [apps/shell/lib/logger.ts](apps/shell/lib/logger.ts) - Structured console logging
- **Error Tracking**: Enhanced error boundary with recovery strategies
- **Rate Limiting**: In-memory limiter in middleware (60 req/min)
- **Feature Flags**: Runtime configuration via env vars + localStorage
- **Monitoring**: Core Web Vitals tracking

---

## Repository Structure

```text
app/                                  # Next.js 16 App Router application
  offline/                            # PWA offline fallback
  layout.tsx                          # Root layout (metadata, RSC)
  error.tsx                           # Global error boundary
components/                           # Purpose-based organization
  layout/                             # Page structure & navigation
    skip-links/                       # A11y skip navigation
  seo/                                # SEO & metadata
    seo/                              # SEO metadata management
    structured-data/                  # JSON-LD schema
  providers/                          # Context & analytics
    web-vitals-tracker/               # Performance monitoring
  sections/                           # Page content blocks
  shared/                             # Reusable UI components
    lib/button/                       # Generic button with variants
lib/
  logger/                             # Structured logging (dev + prod)
  feature-flags/                      # Runtime config system
  env/                                # Environment validation
  web-vitals/                         # Core Web Vitals tracking
  domain/                             # Business logic (framework-agnostic)
  stores/                             # Zustand state management
  infrastructure/                     # System utilities
    bfcache-handler/                  # Browser cache restoration
    route-announcer/                  # Accessibility (SR navigation)
    service-worker-registration/      # PWA + offline support
styles/                               # Design system
  tokens.css                          # 400+ CSS variables
  tokens.types.ts                     # Type-safe token access
middleware.ts                         # Rate limiting + security headers
public/
  sw.js                               # Service worker (offline-first)
  site.webmanifest                    # PWA manifest

e2e/                                  # Playwright tests + accessibility
```

**Component Organization**: This project follows [Purpose-Based Organization](docs/STRUCTURE.md) for component structure.

---

## Core Features

### 🎨 Design System (Matrix Theme)

- **400+ CSS Variables**: Colors, spacing, typography, shadows, animations
- **Type-Safe Access**: `getColor('brand-primary')` → `#1aff1a`
- **WCAG AAA Compliant**: 7:1 contrast ratios, full keyboard nav
- **Zero Runtime Cost**: All tokens compiled at build time
- **Purpose-Based Structure**: Components organized by function (layout, ui, seo, providers)

**Documentation**: [docs/MATRIX_DESIGN_SYSTEM.md](docs/MATRIX_DESIGN_SYSTEM.md) | [docs/STRUCTURE.md](docs/STRUCTURE.md)

---

### � Content & Structure

**English-Only Portfolio**:

- Hardcoded English content throughout
- Simplified content management without translation overhead
- Focus on performance and accessibility over internationalization
- Clean, semantic HTML structure

**Content Organization**:

- Hero section with introduction
- Portfolio projects showcase
- About section with skills and experience
- Contact information

**Future Considerations**:

- Add internationalization only if multi-language support becomes a requirement
- Consider headless CMS integration for dynamic content
- Evaluate next-intl or similar if i18n is needed

**Documentation**: [docs/STRUCTURE.md](docs/STRUCTURE.md)

---

### 🔐 Security

- **CSP Headers**: Strict Content Security Policy (no `unsafe-eval` in prod)
- **Rate Limiting**: 60 requests/minute per IP (in-memory)
- **Security Headers**: HSTS, X-Frame-Options, X-Content-Type-Options, Permissions-Policy
- **HTTPS Enforced**: Strict-Transport-Security with preload
- **No Runtime Secrets**: All sensitive config server-side only

---

### 📊 Observability

**Logging**:

```typescript
import { logger } from '@/lib/logger';

logger.info('User action', { userId: '123', action: 'click' });
logger.error('API failure', error, { endpoint: '/api/data' });
```

- Structured JSON logs
- Console logging (development and production)
- Development: Pretty-printed console
- Production: Parseable JSON for CloudWatch/Datadog/etc.

**Error Tracking**:

- Global error boundary with recovery options
- Automatic error logging with context
- Error IDs for debugging (digest tracking)

**Performance**:

- Core Web Vitals tracking (LCP, FID, CLS, INP, TTFB)
- Client-side metrics logged to console
- Performance budgets enforced in CI

---

### ♿ Accessibility

- **WCAG AA Compliant**: Semantic HTML, ARIA labels, keyboard navigation
- **Automated Testing**: jest-axe + Playwright axe checks
- **Skip Links**: Direct navigation to main content
- **Route Announcer**: Screen reader notifications on navigation
- **Focus Management**: Logical tab order, visible focus states
- **Print Styles**: Optimized for PDF generation/printing

**Testing**: All components have accessibility tests. See [docs/ACCESSIBILITY_TESTING.md](docs/ACCESSIBILITY_TESTING.md).

---

### 🚀 Performance

**Metrics** (enforced in CI):

- **FCP**: < 1.5s (First Contentful Paint)
- **LCP**: < 2.5s (Largest Contentful Paint)
- **CLS**: < 0.1 (Cumulative Layout Shift)
- **TBT**: < 200ms (Total Blocking Time)

**Optimizations**:

- Server Components by default (minimal JS)
- Standalone builds (optimized Docker images)
- Resource hints (dns-prefetch, preconnect)
- Font optimization (font-display: swap)
- Service Worker (offline-first caching)
- bfcache optimization (browser back/forward)

---

### 🧪 Testing Strategy

**Coverage**:

- **178 tests passing** (1 domain, 177 shell)
- **Unit Tests**: Jest 30 (80%+ coverage target)
- **Integration Tests**: Testing Library (component interactions)
- **E2E Tests**: Playwright (critical user journeys)
- **Accessibility Tests**: jest-axe + @axe-core/playwright
- **Visual Regression**: Storybook (all UI components)

**Philosophy**: Test behavior, not implementation. Prefer integration over unit tests.

---

## Development Workflow

### Local Development

```bash
pnpm dev                # Dev server with Turbopack (http://localhost:3000)
pnpm dev:debug          # Dev server with debugger
pnpm preview            # Preview production build locally
```

### Quality Checks

```bash
pnpm lint               # ESLint (strict rules)
pnpm lint:fix           # Auto-fix linting issues
pnpm format:write       # Format with Prettier
pnpm format:check       # Check formatting
pnpm type-check         # TypeScript compilation
pnpm validate           # Run all quality checks (type + lint + format + test)
```

### Testing

```bash
pnpm test               # Jest unit tests
pnpm test:watch         # Watch mode for development
pnpm test:coverage      # Generate coverage report
pnpm test:ci            # CI-optimized test run
pnpm test:unit          # Run only unit tests
pnpm test:changed       # Test only changed files
pnpm e2e                # Playwright E2E tests
pnpm e2e:ui             # Interactive E2E test UI
pnpm e2e:headed         # E2E tests with visible browser
pnpm e2e:debug          # Debug E2E tests
pnpm e2e:ci             # CI-optimized E2E with GitHub reporter
```

### Building

```bash
pnpm build              # Standard build
pnpm build:production   # Production-optimized build
pnpm build:analyze      # Build with bundle analysis
```

### Maintenance

```bash
pnpm clean              # Clean build cache
pnpm clean:full         # Full clean + reinstall
pnpm deps:check         # Check outdated dependencies
pnpm deps:update        # Interactive dependency updates
pnpm audit              # Security audit
```

### CI/CD

```bash
pnpm ci                 # Full CI pipeline (install + validate + E2E)
pnpm pre-push           # Pre-push checks (type-check + changed tests)
```

---

## Deployment

### Standalone Build (Recommended)

```bash
pnpm build:production
```

Output: `.next/standalone`

- **Size**: ~50MB (includes Node.js runtime)
- **Docker**: Single-stage build (no dependencies)
- **Startup**: < 1s
- **Memory**: ~100MB base

### Docker Example

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

### Environment Variables

Required:

- `NODE_ENV` - `production`

Optional:

- `NEXT_PUBLIC_SITE_URL` - Base URL (default: `https://erikunha.dev`)
- `NEXT_PUBLIC_FEATURE_*` - Feature flags (see [lib/feature-flags.ts](apps/shell/lib/feature-flags.ts))

---

## Technology Stack

**Framework & Build**:

- Next.js 16.1 (App Router, React 19, Turbopack)
- TypeScript 5.9 (strict mode)
- Nx 22 (monorepo orchestration)
- pnpm 10 (package management)

**Styling**:

- CSS Modules (scoped styles)
- CSS Variables (400+ design tokens)
- PostCSS (autoprefixer)

**Testing**:

- Jest 30 (unit tests)
- Playwright 1.57 (E2E)
- Testing Library 16 (component tests)
- jest-axe 9 (accessibility)
- Storybook 10 (visual documentation)

**Code Quality**:

- ESLint 9 (strict rules)
- Prettier 3.7 (formatting)
- Husky (pre-commit hooks)
- Commitlint (conventional commits)

**Production**:

- Structured logging (zero-dependency)
- Rate limiting (in-memory)
- Feature flags (env + localStorage)
- Service Worker (offline support)
- PWA manifest

---

## Documentation

**Architecture & Decisions**:

- [ARCHITECTURE.md](ARCHITECTURE.md) - System design, principles, patterns
- [DECISIONS.md](DECISIONS.md) - 14 Architectural Decision Records (ADRs)
- [SETUP_SUMMARY.md](SETUP_SUMMARY.md) - Complete setup walkthrough

**Guidelines**:

- [CONTRIBUTING.md](CONTRIBUTING.md) - Development workflow, PR process
- [CSS_GUIDELINES.md](CSS_GUIDELINES.md) - Styling rules, design tokens
- [docs/ACCESSIBILITY_TESTING.md](docs/ACCESSIBILITY_TESTING.md) - A11y testing guide
- [docs/WEB_VITALS.md](docs/WEB_VITALS.md) - Performance monitoring
- [docs/MATRIX_DESIGN_SYSTEM.md](docs/MATRIX_DESIGN_SYSTEM.md) - Design system docs

---

## Design Principles

### 1. Boring Technology

**Philosophy**: Choose proven, stable technologies over exciting new ones.

**Why**: 5-year maintenance horizon. Stability > novelty.

**Example**: CSS Modules (2015) over CSS-in-JS du jour.

---

### 2. Zero-Cost Infrastructure

**Philosophy**: Production-ready features without external services.

**Why**: Works anywhere. No vendor lock-in. Transparent costs.

**Example**: Built-in logging, monitoring, rate limiting—no SaaS required.

---

### 3. Build-Time Maximization

**Philosophy**: Decide at build time, not runtime.

**Why**: Faster runtime. Better performance. Easier debugging.

**Example**: CSS compilation, type checking, dead code elimination.

---

### 4. Progressive Disclosure

**Philosophy**: Simple by default. Complexity when needed.

**Why**: Flatten learning curve. Avoid premature optimization.

**Example**: Server Components first. Add client interactivity only when required.

---

### 5. No Magic

**Philosophy**: Explicit over implicit. Convention as documentation, not magic.

**Why**: Easier onboarding. Better debugging. Predictable behavior.

**Example**: No auto-imports, no hidden conventions, explicit file structure.

---

## Performance Benchmarks

**Lighthouse Score** (Production):

- Performance: **98/100**
- Accessibility: **100/100**
- Best Practices: **100/100**
- SEO: **100/100**

**Bundle Sizes**:

- First Load JS: **~80KB** (gzipped)
- Subsequent pages: **~10KB** (code splitting)
- CSS: **~15KB** (entire design system)

**Core Web Vitals** (P75):

- LCP: **1.2s** ✅
- FID: **50ms** ✅
- CLS: **0.05** ✅

---

## Trade-Offs & Alternatives

### Why Not Tailwind?

**Trade-off**: Developer convenience vs. runtime performance.

**Decision**: CSS Modules + tokens.

**Rationale**:

- Tailwind requires runtime parsing or large static builds
- CSS Modules are deterministic and fully tree-shakeable
- Design tokens provide same utility without bloat

**When to use Tailwind**: Rapid prototyping, small projects, teams unfamiliar with CSS.

---

### Why Not Turborepo?

**Trade-off**: Simplicity vs. features.

**Decision**: Nx.

**Rationale**:

- Nx has better task orchestration (affected commands, caching)
- Native Next.js/Storybook/Playwright support
- Dependency graph visualization
- Integrated code generation

**When to use Turborepo**: Simpler monorepos, Vercel ecosystem, less task complexity.

---

### Why Not Prisma?

**Trade-off**: Not applicable—no database yet.

**Decision**: Deferred until needed.

**Rationale**: Portfolio doesn't require persistence. Avoid premature complexity.

**When to add**: User auth, comments, analytics storage, CMS.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Development workflow
- Commit guidelines (Conventional Commits)
- PR process
- Code review standards

**TL;DR**:

```bash
git checkout -b feature/your-feature
# Make changes
pnpm validate           # Run all quality checks
git commit              # Uses commitizen for conventional commits
# Push and open PR
```

---

## License

MIT © [Erik Henrique Alves Cunha](https://erikunha.dev)

---

## Contact

- **Website**: [erikunha.dev](https://erikunha.dev)
- **Twitter**: [@erikunha](https://twitter.com/erikunha)
- **LinkedIn**: [Erik Henrique](https://linkedin.com/in/erikunha)

---

**Built with principal-level engineering for long-term sustainability.**
