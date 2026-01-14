# Core Web Vitals Tracking

This portfolio tracks Core Web Vitals to monitor real-world performance.

## Metrics Tracked

- **LCP (Largest Contentful Paint)**: Loading performance
- **FID (First Input Delay)**: Interactivity
- **CLS (Cumulative Layout Shift)**: Visual stability
- **FCP (First Contentful Paint)**: Perceived load speed
- **INP (Interaction to Next Paint)**: Responsiveness
- **TTFB (Time to First Byte)**: Server responsiveness

## Thresholds

| Metric | Good     | Needs Improvement | Poor     |
| ------ | -------- | ----------------- | -------- |
| LCP    | ≤ 2500ms | ≤ 4000ms          | > 4000ms |
| FID    | ≤ 100ms  | ≤ 300ms           | > 300ms  |
| CLS    | ≤ 0.1    | ≤ 0.25            | > 0.25   |
| FCP    | ≤ 1800ms | ≤ 3000ms          | > 3000ms |
| INP    | ≤ 200ms  | ≤ 500ms           | > 500ms  |
| TTFB   | ≤ 800ms  | ≤ 1800ms          | > 1800ms |

## Implementation

### 1. Client-Side Tracking

The `WebVitalsTracker` component is added to the root layout:

```tsx
// apps/shell/app/layout.tsx
import { WebVitalsTracker } from '../components/providers/web-vitals-tracker';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <WebVitalsTracker />
        {children}
      </body>
    </html>
  );
}
```

### 2. Logging Implementation

Metrics are logged to the console with appropriate severity levels:

```typescript
// apps/shell/lib/web-vitals.ts
function logWebVitals(metric: WebVitalsMetric) {
  if (metric.rating === 'good') {
    console.info('📊 Web Vitals [GOOD]:', metric);
  } else if (metric.rating === 'needs-improvement') {
    console.warn('⚠️  Web Vitals [NEEDS IMPROVEMENT]:', metric);
  } else {
    console.error('❌ Web Vitals [POOR]:', metric);
  }
}
```

### 3. Development vs Production

- **Development**: Metrics logged to console with emoji indicators
- **Production**: Logged to console with appropriate severity levels

## Viewing Metrics

### Development

Open browser console and navigate pages:

```
📊 Web Vitals: {
  name: "LCP",
  value: 1234.5,
  rating: "good",
  ...
}
```

### Production

Check server logs for structured JSON:

```json
{
  "type": "analytics.web-vitals",
  "metric": "LCP",
  "value": 1234.5,
  "rating": "good",
  "requestId": "1234-abcd",
  "timestamp": "2026-01-10T01:00:00.000Z"
}
```

## Integration Options (Future)

### Free/Open Source

1. **Self-hosted**: Parse logs and visualize with Grafana/Prometheus
2. **Google Analytics 4**: Free tier, add gtag.js
3. **Plausible Analytics**: Self-hosted option available

### Paid Services

1. **Vercel Analytics**: \$10/month (if deploying to Vercel)
2. **Datadog RUM**: Starts at \$15/month
3. **New Relic**: Free tier available

## Custom Dashboard (Optional)

To build a custom dashboard:

```bash
# 1. Store metrics in a database
pnpm add @vercel/postgres  # or sqlite, mongodb, etc.

# 2. Create dashboard endpoint
# apps/shell/app/api/vitals/route.ts

# 3. Build visualization
pnpm add recharts  # or chart.js, d3, etc.
```

## Performance Budget Enforcement

The CI pipeline checks these thresholds (warning mode):

```yaml
# .github/workflows/ci.yml
performance-budget-check:
  - MAX_JS_KB: 300
  - MAX_CSS_KB: 50
```

## Testing

### Manual Testing

```bash
# Start dev server
pnpm start

# Open http://localhost:3000
# Check console for web vitals logs
# Navigate between pages to trigger metrics
```

### Lighthouse CI (Future)

```bash
# Add lighthouse CI for automated checks
pnpm add -D @lhci/cli
```

## Files Created

- `apps/shell/lib/web-vitals.ts` - Core tracking logic
- `apps/shell/components/web-vitals-tracker.tsx` - React component
- `apps/shell/app/layout.tsx` - Updated with tracker

**Note**: Console-only logging is used (no API endpoint) to keep infrastructure simple for this portfolio.

## Resources

- [Web Vitals Documentation](https://web.dev/vitals/)
- [web-vitals npm package](https://github.com/GoogleChrome/web-vitals)
- [Next.js Analytics](https://nextjs.org/docs/app/building-your-application/optimizing/analytics)
