/**
 * Environment Variable Validation
 * Validates and provides type-safe access to environment variables
 */

/**
 * Validated environment configuration
 */
export interface EnvConfig {
  // Site configuration
  siteUrl: string;
  siteName: string;

  // Build configuration
  nodeEnv: 'development' | 'production' | 'test';
  isProduction: boolean;
  isDevelopment: boolean;

  // Feature flags (optional)
  enableServiceWorker: boolean;
  enableAnalytics: boolean;
}

/**
 * Validate and parse environment variables
 */
function validateEnv(): EnvConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';

  return {
    // Site configuration
    siteUrl:
      process.env['NEXT_PUBLIC_SITE_URL'] ||
      (nodeEnv === 'production'
        ? 'https://erikunha.dev'
        : 'http://localhost:3000'),
    siteName: process.env['NEXT_PUBLIC_SITE_NAME'] || 'Erik Portfolio',

    // Build configuration
    nodeEnv: nodeEnv as 'development' | 'production' | 'test',
    isProduction: nodeEnv === 'production',
    isDevelopment: nodeEnv === 'development',

    // Feature flags
    enableServiceWorker:
      process.env['NEXT_PUBLIC_ENABLE_SERVICE_WORKER'] === 'true',
    enableAnalytics: process.env['NEXT_PUBLIC_ENABLE_ANALYTICS'] === 'true',
  };
}

/**
 * Validated environment configuration
 * Safe to use throughout the application
 */
export const env = validateEnv();

/**
 * Assert required environment variables
 * Throws if validation fails
 */
export function assertEnv(): void {
  const errors: string[] = [];

  // Validate required variables
  if (!env.siteUrl) {
    errors.push('NEXT_PUBLIC_SITE_URL is required');
  }

  if (!env.siteUrl.startsWith('http')) {
    errors.push('NEXT_PUBLIC_SITE_URL must start with http:// or https://');
  }

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`,
    );
  }
}

// Validate on import (will throw in development)
if (env.isDevelopment) {
  try {
    assertEnv();
  } catch (error) {
    console.error('Environment validation warnings:', error);
  }
}
