# Vercel Deployment Guide

## Prerequisites

Before deploying to Vercel, ensure:

1. **Enable Corepack in Vercel Project Settings**:
   - Go to your project in Vercel Dashboard
   - Navigate to **Settings** → **General** → **Build & Development Settings**
   - Add environment variable:
     - **Name**: `ENABLE_EXPERIMENTAL_COREPACK`
     - **Value**: `1`
   - This enables Vercel to use the `packageManager` field from package.json

2. **Verify pnpm lockfile version**:

   ```bash
   # Ensure you're using pnpm@10.x locally
   pnpm --version  # Should be 10.29.3 or higher

   # Regenerate lockfile if needed
   rm pnpm-lock.yaml
   pnpm install
   ```

## Configuration Files

### vercel.json

```json
{
  "buildCommand": "corepack enable && pnpm build",
  "installCommand": "corepack enable && pnpm install --frozen-lockfile",
  "framework": "nextjs",
  "outputDirectory": ".next"
}
```

### package.json

- **`packageManager: "pnpm@10.29.3"`** - Specifies exact pnpm version for Corepack
- **`engines.node: ">=22.21.0"`** - Node.js version requirement
- **Note**: `engines.pnpm` is removed to avoid conflicts with Corepack

## Troubleshooting

### Error: "Using pnpm@9.x based on project creation date"

**Solution**: Ensure `ENABLE_EXPERIMENTAL_COREPACK=1` is set in Vercel environment variables.

### Error: "ERR_PNPM_UNSUPPORTED_ENGINE"

**Cause**: Vercel is using old pnpm version
**Solution**:

1. Set `ENABLE_EXPERIMENTAL_COREPACK=1` in Vercel
2. Regenerate lockfile with pnpm@10.x:
   ```bash
   pnpm install
   git add pnpm-lock.yaml
   git commit -m "chore: regenerate lockfile with pnpm@10.x"
   ```

## Deployment Workflow

```bash
# 1. Make changes
git add .
git commit -m "feat: your changes"

# 2. Push to trigger Vercel deployment
git push origin main

# 3. Vercel will:
#    - Enable Corepack
#    - Use pnpm@10.29.3 (from packageManager field)
#    - Install dependencies
#    - Build with Next.js
```

## Environment Variables

Set these in Vercel Dashboard → Settings → Environment Variables:

| Variable                       | Value        | Purpose                       |
| ------------------------------ | ------------ | ----------------------------- |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1`          | Enable Corepack for pnpm@10.x |
| `NODE_ENV`                     | `production` | Production environment        |
| `NEXT_PUBLIC_SITE_URL`         | Your domain  | Base URL for metadata         |

## Local Development vs Production

| Aspect        | Local                   | Vercel                           |
| ------------- | ----------------------- | -------------------------------- |
| pnpm version  | 10.29.3+ (via Corepack) | 10.29.3 (via Corepack + env var) |
| Node version  | 22.21.0+                | 22.x (auto-detected)             |
| Build command | `pnpm build`            | `corepack enable && pnpm build`  |

## References

- [Vercel Corepack Documentation](https://vercel.com/docs/deployments/configure-a-build#corepack)
- [Node.js Corepack](https://nodejs.org/api/corepack.html)
