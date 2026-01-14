/**
 * Test Utilities - Principal Level
 *
 * Custom render function and testing helpers for React components
 * Wraps components with necessary providers and context
 */

import { RenderOptions, RenderResult, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement } from 'react';

/**
 * Custom render options extending RTL's RenderOptions
 */
type CustomRenderOptions = Omit<RenderOptions, 'wrapper'>;

/**
 * Custom render function that wraps components with providers
 *
 * Usage:
 * ```tsx
 * const { getByRole } = renderWithProviders(<Button>Click me</Button>);
 * ```
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: CustomRenderOptions,
): RenderResult {
  // TODO: Add providers here when needed
  return render(ui, { ...options });
}

/**
 * Create a configured userEvent instance
 * Recommended over fireEvent for more realistic user interactions
 *
 * Usage:
 * ```tsx
 * const user = setupUser();
 * await user.click(button);
 * await user.type(input, 'Hello');
 * ```
 */
export function setupUser() {
  return userEvent.setup();
}

/**
 * Wait for accessibility violations check
 * Wraps jest-axe with better error messages
 *
 * Usage:
 * ```tsx
 * const { container } = render(<Component />);
 * await expectNoA11yViolations(container);
 * ```
 */
export async function expectNoA11yViolations(container: Element) {
  // Dynamic import to avoid issues in Next.js build
  // @ts-expect-error: jest-axe is a dev dependency, not available in production builds
  const jestAxe = await import('jest-axe');
  const results = await jestAxe.axe(container);
  expect(results).toHaveNoViolations();
}

/**
 * Mock Next.js router with custom values
 *
 * Usage:
 * ```tsx
 * mockNextRouter({ pathname: '/about' });
 * ```
 */
export async function mockNextRouter(
  router: Partial<ReturnType<typeof import('next/navigation').useRouter>> = {},
) {
  const nextNavigation = await import('next/navigation');
  const useRouter = nextNavigation.useRouter as jest.Mock;
  useRouter.mockReturnValue({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    ...router,
  });
}

/**
 * Mock window.matchMedia for media query tests
 *
 * Usage:
 * ```tsx
 * mockMatchMedia('(prefers-reduced-motion: reduce)', true);
 * ```
 */
export function mockMatchMedia(query: string, matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((q: string) => ({
      matches: q === query ? matches : false,
      media: q,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

/**
 * Get all accessible roles in a container
 * Useful for debugging what's actually rendered
 *
 * Usage:
 * ```tsx
 * const { container } = render(<Component />);
 * console.log(getRoles(container));
 * ```
 */
export function getRoles(container: Element): string[] {
  const roles = new Set<string>();
  const elements = container.querySelectorAll('[role]');
  elements.forEach((el) => {
    const role = el.getAttribute('role');
    if (role) {
      roles.add(role);
    }
  });
  return Array.from(roles);
}

/**
 * Wait for element to be removed from DOM
 * Useful for testing animations and transitions
 */
export { waitForElementToBeRemoved } from '@testing-library/react';

// Re-export everything from RTL for convenience
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
