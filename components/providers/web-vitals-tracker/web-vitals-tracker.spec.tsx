/**
 * WebVitalsTracker Component Tests - Principal Level
 *
 * Tests cover:
 * - Component initialization
 * - Web vitals function calls
 * - useEffect lifecycle
 * - No DOM rendering
 * - Multiple instances handling
 */

import { render } from '../../shared/test-utils';
import { WebVitalsTracker } from './web-vitals-tracker';

// Mock the web vitals module
const mockInitWebVitals = jest.fn();

jest.mock('../../../lib/web-vitals', () => ({
  initWebVitals: () => mockInitWebVitals(),
}));

describe('WebVitalsTracker Component', () => {
  beforeEach(() => {
    mockInitWebVitals.mockClear();
  });

  describe('Initialization', () => {
    it('calls initWebVitals on mount', () => {
      render(<WebVitalsTracker />);

      expect(mockInitWebVitals).toHaveBeenCalledTimes(1);
    });

    it('calls initWebVitals only once', () => {
      render(<WebVitalsTracker />);

      expect(mockInitWebVitals).toHaveBeenCalledTimes(1);
    });

    it('does not call initWebVitals before mounting', () => {
      expect(mockInitWebVitals).not.toHaveBeenCalled();
    });
  });

  describe('Rendering', () => {
    it('renders without errors', () => {
      const { container } = render(<WebVitalsTracker />);

      expect(container).toBeInTheDocument();
    });

    it('does not render any visible content', () => {
      const { container } = render(<WebVitalsTracker />);

      expect(container.textContent).toBe('');
    });

    it('returns null from render', () => {
      const { container } = render(<WebVitalsTracker />);

      // Should have empty container
      expect(container.firstChild).toBeNull();
    });

    it('does not create any DOM elements', () => {
      const { container } = render(<WebVitalsTracker />);

      const allElements = container.querySelectorAll('*');
      expect(allElements).toHaveLength(0);
    });
  });

  describe('Lifecycle', () => {
    it('initializes on first render', () => {
      render(<WebVitalsTracker />);

      expect(mockInitWebVitals).toHaveBeenCalledTimes(1);
    });

    it('does not reinitialize on re-render', () => {
      const { rerender } = render(<WebVitalsTracker />);

      expect(mockInitWebVitals).toHaveBeenCalledTimes(1);

      rerender(<WebVitalsTracker />);

      // Should still be 1, not 2
      expect(mockInitWebVitals).toHaveBeenCalledTimes(1);
    });

    it('cleans up properly on unmount', () => {
      const { unmount } = render(<WebVitalsTracker />);

      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Multiple Instances', () => {
    it('each instance calls initWebVitals', () => {
      render(<WebVitalsTracker />);
      render(<WebVitalsTracker />);

      // Each instance initializes independently
      expect(mockInitWebVitals).toHaveBeenCalledTimes(2);
    });

    it('handles multiple instances without errors', () => {
      expect(() => {
        render(<WebVitalsTracker />);
        render(<WebVitalsTracker />);
        render(<WebVitalsTracker />);
      }).not.toThrow();
    });
  });

  describe('Integration', () => {
    it('can be placed anywhere in component tree', () => {
      const { container } = render(
        <div>
          <header>Header</header>
          <WebVitalsTracker />
          <main>Content</main>
        </div>,
      );

      expect(mockInitWebVitals).toHaveBeenCalledTimes(1);
      expect(container.querySelector('header')).toHaveTextContent('Header');
      expect(container.querySelector('main')).toHaveTextContent('Content');
    });

    it('does not interfere with other components', () => {
      const { container } = render(
        <>
          <WebVitalsTracker />
          <div data-testid="test-div">Test Content</div>
        </>,
      );

      const testDiv = container.querySelector('[data-testid="test-div"]');
      expect(testDiv).toHaveTextContent('Test Content');
    });
  });
});
