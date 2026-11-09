import { scriptLiteral } from './script-literal';

export function serializeJsonLd(value: unknown): string {
  return scriptLiteral(value);
}
