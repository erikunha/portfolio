# Shared UI Library

Pure, reusable UI components built with CSS Modules and design tokens.

## Components

- **Button**: Primary, secondary, ghost, and danger variants with loading states
- More components coming soon...

## Storybook

View all components in Storybook:

```bash
pnpm storybook
```

Open [http://localhost:6006](http://localhost:6006)

## Development

### Running unit tests

```bash
pnpm nx test ui
```

### Building Storybook

```bash
pnpm nx build-storybook ui
```

## Guidelines

- All components use CSS Modules (no runtime CSS-in-JS)
- Design tokens from `@erikunha/shared/styles`
- Full accessibility (WCAG AA minimum)
- TypeScript strict mode
- 100% Storybook coverage for all components
