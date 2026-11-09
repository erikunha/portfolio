export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'edge') {
    const { registerLangfuseProcessor } = await import('@/lib/telemetry/langfuse');
    await registerLangfuseProcessor();
  }
}
