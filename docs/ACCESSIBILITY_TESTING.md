# Accessibility Testing Guide - Principal Level

## Overview

Comprehensive accessibility testing procedures for WCAG 2.1 AAA compliance in the Matrix Portfolio Design System.

## Automated Testing with jest-axe

### Setup

```typescript
import { axe } from 'jest-axe';
import { render } from '@testing-library/react';

test('component passes accessibility tests', async () => {
  const { container } = render(<Component />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Rules Covered by jest-axe

- **Color contrast** (WCAG AAA: 7:1 for normal text, 4.5:1 for large text)
- **Keyboard navigation** (all interactive elements focusable)
- **ARIA attributes** (valid roles, states, and properties)
- **Form labels** (all inputs have associated labels)
- **Heading hierarchy** (proper h1-h6 structure)
- **Alt text** (all images have meaningful alternatives)
- **Focus management** (logical focus order)

## Manual Keyboard Testing

### Essential Keyboard Patterns

#### Tab Navigation

```typescript
test('component is keyboard accessible', async () => {
  const user = setupUser();
  render(<Component />);

  // Tab to first interactive element
  await user.tab();
  expect(screen.getByRole('button')).toHaveFocus();

  // Continue tabbing through all interactive elements
  await user.tab();
  expect(screen.getByRole('link')).toHaveFocus();
});
```

#### Enter/Space Activation

```typescript
test('activates on Enter key', async () => {
  const handleClick = jest.fn();
  const user = setupUser();
  render(<Button onClick={handleClick}>Click me</Button>);

  const button = screen.getByRole('button');
  button.focus();
  await user.keyboard('{Enter}');

  expect(handleClick).toHaveBeenCalled();
});

test('activates on Space key', async () => {
  const handleClick = jest.fn();
  const user = setupUser();
  render(<Button onClick={handleClick}>Click me</Button>);

  const button = screen.getByRole('button');
  button.focus();
  await user.keyboard(' ');

  expect(handleClick).toHaveBeenCalled();
});
```

#### Escape Key (Dismiss)

```typescript
test('closes modal on Escape key', async () => {
  const handleClose = jest.fn();
  const user = setupUser();
  render(<Modal onClose={handleClose} />);

  await user.keyboard('{Escape}');

  expect(handleClose).toHaveBeenCalled();
});
```

#### Arrow Key Navigation

```typescript
test('navigates menu with arrow keys', async () => {
  const user = setupUser();
  render(<Menu />);

  const firstItem = screen.getByRole('menuitem', { name: 'First' });
  firstItem.focus();

  await user.keyboard('{ArrowDown}');
  expect(screen.getByRole('menuitem', { name: 'Second' })).toHaveFocus();

  await user.keyboard('{ArrowUp}');
  expect(firstItem).toHaveFocus();
});
```

### Manual Testing Checklist

- [ ] **Tab Order**: Logical progression through all interactive elements
- [ ] **Skip Links**: First Tab reveals skip navigation
- [ ] **Focus Visible**: Clear focus indicators on all elements
- [ ] **No Keyboard Traps**: Can tab through and escape all components
- [ ] **Enter/Space**: Both keys activate buttons and links
- [ ] **Escape**: Dismisses modals, dropdowns, and overlays
- [ ] **Arrow Keys**: Navigate through menus, tabs, and lists

## Screen Reader Testing

### VoiceOver (macOS)

```bash
# Enable VoiceOver
Cmd + F5

# Navigate
Control + Option + Right Arrow (next element)
Control + Option + Left Arrow (previous element)
Control + Option + Space (activate)
```

### Testing Patterns

```typescript
test('announces navigation to screen readers', async () => {
  render(<Component />);

  // Verify ARIA live region exists
  const liveRegion = screen.getByRole('status'); // or alert, log
  expect(liveRegion).toHaveAttribute('aria-live', 'polite');

  // Trigger action that announces
  const button = screen.getByRole('button');
  await user.click(button);

  // Verify announcement content
  await waitFor(() => {
    expect(liveRegion).toHaveTextContent('Action completed');
  });
});
```

### ARIA Attribute Testing

```typescript
test('has correct ARIA attributes', () => {
  render(<Button loading>Loading</Button>);

  const button = screen.getByRole('button');

  // Loading state
  expect(button).toHaveAttribute('aria-busy', 'true');

  // Label
  expect(button).toHaveAttribute('aria-label', expect.any(String));

  // Disabled
  expect(button).toHaveAttribute('aria-disabled', 'false');
});

