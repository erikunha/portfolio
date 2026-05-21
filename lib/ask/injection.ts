// lib/ask/injection.ts
//
// Prompt-injection sanitization regex for /api/ask. Imported by the route
// (pre-Anthropic reject gate) and by __tests__/ask-prompt-injection.test.ts
// so the gate and its tests share one source of truth.
//
// This is a defense layer, not a complete fix — the delimited <q SENTINEL>
// block + re-anchor instruction in route.ts also constrain the model. The
// point is to raise attack cost; determined attackers may still bypass, but
// the high-frequency casual jailbreaks are rejected here before any token
// is spent.
//
// Coverage:
//   - role tokens         `system:` `assistant:` `developer:` (`:` or `>`)
//   - ChatML delimiters   `<|im_start|>` `<|system|>` `<|im_end|>` `<||>`
//   - instruction-override `ignore (all|previous) instructions/prompts`
//   - context-override     `disregard (the) above/previous/system`
//
// ReDoS note: the alternation has no nested quantifiers and no overlapping
// quantified groups, so it cannot backtrack catastrophically. The ChatML
// branch uses `[^|]*` (a negated class), which matches each character at
// most once — linear time. Every other branch is a fixed-token alternation.
//
// False-positive note: the role-token branch requires the token to be
// preceded by start-of-string or whitespace AND followed by `:`/`>`, so
// `systems`, `assistant role`, etc. in normal questions do not match. The
// ChatML branch requires the literal `<|...|>` frame, which does not occur
// in natural prose or in TypeScript generics like `Pick<T>`.
export const INJECTION_RE =
  /(?:^|\s)(?:system|assistant|developer)\s*[:>]|<\|[^|]*\|>|ignore\s+(?:all\s+|previous\s+)?(?:instructions|prompts)|disregard\s+(?:the\s+)?(?:above|previous|system)/i;
