import 'server-only';

import { log } from '@/lib/log';

// Flag-gated Langfuse span processor (WS5).
//
// Contract: byte-for-byte inert in production unless an operator sets
// `LANGFUSE_ENABLED=true`. When the flag is absent or any value other than the
// exact string 'true', this module imports NOTHING from langfuse-vercel or
// @vercel/otel, opens NO socket, and adds ZERO latency to the request path. The
// guard is a single synchronous `process.env` read; the heavy OTel + Langfuse
// machinery loads only behind it via dynamic `import()`.
//
// Why a strict `=== 'true'` check (not a truthiness or keyword set): the OFF
// posture is the default for prod, so the gate must FAIL CLOSED. Any ambiguous
// value ('1', 'TRUE', 'yes') leaves the processor dormant rather than silently
// enabling a network exporter the operator did not intend. This mirrors the
// inverse asymmetry of the ask kill switch (which fails to OFF on any keyword):
// here the network-side effect is the dangerous direction, so only the exact
// affirmative string activates it.
//
// Wiring: langfuse-vercel's `LangfuseExporter` is an OpenTelemetry SpanExporter.
// It is registered through @vercel/otel's `registerOTel({ traceExporter })`,
// the Next.js 16 native instrumentation path, which builds the NodeTracerProvider
// and attaches the exporter as a span processor outside the request path. The
// exporter then consumes the spans emitted by `experimental_telemetry` on the
// `streamText` call in app/api/ask/route.ts (WS2). With the flag on but WS2's
// telemetry absent, the processor is live but receives no ask spans - a no-harm
// condition, not an error.

function isEnabled(): boolean {
  return process.env.LANGFUSE_ENABLED === 'true';
}

/**
 * Conditionally register the Langfuse OTel span exporter.
 *
 * No-op (returns immediately, imports nothing) unless `LANGFUSE_ENABLED` is the
 * exact string 'true'. A registration failure (bad credentials, OTel init error
 * at cold start) is logged via `log.warn` and swallowed: the server must start
 * normally because the processor is strictly optional. Called once from
 * `instrumentation.ts` `register()` on the Node.js runtime branch.
 */
export async function registerLangfuseProcessor(): Promise<void> {
  if (!isEnabled()) return;

  try {
    const [{ LangfuseExporter }, { registerOTel }] = await Promise.all([
      import('langfuse-vercel'),
      import('@vercel/otel'),
    ]);

    // Build the options object with only the keys that are actually set. Under
    // `exactOptionalPropertyTypes` an explicit `undefined` is not assignable to
    // an optional `string`, and passing one would also mask a real "credential
    // missing" condition behind a present-but-undefined key.
    const exporterOptions: {
      secretKey?: string;
      publicKey?: string;
      baseUrl?: string;
    } = {};
    if (process.env.LANGFUSE_SECRET_KEY)
      exporterOptions.secretKey = process.env.LANGFUSE_SECRET_KEY;
    if (process.env.LANGFUSE_PUBLIC_KEY)
      exporterOptions.publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    if (process.env.LANGFUSE_BASEURL) exporterOptions.baseUrl = process.env.LANGFUSE_BASEURL;

    const traceExporter = new LangfuseExporter(exporterOptions);

    registerOTel({ serviceName: 'erikunha-dev', traceExporter });

    log.info('langfuse span processor registered');
  } catch (err) {
    // A Langfuse init failure must never crash cold start. Log and continue -
    // the hot path is unaffected because the processor is optional.
    log.warn('langfuse span processor registration failed, continuing without it', { err });
  }
}
