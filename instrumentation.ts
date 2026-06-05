// Next.js 16 native instrumentation hook. `register()` runs once per runtime at
// server boot, BEFORE any route handler is invoked and OUTSIDE the request path
// - the correct place for OpenTelemetry setup.
//
// The Langfuse span processor is gated twice over:
//   1. Runtime guard here: only the Node.js runtime branch loads it. The Edge
//      runtime has no OTel SDK and `register()` is re-invoked per runtime, so
//      the `NEXT_RUNTIME === 'nodejs'` check keeps the Langfuse import out of the
//      Edge bundle entirely.
//   2. Flag guard inside `registerLangfuseProcessor()`: even on Node, nothing is
//      imported unless `LANGFUSE_ENABLED === 'true'`. See lib/telemetry/langfuse.ts.
//
// The import of `registerLangfuseProcessor` is itself dynamic so that the
// langfuse module graph is not pulled into the Edge bundle through this file's
// static import set.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerLangfuseProcessor } = await import('@/lib/telemetry/langfuse');
    await registerLangfuseProcessor();
  }
}
