/**
 * Shell App - Next.js Configuration
 * Server Components enabled, optimized for production
 */

/**
 * @type {import('next').NextConfig}
 **/
const nextConfig = {
  // Server external packages (formerly experimental.serverComponentsExternalPackages)
  serverExternalPackages: [],

  // Strict mode for development
  reactStrictMode: true,

  // Standalone output for optimized builds
  output: 'standalone',

  // Performance optimizations (swcMinify is now default in Next.js 16)

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
  },

  // Headers for security and performance
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; " +
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
              "style-src 'self' 'unsafe-inline' fonts.googleapis.com; " +
              "font-src 'self' fonts.gstatic.com data:; " +
              "img-src 'self' data: https: blob:; " +
              "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; " +
              "media-src 'self'; " +
              "object-src 'none'; " +
              "frame-ancestors 'self'; " +
              "base-uri 'self'; " +
              "form-action 'self';",
          },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
