/**
 * Performance Budget Configuration
 * Enforced in CI - PRs that violate these budgets are blocked
 */

module.exports = {
  budgets: [
    {
      // JavaScript bundle size
      resourceType: 'script',
      budget: 300, // KB
    },
    {
      // CSS bundle size
      resourceType: 'stylesheet',
      budget: 50, // KB
    },
    {
      // Initial bundle
      resourceType: 'initial',
      budget: 500, // KB
    },
    {
      // All resources combined
      resourceType: 'total',
      budget: 1000, // KB
    },
  ],

  // Core Web Vitals thresholds
  webVitals: {
    FCP: 1500, // First Contentful Paint (ms)
    LCP: 2500, // Largest Contentful Paint (ms)
    CLS: 0.1, // Cumulative Layout Shift (score)
    TBT: 200, // Total Blocking Time (ms)
    FID: 100, // First Input Delay (ms)
  },
};
