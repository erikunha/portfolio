// tests/mocks/server-only.ts
// Empty stub aliased from `server-only` in vitest.config.ts. The real
// `server-only` package routes its 'react-server' export-condition to a
// throwing stub when bundled into a client component by Next.js; outside
// Next, the package has no entry and vite's import-analysis fails. This
// stub lets vitest load modules guarded by `import 'server-only'` without
// each test mocking the whole module surface.
export {};
