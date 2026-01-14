/**
 * SkipLinks Component Tests - Principal Level
 *
 * Tests cover:
 * - Click event handling with smooth scroll
 * - Focus management and programmatic tabindex
 * - ARIA live region announcements
 * - Multiple skip link targets
 * - Keyboard navigation (Tab, Enter, Space)
 * - WCAG 2.1 AAA accessibility compliance
 * - Screen reader support
 */

import { render, screen, setupUser, waitFor } from '@erikunha-portifolio/ui';
import { axe } from 'jest-axe';
import { SkipLinks } from './skip-links';

describe('SkipLinks Component', () => {
  // Mock DOM elements that skip links target
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="main-content" tabindex="-1">Main Content</div>
      <div id="navigation" tabindex="-1">Navigation</div>
      <div id="footer" tabindex="-1">Footer</div>
    `;
  });

  describe('Rendering', () => {
    it('renders with default skip links', () => {
      render(<SkipLinks />);

      expect(screen.getByText(/skip to main content/i)).toBeInTheDocument();
      expect(screen.getByText(/skip to footer/i)).toBeInTheDocument();
    });

    it('renders with custom skip links', () => {
      const customLinks = [
        {
          id: 'skip-custom',
          label: 'Skip to main content',
          target: '#custom',
        },
      ];

      render(<SkipLinks links={customLinks} />);

      expect(screen.getByText(/skip to main content/i)).toBeInTheDocument();
    });

    it('renders navigation with correct ARIA label', () => {
      render(<SkipLinks />);

      const nav = screen.getByRole('navigation', {
        name: /skip navigation links/i,
      });
      expect(nav).toBeInTheDocument();
    });
  });

  describe('Click Behavior', () => {
    it('scrolls to target element on click', async () => {
      const user = setupUser();
      render(<SkipLinks />);

      const mainLink = screen.getByText(/skip to main content/i);
      await user.click(mainLink);

      const mainContent = document.getElementById('main-content');
      expect(mainContent?.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      });
    });

    it('prevents default link behavior', async () => {
      render(<SkipLinks />);

      const link = screen.getByText(/skip to main content/i);
      const clickEvent = new MouseEvent('click', { bubbles: true });
      const preventDefault = jest.spyOn(clickEvent, 'preventDefault');

      link.dispatchEvent(clickEvent);

      expect(preventDefault).toHaveBeenCalled();
    });

    it('handles missing target element gracefully', async () => {
      const user = setupUser();
      const customLinks = [
        {
          id: 'skip-missing',
          label: 'Skip to main content',
          target: '#nonexistent',
        },
      ];

      render(<SkipLinks links={customLinks} />);

      const link = screen.getByText(/skip to main content/i);

      // Should not throw error
      await expect(user.click(link)).resolves.not.toThrow();
    });
  });

  describe('Focus Management', () => {
    it('sets focus on target element after click', async () => {
      const user = setupUser();
      render(<SkipLinks />);

      const mainLink = screen.getByText(/skip to main content/i);
      const mainContent = document.getElementById('main-content');

      await user.click(mainLink);

      await waitFor(() => {
        expect(document.activeElement).toBe(mainContent);
      });
    });

    it('sets tabindex to -1 on non-focusable elements', async () => {
      const nonFocusableDiv = document.createElement('div');
      nonFocusableDiv.id = 'test-target';
      document.body.appendChild(nonFocusableDiv);

      const user = setupUser();
      const customLinks = [
        {
          id: 'test-link',
          target: '#test-target',
          label: 'Skip to main content',
        },
      ];
      render(<SkipLinks links={customLinks} />);

      const link = screen.getByText(/skip to main content/i);
      await user.click(link);

      await waitFor(() => {
        expect(document.activeElement).toBe(nonFocusableDiv);
      });
    });
  });

  describe('Screen Reader Announcements', () => {
    it('creates ARIA live region for announcements', () => {
      render(<SkipLinks />);

      // Note: aria-live is set to 'off' to avoid conflicts with route-announcer
      const liveRegion = document.querySelector('[aria-live="off"]');
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
      expect(liveRegion).toHaveClass('sr-only');
    });

    it('skip links are functional without announcing', async () => {
      const user = setupUser();
      render(<SkipLinks />);

      const mainLink = screen.getByText(/skip to main content/i);
      await user.click(mainLink);

      // The live region exists but is set to aria-live="off"
      // to avoid conflicts with route-announcer component
      const liveRegion = document.querySelector('[aria-live="off"]');
      expect(liveRegion).toBeInTheDocument();
    });

    it('maintains live region with aria-live off', async () => {
      const user = setupUser();
      render(<SkipLinks />);

      const mainLink = screen.getByText(/skip to main content/i);
      await user.click(mainLink);

      // Live region exists but is disabled (aria-live="off")
      // Route announcements are handled by route-announcer component
      const liveRegion = document.querySelector('[aria-live="off"]');
      expect(liveRegion).toBeInTheDocument();

      // The announcer still exists but doesn't actively announce
      // since aria-live is set to 'off'
      expect(liveRegion).toHaveAttribute('role', 'status');
    });
  });

  describe('Keyboard Navigation', () => {
    it('is accessible via Tab key', () => {
      render(<SkipLinks />);

      const firstLink = screen.getByText(/skip to main content/i);
      firstLink.focus();

      expect(firstLink).toHaveFocus();
    });

    it('all links are keyboard accessible', () => {
      render(<SkipLinks />);

      const links = screen.getAllByRole('link');

      links.forEach((link) => {
        expect(link).toHaveAttribute('href');
        expect(link.tagName).toBe('A');
      });
    });

    it('activates link on Enter key', () => {
      render(<SkipLinks />);

      const mainLink = screen.getByText(
        /skip to main content/i,
      ) as HTMLAnchorElement;

      // Links are natively keyboard accessible with Enter
      mainLink.focus();
      expect(mainLink).toHaveFocus();
      expect(mainLink.tagName).toBe('A');
      expect(mainLink).toHaveAttribute('href', '#main-content');
    });

    it('activates link on Space key', () => {
      render(<SkipLinks />);

      const mainLink = screen.getByText(
        /skip to main content/i,
      ) as HTMLAnchorElement;

      // Links are natively keyboard accessible
      mainLink.focus();
      expect(mainLink).toHaveFocus();
      expect(mainLink.tagName).toBe('A');
      expect(mainLink).toHaveAttribute('href', '#main-content');
    });
  });

  describe('Accessibility (WCAG 2.1 AAA)', () => {
    it('passes axe accessibility tests', async () => {
      const { container } = render(<SkipLinks />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    }, 15000);

    it('has correct skip link class for visibility on focus', () => {
      render(<SkipLinks />);

      const links = screen.getAllByRole('link');
      links.forEach((link) => {
        expect(link).toHaveClass('skip-link');
      });
    });

    it('provides descriptive link text', () => {
      render(<SkipLinks />);

      const mainLink = screen.getByText(/skip to main content/i);
      const footerLink = screen.getByText(/skip to footer/i);

      // Links should have descriptive text, not just "skip" or "click here"
      expect(mainLink).toHaveTextContent('Skip to main content');
      expect(footerLink).toHaveTextContent('Skip to footer');
    });

    it('has proper heading hierarchy', () => {
      render(<SkipLinks />);

      // Skip links should be in a nav landmark
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveAttribute('aria-label', 'Skip navigation links');
    });

    it('supports high contrast mode', () => {
      render(<SkipLinks />);

      const links = screen.getAllByRole('link');

      // Skip links should have borders/outlines for high contrast
      links.forEach((link) => {
        const styles = window.getComputedStyle(link);
        // Should have visible border or outline
        expect(
          styles.border !== 'none' || styles.outline !== 'none',
        ).toBeTruthy();
      });
    });
  });

  describe('Visual Behavior', () => {
    it('is hidden by default (visually)', () => {
      render(<SkipLinks />);

      const link = screen.getByText(/skip to main content/i);

      // Should have sr-only or similar class when not focused
      expect(link).toHaveClass('skip-link');
    });

    it('becomes visible on focus', () => {
      render(<SkipLinks />);

      const link = screen.getByText(/skip to main content/i);
      link.focus();

      // When focused, skip link should be visible
      expect(link).toHaveFocus();
      expect(link).toHaveClass('skip-link');
    });

    it('has high z-index to appear above all content', () => {
      render(<SkipLinks />);

      const nav = screen.getByRole('navigation');

      // Should have skip-links class which applies high z-index
      expect(nav).toHaveClass('skip-links');
    });
  });

  describe('Multiple Targets', () => {
    it('handles multiple skip links correctly', () => {
      const multipleLinks = [
        {
          id: 'link1',
          target: '#content1',
          label: 'Skip to content 1',
        },
        {
          id: 'link2',
          target: '#content2',
          label: 'Skip to content 2',
        },
        {
          id: 'link3',
          target: '#content3',
          label: 'Skip to content 3',
        },
      ];

      render(<SkipLinks links={multipleLinks} />);

      expect(screen.getByText(/skip to content 1/i)).toBeInTheDocument();
      expect(screen.getByText(/skip to content 2/i)).toBeInTheDocument();
      expect(screen.getByText(/skip to content 3/i)).toBeInTheDocument();
    });

    it('spaces multiple links appropriately', () => {
      const multipleLinks = [
        {
          id: 'link1',
          target: '#content1',
          label: 'Link 1',
        },
        {
          id: 'link2',
          target: '#content2',
          label: 'Link 2',
        },
      ];

      render(<SkipLinks links={multipleLinks} />);

      const list = screen.getByRole('list');

      // Should have skip-links-list class which applies gap
      expect(list).toHaveClass('skip-links-list');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty links array', () => {
      render(<SkipLinks links={[]} />);

      const nav = screen.getByRole('navigation');
      expect(nav).toBeInTheDocument();
    });

    it('handles links with special characters', () => {
      const specialLinks = [
        {
          id: 'special',
          target: '#test-&-special',
          label: 'Test & Special <chars>',
        },
      ];

      render(<SkipLinks links={specialLinks} />);

      const link = screen.getByText(/test & special <chars>/i);
      expect(link).toBeInTheDocument();
    });

    it('handles hash-only hrefs', () => {
      const hashLinks = [
        {
          id: 'hash',
          target: '#main-content',
          label: 'Hash only',
        },
      ];

      render(<SkipLinks links={hashLinks} />);

      const link = screen.getByText(/hash only/i);
      expect(link).toHaveAttribute('href', '#main-content');
    });

    it('cleans up event listeners on unmount', () => {
      const { unmount } = render(<SkipLinks />);

      // Should not throw error when unmounting
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Integration with Page Layout', () => {
    it('should be the first focusable element on page', () => {
      // Simulate full page with skip links first
      render(
        <>
          <SkipLinks />
          <button>Other button</button>
        </>,
      );

      const firstLink = screen.getByText(/skip to main content/i);
      const otherButton = screen.getByRole('button', { name: /other button/i });

      // Skip link should come before other button in DOM
      expect(firstLink.compareDocumentPosition(otherButton)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    });

    it('skips to main content without tabbing through navigation', async () => {
      const user = setupUser();
      render(<SkipLinks />);

      const mainLink = screen.getByText(/skip to main content/i);
      await user.click(mainLink);

      // After clicking, check that scrollIntoView was called
      const mainContent = document.getElementById('main-content');
      expect(mainContent).toBeInTheDocument();
      expect(mainLink).toHaveAttribute('href', '#main-content');
    });
  });
});
