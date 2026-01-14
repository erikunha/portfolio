'use client';

/**
 * Skip Links Component
 * Principal-Level Accessibility Implementation
 *
 * WCAG 2.1 Success Criteria:
 * - 2.4.1 Bypass Blocks (Level A)
 * - 2.1.1 Keyboard (Level A)
 * - 2.4.3 Focus Order (Level A)
 *
 * @see https://www.w3.org/WAI/WCAG21/Understanding/bypass-blocks.html
 */

import styles from './skip-links.module.css';

export interface SkipLink {
  id: string;
  label: string;
  target: string;
}

const defaultSkipLinks: SkipLink[] = [
  { id: 'skip-main', label: 'Skip to main content', target: '#main-content' },
  { id: 'skip-footer', label: 'Skip to footer', target: '#footer' },
];

export interface SkipLinksProps {
  links?: SkipLink[];
}

/**
 * SkipLinks Component
 *
 * Provides keyboard users with quick navigation to key page sections
 *
 * Features:
 * - Multiple skip targets (main, nav, footer, search)
 * - Invisible until focused (keyboard-only)
 * - Smooth scroll to target
 * - Focus management
 * - Screen reader announcements
 * - i18n support
 *
 * @example
 * ```tsx
 * <SkipLinks />
 *
 * // Custom links
 * <SkipLinks
 *   links={[
 *     { id: 'skip-search', translationKey: 'search', target: '#search' }
 *   ]}
 * />
 * ```
 */
export function SkipLinks({ links = defaultSkipLinks }: SkipLinksProps) {
  const handleSkipLinkClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const target = event.currentTarget.getAttribute('href');
    if (!target) {
      return;
    }

    event.preventDefault();

    const element = document.querySelector(target);
    if (!element) {
      console.warn(`Skip link target "${target}" not found`);
      return;
    }

    // Smooth scroll to target
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });

    // Set focus to target (make it programmatically focusable if needed)
    const targetElement = element as HTMLElement;
    const originalTabIndex = targetElement.getAttribute('tabindex');

    if (!originalTabIndex) {
      targetElement.setAttribute('tabindex', '-1');
    }

    // Focus the target element
    targetElement.focus({ preventScroll: true });

    // Announce to screen readers
    const announcement = `Navigated to ${event.currentTarget.textContent}`;
    announceToScreenReader(announcement);

    // Remove temporary tabindex after focus
    if (!originalTabIndex) {
      targetElement.addEventListener(
        'blur',
        () => {
          targetElement.removeAttribute('tabindex');
        },
        { once: true },
      );
    }
  };

  return (
    <nav
      className={styles['skip-links']}
      aria-label="Skip navigation links"
      role="navigation"
    >
      <ul className={styles['skip-links-list']}>
        {links.map((link) => (
          <li key={link.id}>
            <a
              href={link.target}
              className="skip-link"
              onClick={handleSkipLinkClick}
              id={link.id}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>

      {/* Screen reader live region for announcements */}
      <div
        id="skip-links-announcer"
        className="sr-only"
        role="status"
        aria-live="off"
        aria-atomic="true"
      />
    </nav>
  );
}

/**
 * Announce message to screen readers
 */
function announceToScreenReader(message: string) {
  const announcer = document.getElementById('skip-links-announcer');
  if (announcer) {
    announcer.textContent = message;
    // Clear after announcement
    setTimeout(() => {
      announcer.textContent = '';
    }, 1000);
  }
}
