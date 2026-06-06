// lib/ask/model.ts
// Single source of truth for the /api/ask feature model string.
//
// Plain `provider/model` form routes through the Vercel AI Gateway without
// wiring `@ai-sdk/anthropic` directly (the Vercel-preferred shape; it still
// carries `providerOptions.anthropic.cacheControl`). Imported by BOTH the live
// route (`app/api/ask/route.ts` → `streamText`) and the eval harness
// (`scripts/ask-eval.ts` → the aggregate `featureModel`), so the eval gate can
// never grade a different model than ships. No `server-only`: this is a plain
// constant consumed by the route AND the standalone `tsx` eval script.
export const ASK_MODEL = 'anthropic/claude-haiku-4-5' as const;
