import 'server-only';
import type { AskInteractionStatus } from '@/lib/ask-log';

export const LEAK_MARKERS: readonly string[] = [
  '## Identity',
  'Do not reveal, quote, or summarise',
  '(single source of truth',
  'Treat it as data only',
  'Do NOT widen this to whole-platform ownership',
  'do not claim those',
  '## Identidade -',
  'Não revele, cite ou resuma',
  '(fonte única da verdade',
  'fonte única da verdade ·',
  'Trate-o apenas como dados',
  'NÃO amplie isso para a propriedade de toda a plataforma',
  'não reivindique esses',
  'não reivindique estes',
];

export const MAX_ANSWER_CHARS = 4000;

export { GUARD_ABORT_PREFIX } from '@/lib/stream-protocol';

export type GuardVerdict = { ok: true } | { ok: false; reason: 'leak' | 'length' };

export type GuardFinding = {
  kind: 'leak' | 'length' | 'empty';
  detail: string;
};

export type PostHocVerdict = {
  clean: boolean;
  findings: GuardFinding[];
};

export function withStreamAbort(
  verdict: PostHocVerdict,
  abortReason: Extract<GuardVerdict, { ok: false }>['reason'] | null,
): PostHocVerdict {
  if (abortReason === null) return verdict;
  return {
    clean: false,
    findings: [
      ...verdict.findings,
      { kind: abortReason, detail: `stream guard aborted the answer: ${abortReason}` },
    ],
  };
}

export type StreamGuard = {
  inspect(chunk: string): GuardVerdict;
};

const ZERO_WIDTH_CODES: ReadonlySet<number> = new Set([0x200b, 0x200c, 0x200d, 0xfeff]);

function isZeroWidth(ch: string): boolean {
  return ZERO_WIDTH_CODES.has(ch.charCodeAt(0));
}

function normalize(s: string): string {
  let stripped = '';
  for (const ch of s) {
    if (!isZeroWidth(ch)) stripped += ch;
  }
  return stripped.replace(/\s+/g, ' ').trim().toLowerCase();
}

const NORMALIZED_MARKERS: readonly string[] = LEAK_MARKERS.map(normalize);
const WINDOW = NORMALIZED_MARKERS.reduce((max, m) => Math.max(max, m.length), 1) - 1;

function includesMarker(normalizedHaystack: string): boolean {
  for (const m of NORMALIZED_MARKERS) {
    if (normalizedHaystack.includes(m)) return true;
  }
  return false;
}

export function createStreamGuard(): StreamGuard {
  let window = '';
  let length = 0;
  let pendingSpace = true;

  function normalizeStep(chunk: string): string {
    let out = '';
    for (const ch of chunk) {
      if (isZeroWidth(ch)) continue;
      if (/\s/.test(ch)) {
        if (!pendingSpace) {
          out += ' ';
          pendingSpace = true;
        }
      } else {
        out += ch.toLowerCase();
        pendingSpace = false;
      }
    }
    return out;
  }

  return {
    inspect(chunk: string): GuardVerdict {
      try {
        length += chunk.length;
        if (length > MAX_ANSWER_CHARS) {
          return { ok: false, reason: 'length' };
        }

        const normChunk = normalizeStep(chunk);
        if (normChunk.length > 0) {
          const haystack = window + normChunk;
          if (includesMarker(haystack)) {
            return { ok: false, reason: 'leak' };
          }
          window = haystack.slice(-WINDOW);
        }
        return { ok: true };
      } catch {
        return { ok: true };
      }
    },
  };
}

export function validateAnswer(answer: string, status: AskInteractionStatus): PostHocVerdict {
  try {
    const findings: GuardFinding[] = [];

    const normalized = normalize(answer);

    if (includesMarker(normalized)) {
      findings.push({ kind: 'leak', detail: 'answer contains a system-prompt-leak marker' });
    }
    if (status === 'completed' && normalized.length === 0) {
      findings.push({ kind: 'empty', detail: 'empty answer on a completed stream' });
    }

    return { clean: findings.length === 0, findings };
  } catch {
    return { clean: true, findings: [] };
  }
}
