import type {
  CLSMetric,
  FCPMetric,
  INPMetric,
  LCPMetric,
  TTFBMetric,
} from 'web-vitals';
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

type WebVitalsMetric =
  | CLSMetric
  | FCPMetric
  | INPMetric
  | LCPMetric
  | TTFBMetric;

/**
 * Log Web Vitals metrics to console
 * Uses console.info for good metrics, console.warn for poor metrics
 */
function logWebVitals(metric: WebVitalsMetric) {
  const payload = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    url: window.location.href,
    timestamp: new Date().toISOString(),
  };

  // Use appropriate console method based on metric rating
  if (metric.rating === 'good') {
    console.info('📊 Web Vitals [GOOD]:', payload);
  } else if (metric.rating === 'needs-improvement') {
    console.warn('⚠️  Web Vitals [NEEDS IMPROVEMENT]:', payload);
  } else {
    console.error('❌ Web Vitals [POOR]:', payload);
  }
}

/**
 * Initialize Web Vitals tracking
 * Logs metrics to console with appropriate severity levels
 * Note: FID is deprecated in web-vitals v4, replaced by INP
 */
export function initWebVitals() {
  // Track Core Web Vitals
  onCLS(logWebVitals);
  onLCP(logWebVitals);

  // Track additional metrics
  onFCP(logWebVitals);
  onINP(logWebVitals); // Replaces FID
  onTTFB(logWebVitals);
}
