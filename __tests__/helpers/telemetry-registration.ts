const GUARD_KEY_PREFIX = 'erikunha.ai-telemetry.';

type TelemetryGlobal = typeof globalThis & {
  AI_SDK_TELEMETRY_INTEGRATIONS?: unknown[];
};

export function resetTelemetryRegistration(): void {
  delete (globalThis as TelemetryGlobal).AI_SDK_TELEMETRY_INTEGRATIONS;
  for (const key of Object.getOwnPropertySymbols(globalThis)) {
    if (key.description?.startsWith(GUARD_KEY_PREFIX)) Reflect.deleteProperty(globalThis, key);
  }
}