test('interactive button has correct ARIA attributes', () => {
  render(<Button />);

  const button = screen.getByRole('button');
  expect(button).toHaveAttribute('type', 'button');
});
```

### Screen Reader Checklist

- [ ] **Meaningful Labels**: All controls have descriptive labels
- [ ] **Button Text**: Not just "click here" or "learn more"
- [ ] **Link Purpose**: Clear destination (not just "read more")
- [ ] **Form Fields**: Labels announced before inputs
- [ ] **Error Messages**: Associated with form fields via aria-describedby
- [ ] **Live Regions**: Dynamic content announced
- [ ] **Hidden Content**: Properly hidden from screen readers (aria-hidden)

## Color Contrast Testing

### Automated Contrast Checks

```typescript
test('meets WCAG AAA contrast ratios', async () => {
  const { container } = render(<Component />);

  const results = await axe(container, {
    rules: {
      'color-contrast': { enabled: true },
    },
  });

  expect(results).toHaveNoViolations();
});
```

### Manual Contrast Verification

```typescript
test('text has sufficient contrast', () => {
  render(<Component />);

  const element = screen.getByText('Important text');
  const styles = window.getComputedStyle(element);

  // WCAG AAA requires:
  // - 7:1 for normal text (< 18px or < 14px bold)
  // - 4.5:1 for large text (>= 18px or >= 14px bold)

  // Use contrast checker library for precise verification
  const backgroundColor = styles.backgroundColor;
  const textColor = styles.color;

  // Verify contrast meets requirements
  // Implementation depends on contrast calculation library
});
```

### Contrast Checklist

- [ ] **Normal Text**: 7:1 contrast ratio (WCAG AAA)
- [ ] **Large Text**: 4.5:1 contrast ratio (18px+ or 14px+ bold)
- [ ] **Interactive Elements**: 3:1 contrast for boundaries
- [ ] **Focus Indicators**: 3:1 contrast against background
- [ ] **Disabled State**: Still readable (though lower contrast allowed)

## Touch Target Testing

### Minimum Size Verification

```typescript
test('meets minimum touch target size', () => {
  render(<Button>Click me</Button>);

  const button = screen.getByRole('button');
  const { width, height } = button.getBoundingClientRect();

  // WCAG 2.1 AAA: Minimum 44x44px
  expect(width).toBeGreaterThanOrEqual(44);
  expect(height).toBeGreaterThanOrEqual(44);
});
```

### Touch Target Checklist

- [ ] **Buttons**: Minimum 44x44px
- [ ] **Links**: Adequate padding for touch
- [ ] **Form Inputs**: Minimum 44px height
- [ ] **Icons**: 44x44px clickable area (even if icon is smaller)
- [ ] **Spacing**: Minimum 8px between touch targets

## Focus Management Testing

### Focus Trap Testing

```typescript
test('traps focus within modal', async () => {
  const user = setupUser();
  render(<Modal />);

  const firstElement = screen.getByRole('button', { name: 'Close' });
  const lastElement = screen.getByRole('button', { name: 'Submit' });

  // Tab from last element should wrap to first
  lastElement.focus();
  await user.tab();
  expect(firstElement).toHaveFocus();

  // Shift+Tab from first should wrap to last
  firstElement.focus();
  await user.tab({ shift: true });
  expect(lastElement).toHaveFocus();
});
```

### Focus Restoration Testing

```typescript
test('restores focus after modal closes', async () => {
  const user = setupUser();
  render(<App />);

  const openButton = screen.getByRole('button', { name: 'Open Modal' });
  await user.click(openButton);

  const closeButton = screen.getByRole('button', { name: 'Close' });
  await user.click(closeButton);

  // Focus should return to open button
  await waitFor(() => {
    expect(openButton).toHaveFocus();
  });
});
```

### Focus Management Checklist

- [ ] **Initial Focus**: Set on open (modal, dropdown, etc.)
- [ ] **Focus Trap**: Contained within modal/dialog
- [ ] **Focus Restoration**: Returns to trigger on close
- [ ] **Skip Links**: Available as first tab stop
- [ ] **Programmatic Focus**: Moved after dynamic content loads

## Semantic HTML Testing

### Landmark Testing

```typescript
test('has correct landmark structure', () => {
  render(<Page />);

  expect(screen.getByRole('banner')).toBeInTheDocument(); // <header>
  expect(screen.getByRole('navigation')).toBeInTheDocument(); // <nav>
  expect(screen.getByRole('main')).toBeInTheDocument(); // <main>
  expect(screen.getByRole('contentinfo')).toBeInTheDocument(); // <footer>
});
```

### Heading Hierarchy Testing

```typescript
test('has proper heading hierarchy', () => {
  render(<Page />);

  const headings = screen.getAllByRole('heading');

  // Should start with h1
  expect(headings[0].tagName).toBe('H1');

  // No heading levels should be skipped
  const levels = headings.map(h => parseInt(h.tagName[1]));
  for (let i = 1; i < levels.length; i++) {
    const diff = levels[i] - levels[i - 1];
    expect(diff).toBeLessThanOrEqual(1); // Can't skip levels
  }
});
```

### Semantic HTML Checklist

- [ ] **Landmarks**: Proper use of header, nav, main, footer
- [ ] **Headings**: Single h1, no skipped levels
- [ ] **Lists**: Use ul/ol for related items
- [ ] **Buttons vs Links**: Buttons for actions, links for navigation
- [ ] **Form Structure**: fieldset/legend for grouped inputs

## Reduced Motion Testing

### Respecting User Preferences

```typescript
test('respects prefers-reduced-motion', () => {
  mockMatchMedia('(prefers-reduced-motion: reduce)', true);

  render(<AnimatedComponent />);

  const element = screen.getByRole('button');
  const styles = window.getComputedStyle(element);

  // Animations should be disabled or reduced
  expect(styles.animationDuration).toBe('0s');
  // or expect(styles.animationDuration).toBe('0.01s'); // Minimal duration
});
```

### Reduced Motion Checklist

- [ ] **Disable Animations**: Remove transitions for reduced-motion
- [ ] **Essential Motion Only**: Keep motion that conveys meaning
- [ ] **Instant Transitions**: Use 0s or minimal duration
- [ ] **No Parallax**: Remove scroll-based animations

## Testing Tools & Libraries

### Installed Tools

- `@testing-library/react@16.1.0` - React component testing
- `@testing-library/jest-dom@6.6.3` - Custom Jest matchers
- `@testing-library/user-event@14.5.2` - User interaction simulation
- `jest-axe@9.0.0` - Accessibility testing
- `axe-core@4.10.2` - WCAG compliance engine

### Browser Extensions for Manual Testing

- **axe DevTools**: Automated accessibility scanning
- **WAVE**: Visual accessibility checker
- **Lighthouse**: Performance and accessibility audits
- **Color Contrast Analyzer**: WCAG contrast verification

## Continuous Integration

### Pre-commit Hooks

```bash
# .husky/pre-commit
pnpm nx affected:test --parallel=3
```

### CI Pipeline

```yaml
# .github/workflows/test.yml
- name: Run accessibility tests
  run: pnpm nx affected:test --coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

## Coverage Requirements

### Minimum Thresholds

- **Statements**: 90%
- **Branches**: 85%
- **Functions**: 90%
- **Lines**: 90%

### Critical Components (95% coverage required)

- SkipLinks
- Button
- All accessibility utilities

## Resources

### WCAG 2.1 Documentation

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Understanding WCAG 2.1](https://www.w3.org/WAI/WCAG21/Understanding/)
- [Techniques for WCAG 2.1](https://www.w3.org/WAI/WCAG21/Techniques/)

### Testing Documentation

- [Testing Library Best Practices](https://testing-library.com/docs/guiding-principles/)
- [jest-axe Documentation](https://github.com/nickcolley/jest-axe)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)

### Tools

- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE Browser Extension](https://wave.webaim.org/extension/)
- [Color Contrast Checker](https://webaim.org/resources/contrastchecker/)
