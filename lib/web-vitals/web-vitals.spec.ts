/**
 * Web Vitals Utility Tests - Principal Level
 *
 * Tests cover:
 * - initWebVitals initialization
 * - Metric logging functionality
 * - Console output by rating (good/needs-improvement/poor)
 * - All Core Web Vitals metrics (CLS, LCP, FCP, INP, TTFB)
 * - Metric payload structure
 */

import { initWebVitals } from './web-vitals';

// Mock web-vitals library
const mockOnCLS = jest.fn();
const mockOnLCP = jest.fn();
const mockOnFCP = jest.fn();
const mockOnINP = jest.fn();
const mockOnTTFB = jest.fn();

jest.mock('web-vitals', () => ({
  onCLS: (...args: unknown[]) => mockOnCLS(...args),
  onLCP: (...args: unknown[]) => mockOnLCP(...args),
  onFCP: (...args: unknown[]) => mockOnFCP(...args),
  onINP: (...args: unknown[]) => mockOnINP(...args),
  onTTFB: (...args: unknown[]) => mockOnTTFB(...args),
}));

describe('Web Vitals Utility', () => {
  let consoleInfoSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Spy on console methods
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Clear all mocks
    mockOnCLS.mockClear();
    mockOnLCP.mockClear();
    mockOnFCP.mockClear();
    mockOnINP.mockClear();
    mockOnTTFB.mockClear();
  });

  afterEach(() => {
    // Restore console methods
    if (consoleInfoSpy) {
      consoleInfoSpy.mockRestore();
    }
    if (consoleWarnSpy) {
      consoleWarnSpy.mockRestore();
    }
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
    }
  });

  describe('Initialization', () => {
    it('registers CLS metric handler', () => {
      initWebVitals();

      expect(mockOnCLS).toHaveBeenCalledTimes(1);
      expect(mockOnCLS).toHaveBeenCalledWith(expect.any(Function));
    });

    it('registers LCP metric handler', () => {
      initWebVitals();

      expect(mockOnLCP).toHaveBeenCalledTimes(1);
      expect(mockOnLCP).toHaveBeenCalledWith(expect.any(Function));
    });

    it('registers FCP metric handler', () => {
      initWebVitals();

      expect(mockOnFCP).toHaveBeenCalledTimes(1);
      expect(mockOnFCP).toHaveBeenCalledWith(expect.any(Function));
    });

    it('registers INP metric handler', () => {
      initWebVitals();

      expect(mockOnINP).toHaveBeenCalledTimes(1);
      expect(mockOnINP).toHaveBeenCalledWith(expect.any(Function));
    });

    it('registers TTFB metric handler', () => {
      initWebVitals();

      expect(mockOnTTFB).toHaveBeenCalledTimes(1);
      expect(mockOnTTFB).toHaveBeenCalledWith(expect.any(Function));
    });

    it('registers all Core Web Vitals', () => {
      initWebVitals();

      // Core Web Vitals: CLS and LCP
      expect(mockOnCLS).toHaveBeenCalled();
      expect(mockOnLCP).toHaveBeenCalled();
    });

    it('registers additional metrics', () => {
      initWebVitals();

      // Additional metrics: FCP, INP, TTFB
      expect(mockOnFCP).toHaveBeenCalled();
      expect(mockOnINP).toHaveBeenCalled();
      expect(mockOnTTFB).toHaveBeenCalled();
    });
  });

  describe('Metric Logging - Good Rating', () => {
    it('logs good metrics with console.info', () => {
      initWebVitals();

      const clsHandler = mockOnCLS.mock.calls[0][0];
      const goodMetric = {
        name: 'CLS',
        value: 0.05,
        rating: 'good',
        delta: 0.05,
        id: 'v1-123',
        navigationType: 'navigate',
      };

      clsHandler(goodMetric);

      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Web Vitals [GOOD]'),
        expect.any(Object),
      );
    });

    it('includes metric emoji for good metrics', () => {
      initWebVitals();

      const lcpHandler = mockOnLCP.mock.calls[0][0];
      const goodMetric = {
        name: 'LCP',
        value: 2000,
        rating: 'good',
        delta: 2000,
        id: 'v1-456',
        navigationType: 'navigate',
      };

      lcpHandler(goodMetric);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('📊'),
        expect.any(Object),
      );
    });
  });

  describe('Metric Logging - Needs Improvement Rating', () => {
    it('logs needs-improvement metrics with console.warn', () => {
      initWebVitals();

      const lcpHandler = mockOnLCP.mock.calls[0][0];
      const needsImprovementMetric = {
        name: 'LCP',
        value: 3000,
        rating: 'needs-improvement',
        delta: 3000,
        id: 'v1-789',
        navigationType: 'navigate',
      };

      lcpHandler(needsImprovementMetric);

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Web Vitals [NEEDS IMPROVEMENT]'),
        expect.any(Object),
      );
    });

    it('includes warning emoji for needs-improvement metrics', () => {
      initWebVitals();

      const fcpHandler = mockOnFCP.mock.calls[0][0];
      const needsImprovementMetric = {
        name: 'FCP',
        value: 2500,
        rating: 'needs-improvement',
        delta: 2500,
        id: 'v1-101',
        navigationType: 'navigate',
      };

      fcpHandler(needsImprovementMetric);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️'),
        expect.any(Object),
      );
    });
  });

  describe('Metric Logging - Poor Rating', () => {
    it('logs poor metrics with console.error', () => {
      initWebVitals();

      const clsHandler = mockOnCLS.mock.calls[0][0];
      const poorMetric = {
        name: 'CLS',
        value: 0.5,
        rating: 'poor',
        delta: 0.5,
        id: 'v1-202',
        navigationType: 'navigate',
      };

      clsHandler(poorMetric);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Web Vitals [POOR]'),
        expect.any(Object),
      );
    });

    it('includes error emoji for poor metrics', () => {
      initWebVitals();

      const inpHandler = mockOnINP.mock.calls[0][0];
      const poorMetric = {
        name: 'INP',
        value: 800,
        rating: 'poor',
        delta: 800,
        id: 'v1-303',
        navigationType: 'navigate',
      };

      inpHandler(poorMetric);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌'),
        expect.any(Object),
      );
    });
  });

  describe('Metric Payload Structure', () => {
    it('includes metric name', () => {
      initWebVitals();

      const lcpHandler = mockOnLCP.mock.calls[0][0];
      lcpHandler({
        name: 'LCP',
        value: 2000,
        rating: 'good',
        delta: 2000,
        id: 'v1-123',
        navigationType: 'navigate',
      });

      const payload = consoleInfoSpy.mock.calls[0][1];
      expect(payload.name).toBe('LCP');
    });

    it('includes metric value', () => {
      initWebVitals();

      const clsHandler = mockOnCLS.mock.calls[0][0];
      clsHandler({
        name: 'CLS',
        value: 0.05,
        rating: 'good',
        delta: 0.05,
        id: 'v1-123',
        navigationType: 'navigate',
      });

      const payload = consoleInfoSpy.mock.calls[0][1];
      expect(payload.value).toBe(0.05);
    });

    it('includes metric rating', () => {
      initWebVitals();

      const fcpHandler = mockOnFCP.mock.calls[0][0];
      fcpHandler({
        name: 'FCP',
        value: 1500,
        rating: 'good',
        delta: 1500,
        id: 'v1-123',
        navigationType: 'navigate',
      });

      const payload = consoleInfoSpy.mock.calls[0][1];
      expect(payload.rating).toBe('good');
    });

    it('includes metric delta', () => {
      initWebVitals();

      const ttfbHandler = mockOnTTFB.mock.calls[0][0];
      ttfbHandler({
        name: 'TTFB',
        value: 500,
        rating: 'good',
        delta: 100,
        id: 'v1-123',
        navigationType: 'navigate',
      });

      const payload = consoleInfoSpy.mock.calls[0][1];
      expect(payload.delta).toBe(100);
    });

    it('includes metric ID', () => {
      initWebVitals();

      const inpHandler = mockOnINP.mock.calls[0][0];
      inpHandler({
        name: 'INP',
        value: 100,
        rating: 'good',
        delta: 100,
        id: 'v1-unique-id',
        navigationType: 'navigate',
      });

      const payload = consoleInfoSpy.mock.calls[0][1];
      expect(payload.id).toBe('v1-unique-id');
    });

    it('includes navigation type', () => {
      initWebVitals();

      const lcpHandler = mockOnLCP.mock.calls[0][0];
      lcpHandler({
        name: 'LCP',
        value: 2000,
        rating: 'good',
        delta: 2000,
        id: 'v1-123',
        navigationType: 'reload',
      });

      const payload = consoleInfoSpy.mock.calls[0][1];
      expect(payload.navigationType).toBe('reload');
    });

    it('includes current URL', () => {
      initWebVitals();

      const clsHandler = mockOnCLS.mock.calls[0][0];
      clsHandler({
        name: 'CLS',
        value: 0.05,
        rating: 'good',
        delta: 0.05,
        id: 'v1-123',
        navigationType: 'navigate',
      });

      const payload = consoleInfoSpy.mock.calls[0][1];
      expect(payload.url).toBeDefined();
      expect(typeof payload.url).toBe('string');
    });

    it('includes ISO timestamp', () => {
      initWebVitals();

      const lcpHandler = mockOnLCP.mock.calls[0][0];
      lcpHandler({
        name: 'LCP',
        value: 2000,
        rating: 'good',
        delta: 2000,
        id: 'v1-123',
        navigationType: 'navigate',
      });

      const payload = consoleInfoSpy.mock.calls[0][1];
      expect(payload.timestamp).toBeDefined();
      expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('All Metrics', () => {
    it('handles CLS metric', () => {
      initWebVitals();

      const clsHandler = mockOnCLS.mock.calls[0][0];
      clsHandler({
        name: 'CLS',
        value: 0.1,
        rating: 'good',
        delta: 0.1,
        id: 'v1-cls',
        navigationType: 'navigate',
      });

      expect(consoleInfoSpy).toHaveBeenCalled();
      const payload = consoleInfoSpy.mock.calls[0][1];
      expect(payload.name).toBe('CLS');
    });

    it('handles LCP metric', () => {
      initWebVitals();

      const lcpHandler = mockOnLCP.mock.calls[0][0];
      lcpHandler({
        name: 'LCP',
        value: 2500,
        rating: 'good',
        delta: 2500,
        id: 'v1-lcp',
        navigationType: 'navigate',
      });

      expect(consoleInfoSpy).toHaveBeenCalled();
      const payload = consoleInfoSpy.mock.calls[0][1];
      expect(payload.name).toBe('LCP');
    });

    it('handles FCP metric', () => {
      initWebVitals();

      const fcpHandler = mockOnFCP.mock.calls[0][0];
      fcpHandler({
        name: 'FCP',
        value: 1800,
        rating: 'good',
        delta: 1800,
        id: 'v1-fcp',
        navigationType: 'navigate',
      });

      expect(consoleInfoSpy).toHaveBeenCalled();
      const payload = consoleInfoSpy.mock.calls[0][1];
      expect(payload.name).toBe('FCP');
    });

    it('handles INP metric', () => {
      initWebVitals();

      const inpHandler = mockOnINP.mock.calls[0][0];
      inpHandler({
        name: 'INP',
        value: 150,
        rating: 'good',
        delta: 150,
        id: 'v1-inp',
        navigationType: 'navigate',
      });

      expect(consoleInfoSpy).toHaveBeenCalled();
      const payload = consoleInfoSpy.mock.calls[0][1];
      expect(payload.name).toBe('INP');
    });

    it('handles TTFB metric', () => {
      initWebVitals();

      const ttfbHandler = mockOnTTFB.mock.calls[0][0];
      ttfbHandler({
        name: 'TTFB',
        value: 600,
        rating: 'good',
        delta: 600,
        id: 'v1-ttfb',
        navigationType: 'navigate',
      });

      expect(consoleInfoSpy).toHaveBeenCalled();
      const payload = consoleInfoSpy.mock.calls[0][1];
      expect(payload.name).toBe('TTFB');
    });
  });

  describe('Edge Cases', () => {
    it('handles multiple calls to initWebVitals', () => {
      initWebVitals();
      initWebVitals();

      // Should register handlers each time
      expect(mockOnCLS).toHaveBeenCalledTimes(2);
    });

    it('handles metrics with zero value', () => {
      initWebVitals();

      const clsHandler = mockOnCLS.mock.calls[0][0];
      clsHandler({
        name: 'CLS',
        value: 0,
        rating: 'good',
        delta: 0,
        id: 'v1-zero',
        navigationType: 'navigate',
      });

      expect(consoleInfoSpy).toHaveBeenCalled();
      const payload = consoleInfoSpy.mock.calls[0][1];
      expect(payload.value).toBe(0);
    });

    it('handles metrics with very large values', () => {
      initWebVitals();

      const lcpHandler = mockOnLCP.mock.calls[0][0];
      lcpHandler({
        name: 'LCP',
        value: 999999,
        rating: 'poor',
        delta: 999999,
        id: 'v1-large',
        navigationType: 'navigate',
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const payload = consoleErrorSpy.mock.calls[0][1];
      expect(payload.value).toBe(999999);
    });
  });
});
