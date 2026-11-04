// Layer-0 prompt-injection gate for POST /api/ask. English and Portuguese
// override phrasings: the pt-BR locale makes Portuguese the live injection
// surface, and an English-only pattern list would fail open for it.
export const INJECTION_RE =
  /(?:^|\s)(?:system|assistant|developer|sistema|assistente|desenvolvedor)\s*[:>]|<\|[^|]*\|>|(?:ignore|ignorar)\s+(?:(?:all|previous|todas|as|anteriores)\s+)*(?:instructions|prompts|instru[çc][oõ]es)|disregard\s+(?:the\s+)?(?:above|previous|system)|desconsidere\s+(?:tudo(?:\s+o\s+que\s+foi\s+dito)?|o\s+acima|as\s+instru[çc][oõ]es(?:\s+acima)?|o\s+sistema)/i;
