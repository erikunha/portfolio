const NON_PRINTING_RE = /[\p{Cf}\p{Mn}\p{Variation_Selector}]/gu;

const CONFUSABLE_SCRIPTS_RE = /[Ͱ-ϿЀ-ӿ]/g;

const CONFUSABLES_TO_LATIN: Readonly<Record<string, string>> = {
  а: 'a',
  в: 'b',
  с: 'c',
  ԁ: 'd',
  е: 'e',
  к: 'k',
  м: 'm',
  н: 'h',
  о: 'o',
  р: 'p',
  т: 't',
  у: 'y',
  х: 'x',
  і: 'i',
  ј: 'j',
  ѕ: 's',
  ӏ: 'l',
  α: 'a',
  β: 'b',
  ε: 'e',
  ι: 'i',
  κ: 'k',
  ν: 'v',
  ο: 'o',
  ρ: 'p',
  τ: 't',
  υ: 'u',
  χ: 'x',
  ϲ: 'c',
  ϳ: 'j',
};

function foldConfusables(text: string): string {
  return text.replace(CONFUSABLE_SCRIPTS_RE, (ch) => CONFUSABLES_TO_LATIN[ch.toLowerCase()] ?? ch);
}

export function normalizeInjectionInput(question: string): string {
  return foldConfusables(question.normalize('NFKD').replace(NON_PRINTING_RE, '').normalize('NFKC'));
}

const ROLE_WORDS = 'system|assistant|developer|sistema|assistente|desenvolvedor';

const SHORT_QUESTION_FRAGMENT = String.raw`(?![^\S\n]*[^\s?.!\n]+(?:[^\S\n]+[^\s?.!\n]+){0,3}[^\S\n]*\?)`;

const ROLE_TOKEN = String.raw`(?:^|[\n\r.!?,;]\s*)(?:${ROLE_WORDS})\s*[:>]${SHORT_QUESTION_FRAGMENT}`;

const CHATML_DELIMITER = String.raw`<\|[^|]*\|>`;

const OVERRIDE_QUANTIFIERS =
  '(?:all|any|previous|prior|earlier|preceding|above|the|of|your|todas|todos|os|as|anteriores)';

const OVERRIDE_PHRASE = [
  String.raw`(?:ignore|ignorar)\s+(?:${OVERRIDE_QUANTIFIERS}\s+)*(?:instructions|prompts|instru[çc](?:[õo]es|[ãa]o))`,
  String.raw`(?:ignore|ignorar)\s+(?:${OVERRIDE_QUANTIFIERS}\s+)+(?:directions|directives)`,
  String.raw`(?:ignore|ignorar)\s+(?:(?:as|os)\s+)?(?:suas\s+|seus\s+)(?:diretrizes|regras)`,
  String.raw`(?:ignore|ignorar)\s+(?:(?:as|os)\s+)?(?:diretrizes|regras)\s+(?:anteriores|acima|do\s+sistema)`,
  String.raw`(?:ignore|ignorar)\s+tudo(?:\s+(?:o\s+que\s+foi\s+dito|acima))?`,
  String.raw`disregard\s+(?:the\s+)?(?:above|previous|system)`,
  String.raw`desconsidere\s+(?:todas\s+)?(?:as\s+instru[çc](?:[õo]es|[ãa]o)(?:\s+acima)?|a\s+instru[çc][ãa]o(?:\s+acima)?|tudo(?:\s+o\s+que\s+foi\s+dito)?|o\s+acima|o\s+sistema|todos\s+os\s+prompts)`,
].join('|');

export const INJECTION_RE = new RegExp(`${ROLE_TOKEN}|${CHATML_DELIMITER}|${OVERRIDE_PHRASE}`, 'i');

const MENTION_CUES = 'against|about|called|named|titled|phrases?|sobre|contra|frases?|chamad[oa]s?';

const MENTION_HEAD_NOUNS =
  'attacks?|attempts?|injections?|prompts?|phrases?|commands?|ataques?|tentativas?|inje[çc](?:[õo]es|[ãa]o)|frases?|comandos?';

const MENTIONED_OVERRIDE_RE = new RegExp(
  String.raw`\b(?:${MENTION_CUES})\s+(?:(?:the|a|an|o|a|os|as|do)\s+)?(?:${OVERRIDE_PHRASE})\s+(?:${MENTION_HEAD_NOUNS})\b`,
  'gi',
);

const QUOTE_PAIRS: readonly (readonly [string, string])[] = [
  ['"', '"'],
  ['“', '”'],
  ['«', '»'],
  ['`', '`'],
  ['‘', '’'],
];

const QUOTED_SPAN_MAX_CHARS = 120;

function escapeForClass(ch: string): string {
  return ch.replace(/[\\\]^-]/g, '\\$&');
}

const QUOTED_SPAN_RE = new RegExp(
  [
    ...QUOTE_PAIRS.map(
      ([open, close]) =>
        `${open}[^${escapeForClass(open)}${escapeForClass(close)}\\n]{1,${QUOTED_SPAN_MAX_CHARS}}${close}`,
    ),
    String.raw`(?<![\p{L}\p{N}])'[^'\n]{1,${QUOTED_SPAN_MAX_CHARS}}'(?![\p{L}\p{N}])`,
  ].join('|'),
  'gu',
);

function withoutMentions(text: string): string {
  return text.replace(QUOTED_SPAN_RE, ' ').replace(MENTIONED_OVERRIDE_RE, ' ');
}

export function isInjectionAttempt(question: string): boolean {
  return INJECTION_RE.test(withoutMentions(normalizeInjectionInput(question)));
}
