// scripts/lib/empty-module.ts
//
// No-op stand-in for the `server-only` / `client-only` marker packages.
//
// `scripts/tsconfig.eval.json` maps both marker specifiers to this file so a
// plain `tsx` run of `scripts/ask-eval.ts` can resolve the transitive
// `import 'server-only'` in `lib/ask/system-prompt.ts`. Those packages have no
// runtime API — they exist only so a bundler can reject a cross-environment
// import — so an empty module is a faithful substitute outside the bundler.
//
// See `scripts/tsconfig.eval.json` and the `ask:eval` package.json script.
export {};
