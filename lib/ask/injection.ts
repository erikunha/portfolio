// Layer-0 prompt-injection gate for POST /api/ask. English and Portuguese
// override phrasings: the pt-BR locale makes Portuguese the live injection
// surface, and an English-only pattern list would fail open for it. The gate
// normalizes zero-width characters first, matching the output guard's layer-1
// normalization, so the same evasion cannot slip past layer 0.
const ZERO_WIDTH_CODES: ReadonlySet<number> = new Set([0x200b, 0x200c, 0x200d, 0xfeff]);

export function normalizeInjectionInput(question: string): string {
  let stripped = '';
  for (const ch of question) {
    if (!ZERO_WIDTH_CODES.has(ch.charCodeAt(0))) stripped += ch;
  }
  return stripped;
}

// Role tokens must open the question or a sentence: mid-question addressals
// like "Para o desenvolvedor: como contribuir?" are legitimate pt-BR questions,
// not overrides. Override verbs keep an object requirement so genuine how-tos
// ("como ignorar as instruções do meu linter" — a question, not an order)
// are not 400'd.
export const INJECTION_RE =
  /(?:^|[.!?]\s*)(?:system|assistant|developer|sistema|assistente|desenvolvedor)\s*[:>]|<\|[^|]*\|>|(?:ignore|ignorar)\s+(?:(?:all|previous|the|todas|todos|os|as|anteriores)\s+)*(?:instructions|prompts|instru[çc](?:[õo]es|[ãa]o)|diretrizes|regras)|(?:ignore|ignorar)\s+tudo(?:\s+(?:o\s+que\s+foi\s+dito|acima))?|disregard\s+(?:the\s+)?(?:above|previous|system)|desconsidere\s+(?:todas\s+)?(?:as\s+instru[çc](?:[õo]es|[ãa]o)(?:\s+acima)?|a\s+instru[çc][ãa]o(?:\s+acima)?|tudo(?:\s+o\s+que\s+foi\s+dito)?|o\s+acima|o\s+sistema|todos\s+os\s+prompts)/i;
