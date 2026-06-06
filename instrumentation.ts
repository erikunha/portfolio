// Next.js 16 native instrumentation hook. `register()` runs once per runtime at
// server boot, BEFORE any route handler is invoked and OUTSIDE the request path
// - the correct place for OpenTelemetry setup.
//
// The Langfuse span processor is gated twice over:
//   1. Runtime guard here: load it on every runtime EXCEPT Edge. We guard on
//      `NEXT_RUNTIME !== 'edge'` (not `=== 'nodejs'`) because NEXT_RUNTIME can be
//      undefined in some Node server contexts (e.g. the Vercel Node Lambda),
//      where `=== 'nodejs'` would silently skip registration even with the flag
//      on. Excluding only 'edge' still keeps Langfuse out of the Edge bundle (the
//      Edge runtime sets NEXT_RUNTIME='edge'), matching lib/log.ts's `=== 'edge'`
//      convention. `register()` is re-invoked per runtime.
//   2. Flag guard inside `registerLangfuseProcessor()`: even on Node, nothing is
//      imported unless `LANGFUSE_ENABLED === 'true'`. See lib/telemetry/langfuse.ts.
//
// The import of `registerLangfuseProcessor` is itself dynamic so that the
// langfuse module graph is not pulled into the Edge bundle through this file's
// static import set.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'edge') {
    const { registerLangfuseProcessor } = await import('@/lib/telemetry/langfuse');
    await registerLangfuseProcessor();
  }
}
