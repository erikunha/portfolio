import { ShellCommand } from '@/content/shell-ui';

export const PRIVACY_COMMAND_KIND = {
  List: 'list',
  ForgetAll: 'forget-all',
  ForgetNumber: 'forget-number',
  ForgetId: 'forget-id',
  Usage: 'usage',
} as const;

export type PrivacyCommand =
  | { kind: typeof PRIVACY_COMMAND_KIND.List }
  | { kind: typeof PRIVACY_COMMAND_KIND.ForgetAll }
  | { kind: typeof PRIVACY_COMMAND_KIND.ForgetNumber; number: number }
  | { kind: typeof PRIVACY_COMMAND_KIND.ForgetId; id: string }
  | { kind: typeof PRIVACY_COMMAND_KIND.Usage };

const FORGET_WORD = 'forget';
const ALL_FLAG = '--all';
const NUMBER_PATTERN = /^[1-9]\d*$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const USAGE: PrivacyCommand = { kind: PRIVACY_COMMAND_KIND.Usage };

export function parsePrivacyCommand(input: string): PrivacyCommand | null {
  const [name, verb, target, ...extra] = input.trim().toLowerCase().split(/\s+/);
  if (name !== ShellCommand.Privacy) return null;
  if (verb === undefined) return { kind: PRIVACY_COMMAND_KIND.List };
  if (verb !== FORGET_WORD || target === undefined || extra.length > 0) return USAGE;
  if (target === ALL_FLAG) return { kind: PRIVACY_COMMAND_KIND.ForgetAll };
  if (NUMBER_PATTERN.test(target)) {
    return { kind: PRIVACY_COMMAND_KIND.ForgetNumber, number: Number(target) };
  }
  if (UUID_PATTERN.test(target)) return { kind: PRIVACY_COMMAND_KIND.ForgetId, id: target };
  return USAGE;
}
