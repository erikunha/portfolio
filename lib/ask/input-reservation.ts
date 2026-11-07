import { ASK_MAX_QUESTION_CHARS } from '@/lib/ask/limits';
import { SYSTEM_TEXT } from '@/lib/ask/system-prompt';

const CHARS_PER_TOKEN_FLOOR = 3;
const REQUEST_FRAMING_TOKENS = 300;

export const ASK_RESERVED_INPUT_TOKENS =
  Math.ceil((SYSTEM_TEXT.length + ASK_MAX_QUESTION_CHARS) / CHARS_PER_TOKEN_FLOOR) +
  REQUEST_FRAMING_TOKENS;
