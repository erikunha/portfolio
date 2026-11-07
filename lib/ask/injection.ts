const NON_PRINTING_RE = /[\p{Cf}\p{Mn}\p{Variation_Selector}]/gu;

export function normalizeInjectionInput(question: string): string {
  return question.normalize('NFKD').replace(NON_PRINTING_RE, '').normalize('NFKC');
}

export const INJECTION_RE =
  /(?:^|[\n\r.!?,;]\s*)(?:system|assistant|developer|sistema|assistente|desenvolvedor)\s*[:>]|<\|[^|]*\|>|(?:ignore|ignorar)\s+(?:(?:all|previous|the|todas|todos|os|as|anteriores)\s+)*(?:instructions|prompts|instru[çc](?:[õo]es|[ãa]o)|diretrizes|regras)|(?:ignore|ignorar)\s+tudo(?:\s+(?:o\s+que\s+foi\s+dito|acima))?|disregard\s+(?:the\s+)?(?:above|previous|system)|desconsidere\s+(?:todas\s+)?(?:as\s+instru[çc](?:[õo]es|[ãa]o)(?:\s+acima)?|a\s+instru[çc][ãa]o(?:\s+acima)?|tudo(?:\s+o\s+que\s+foi\s+dito)?|o\s+acima|o\s+sistema|todos\s+os\s+prompts)/i;
