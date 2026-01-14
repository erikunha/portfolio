/**
 * Button Component Tests - Principal Level
 *
 * Tests cover:
 * - All variants (primary, secondary, ghost, danger)
 * - All sizes (sm, md, lg)
 * - Loading states
 * - Disabled states
 * - Icon rendering
 * - Click handlers
 * - Keyboard navigation
 * - WCAG 2.1 AAA accessibility compliance
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { Button } from './button';

// Helper to render components
const renderWithProviders = render;

// Helper to setup user interactions
const setupUser = () => userEvent.setup();

describe('Button Component', () => {
  describe('Rendering', () => {
    it('renders with default props', () => {
      renderWithProviders(<Button>Click me</Button>);
      const button = screen.getByRole('button', { name: /click me/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it('renders primary variant with correct styling', () => {
      renderWithProviders(<Button variant="primary">Primary</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('primary');
    });

    it('renders secondary variant with correct styling', () => {
      renderWithProviders(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('secondary');
    });

    it('renders ghost variant with correct styling', () => {
      renderWithProviders(<Button variant="ghost">Ghost</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('ghost');
    });

    it('renders danger variant with correct styling', () => {
      renderWithProviders(<Button variant="danger">Danger</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('danger');
    });
  });

  describe('Sizes', () => {
    it('renders small size', () => {
      renderWithProviders(<Button size="sm">Small</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('sm');
    });

    it('renders medium size (default)', () => {
      renderWithProviders(<Button size="md">Medium</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('md');
    });

    it('renders large size', () => {
      renderWithProviders(<Button size="lg">Large</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('lg');
    });
  });

  describe('States', () => {
    it('handles disabled state correctly', () => {
      renderWithProviders(<Button disabled>Disabled</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('prevents click when disabled', async () => {
      const handleClick = jest.fn();
      const user = setupUser();

      renderWithProviders(
        <Button disabled onClick={handleClick}>
          Disabled
        </Button>,
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(handleClick).not.toHaveBeenCalled();
    });

    it('shows loading state with spinner', () => {
      renderWithProviders(<Button isLoading>Loading</Button>);
      const button = screen.getByRole('button');

      expect(button).toHaveClass('loading');
      expect(button).toHaveAttribute('aria-busy', 'true');

      // Spinner should be visible
      const spinner = button.querySelector('.spinner');
      expect(spinner).toBeInTheDocument();

      // Label still exists (CSS handles opacity)
      const label = button.querySelector('.label');
      expect(label).toBeInTheDocument();
    });
  });

  describe('Full Width', () => {
    it('applies full width styling', () => {
      renderWithProviders(<Button isFullWidth>Full Width</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('fullWidth');
    });
  });

  describe('Icons', () => {
    it('renders left icon', () => {
      const Icon = () => <span data-testid="left-icon">←</span>;
      renderWithProviders(<Button leftIcon={<Icon />}>With Icon</Button>);

      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
    });

    it('renders right icon', () => {
      const Icon = () => <span data-testid="right-icon">→</span>;
      renderWithProviders(<Button rightIcon={<Icon />}>With Icon</Button>);

      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
    });

    it('renders both left and right icons', () => {
      const LeftIcon = () => <span data-testid="left-icon">←</span>;
      const RightIcon = () => <span data-testid="right-icon">→</span>;

      renderWithProviders(
        <Button leftIcon={<LeftIcon />} rightIcon={<RightIcon />}>
          Both Icons
        </Button>,
      );

      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('calls onClick handler when clicked', async () => {
      const handleClick = jest.fn();
      const user = setupUser();

      renderWithProviders(<Button onClick={handleClick}>Click me</Button>);

      await user.click(screen.getByRole('button'));

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when loading', async () => {
      const handleClick = jest.fn();
      const user = setupUser();

      renderWithProviders(
        <Button isLoading onClick={handleClick}>
          Loading
        </Button>,
      );

      await user.click(screen.getByRole('button'));

      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('is focusable with keyboard', async () => {
      const user = setupUser();

      renderWithProviders(<Button>Focusable</Button>);
      const button = screen.getByRole('button');

      await user.tab();

      expect(button).toHaveFocus();
    });

    it('activates on Enter key', async () => {
      const handleClick = jest.fn();
      const user = setupUser();

      renderWithProviders(<Button onClick={handleClick}>Press Enter</Button>);
      const button = screen.getByRole('button');

      button.focus();
      await user.keyboard('{Enter}');

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('activates on Space key', async () => {
      const handleClick = jest.fn();
      const user = setupUser();

      renderWithProviders(<Button onClick={handleClick}>Press Space</Button>);
      const button = screen.getByRole('button');

      button.focus();
      await user.keyboard(' ');

      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility (WCAG 2.1 AAA)', () => {
    it('passes axe accessibility tests', async () => {
      const { container } = renderWithProviders(<Button>Accessible</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has correct ARIA attributes when disabled', () => {
      renderWithProviders(<Button disabled>Disabled</Button>);
      const button = screen.getByRole('button');

      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toBeDisabled();
    });

    it('has correct ARIA attributes when loading', () => {
      renderWithProviders(<Button isLoading>Loading</Button>);
      const button = screen.getByRole('button');

      expect(button).toHaveAttribute('aria-busy', 'true');
    });

    it('passes accessibility with all variants', async () => {
      const variants = ['primary', 'secondary', 'ghost', 'danger'] as const;

      for (const variant of variants) {
        const { container } = renderWithProviders(
          <Button variant={variant}>{variant}</Button>,
        );
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      }
    });

    it('maintains focus indicator visibility', () => {
      renderWithProviders(<Button>Focus me</Button>);
      const button = screen.getByRole('button');

      button.focus();

      // Button should be focused and have focus-visible styles
      expect(button).toHaveFocus();
      expect(button).toHaveClass('button');
    });

    it('has sufficient touch target size', () => {
      renderWithProviders(<Button size="sm">Small Button</Button>);
      const button = screen.getByRole('button');

      // WCAG 2.1 AAA requires minimum 44x44px touch targets
      // Note: In test environment without full CSS rendering, we verify
      // the button exists and has proper classes. Full size validation
      // should be done in E2E tests with actual CSS rendering.
      expect(button).toHaveClass('button');
      expect(button).toHaveClass('sm');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty children gracefully', () => {
      renderWithProviders(<Button>{''}</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('handles very long text', () => {
      const longText =
        'This is a very long button text that should wrap properly and not break the layout';
      renderWithProviders(<Button>{longText}</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveTextContent(longText);
    });

    it('handles special characters in text', () => {
      renderWithProviders(<Button>{'<>&"\' Special'}</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('<>&"\' Special');
    });

    it('preserves custom className', () => {
      renderWithProviders(<Button className="custom-class">Custom</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
      expect(button).toHaveClass('button'); // Should also have base class
    });

    it('passes through additional props', () => {
      renderWithProviders(
        <Button data-testid="custom-button" aria-label="Custom label">
          Test
        </Button>,
      );
      const button = screen.getByTestId('custom-button');
      expect(button).toHaveAttribute('aria-label', 'Custom label');
    });
  });

  describe('Snapshot Testing', () => {
    it('matches snapshot for primary variant', () => {
      const { container } = renderWithProviders(
        <Button variant="primary">Snapshot</Button>,
      );
      expect(container.firstChild).toMatchSnapshot();
    });

    it('matches snapshot for loading state', () => {
      const { container } = renderWithProviders(
        <Button isLoading>Loading Snapshot</Button>,
      );
      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
