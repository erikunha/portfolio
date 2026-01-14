/**
 * Feature Flags System
 * Zero-dependency runtime configuration without deployment
 */

export interface FeatureFlags {
  // Performance features
  enableServiceWorker: boolean;
  enableWebVitalsTracking: boolean;

  // UI features
  enableDarkMode: boolean;
  enableAnimations: boolean;

  // Analytics
  enableAnalytics: boolean;
  enableErrorReporting: boolean;

  // Experimental features
  experimentalFeatures: boolean;
}

/**
 * Get feature flag value from environment or defaults
 */
function getFlag(key: string, defaultValue: boolean): boolean {
  if (typeof window === 'undefined') {
    // Server-side: use environment variables
    const envValue = process.env[`NEXT_PUBLIC_FEATURE_${key.toUpperCase()}`];
    if (envValue !== undefined) {
      return envValue === 'true' || envValue === '1';
    }
    return defaultValue;
  }

  // Client-side: check localStorage override, then environment
  try {
    const localOverride = localStorage.getItem(`feature_${key}`);
    if (localOverride !== null) {
      return localOverride === 'true' || localOverride === '1';
    }
  } catch {
    // localStorage might not be available
  }

  // Fall back to environment variable
  const envValue = process.env[`NEXT_PUBLIC_FEATURE_${key.toUpperCase()}`];
  if (envValue !== undefined) {
    return envValue === 'true' || envValue === '1';
  }

  return defaultValue;
}

/**
 * Feature flags configuration
 * Defaults are for production-ready features
 */
export const featureFlags: FeatureFlags = {
  // Performance features (enabled by default)
  enableServiceWorker: getFlag('enableServiceWorker', true),
  enableWebVitalsTracking: getFlag('enableWebVitalsTracking', true),

  // UI features (enabled by default)
  enableDarkMode: getFlag('enableDarkMode', true),
  enableAnimations: getFlag('enableAnimations', true),

  // Analytics (enabled by default)
  enableAnalytics: getFlag('enableAnalytics', true),
  enableErrorReporting: getFlag('enableErrorReporting', true),

  // Experimental features (disabled by default)
  experimentalFeatures: getFlag('experimentalFeatures', false),
};

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return featureFlags[feature];
}

/**
 * Override feature flag at runtime (client-side only)
 * Useful for testing and development
 */
export function setFeatureFlag(
  feature: keyof FeatureFlags,
  enabled: boolean,
): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`feature_${feature}`, String(enabled));
      // Force reload to apply changes
      window.location.reload();
    } catch {
      // Silently fail if localStorage is not available
    }
  }
}

/**
 * Development helper: expose feature flags to window
 */
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (
    window as typeof window & { featureFlags: typeof featureFlags }
  ).featureFlags = featureFlags;
  (
    window as typeof window & { setFeatureFlag: typeof setFeatureFlag }
  ).setFeatureFlag = setFeatureFlag;
}
