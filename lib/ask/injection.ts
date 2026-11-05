const ZERO_WIDTH_CODES: ReadonlySet<number> = new Set([0x200b, 0x200c, 0x200d, 0xfeff]);

export function normalizeInjectionInput(question: string): string {
  let stripped = '';
  for (const ch of question) {
    if (!ZERO_WIDTH_CODES.has(ch.charCodeAt(0))) stripped += ch;
  }
  return stripped;
}

export const INJECTION_RE =
  /(?:^|[\n\r.!?]\s*)(?:system|assistant|developer|sistema|assistente|desenvolvedor)\s*[:>]|<\|[^|]*\|>|(?:ignore|ignorar)\s+(?:(?:all|previous|the|todas|todos|os|as|anteriores)\s+)*(?:instructions|prompts|instru[çc](?:[õo]es|[ãa]o)|diretrizes|regras)|(?:ignore|ignorar)\s+tudo(?:\s+(?:o\s+que\s+foi\s+dito|acima))?|disregard\s+(?:the\s+)?(?:above|previous|system)|desconsidere\s+(?:todas\s+)?(?:as\s+instru[çc](?:[õo]es|[ãa]o)(?:\s+acima)?|a\s+instru[çc][ãa]o(?:\s+acima)?|tudo(?:\s+o\s+que\s+foi\s+dito)?|o\s+acima|o\s+sistema|todos\s+os\s+prompts)/i;
