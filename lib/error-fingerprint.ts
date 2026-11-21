import 'server-only';
import { createHash } from 'node:crypto';

export interface FingerprintInput {
  message: string;
  stack?: string | undefined;
}

const FINGERPRINT_LENGTH = 16;
const STACK_FRAME_COUNT = 3;
const MAX_MESSAGE_CHARS = 200;
const FIELD_SEPARATOR = '\n';
const ID_PLACEHOLDER = '<id>';
const NUMBER_PLACEHOLDER = '<n>';
const HASH_PLACEHOLDER = '<hash>';
const MIN_HASH_CHARS = 8;
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const HEX_RUN_PATTERN = /\b[0-9a-f]{8,}\b/g;
const DIGIT_RUN_PATTERN = /\d+/g;
const FILE_HASH_PATTERN = new RegExp(
  `(^|[-._])(?:[0-9a-f]{${MIN_HASH_CHARS},}|(?=[a-z0-9]*\\d)[a-z0-9]{${MIN_HASH_CHARS},})(?=[-._]|$)`,
  'gi',
);
const WHITESPACE_PATTERN = /\s+/g;
const FRAME_PATTERN = /^\s*at\s|@/;
const URL_PATTERN = /https?:\/\/[^\s)]+/g;
const LOCATION_SUFFIX_PATTERN = /(?::\d+)+$/;

function normalizeMessage(message: string): string {
  return message
    .toLowerCase()
    .replace(UUID_PATTERN, ID_PLACEHOLDER)
    .replace(HEX_RUN_PATTERN, ID_PLACEHOLDER)
    .replace(DIGIT_RUN_PATTERN, NUMBER_PLACEHOLDER)
    .replace(WHITESPACE_PATTERN, ' ')
    .trim()
    .slice(0, MAX_MESSAGE_CHARS);
}

function fileOfUrl(url: string): string {
  const file = url.replace(LOCATION_SUFFIX_PATTERN, '').split('?')[0]?.split('/').pop() ?? '';
  return file.replace(FILE_HASH_PATTERN, `$1${HASH_PLACEHOLDER}`);
}

function normalizeFrame(frame: string): string {
  return frame.replace(URL_PATTERN, fileOfUrl).replace(WHITESPACE_PATTERN, ' ').trim();
}

function topFrames(stack: string | undefined): string[] {
  if (!stack) return [];
  return stack
    .split(FIELD_SEPARATOR)
    .filter((line) => FRAME_PATTERN.test(line))
    .slice(0, STACK_FRAME_COUNT)
    .map(normalizeFrame);
}

export function errorFingerprint({ message, stack }: FingerprintInput): string {
  const material = [normalizeMessage(message), ...topFrames(stack)].join(FIELD_SEPARATOR);
  return createHash('sha256').update(material).digest('hex').slice(0, FINGERPRINT_LENGTH);
}
