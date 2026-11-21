import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ASK_MODEL } from '@/lib/ask/model';
import { listFiles } from '@/scripts/lib/walk';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ROOT_DOCS = ['AGENTS.md', 'README.md', 'ARCHITECTURE.md', 'STANDARDS.md', 'REVIEW.md'];
const DOCS_DIR = 'docs';
const MODEL_ID_PATTERN = /anthropic\/claude-(?:haiku|sonnet|opus)-\d+(?:[.-]\d+)*/g;
const MODEL_NAME_PATTERN = /\b(?:Haiku|Sonnet|Opus) \d+(?:\.\d+)?\b/g;
const FAMILY_AND_VERSION = /^anthropic\/claude-(haiku|sonnet|opus)-(\d+(?:[.-]\d+)*)$/;

function displayName(modelId: string): string {
  const match = FAMILY_AND_VERSION.exec(modelId);
  if (!match) throw new Error(`unrecognised model id ${modelId}`);
  const [, family = '', version = ''] = match;
  return `${family.charAt(0).toUpperCase()}${family.slice(1)} ${version}`;
}

function staleMentions(text: string, askModel: string): string[] {
  const name = displayName(askModel);
  return [
    ...(text.match(MODEL_ID_PATTERN) ?? []).filter((id) => id !== askModel),
    ...(text.match(MODEL_NAME_PATTERN) ?? []).filter((found) => found !== name),
  ];
}

function docPaths(): string[] {
  const nested = listFiles(path.join(REPO_ROOT, DOCS_DIR), { include: /\.md$/ }).map((rel) =>
    path.join(DOCS_DIR, rel),
  );
  return [...ROOT_DOCS, ...nested];
}

describe('docs name the ask model from lib/ask/model.ts', () => {
  it('flags an id or display name that differs from ASK_MODEL', () => {
    expect(staleMentions('model `anthropic/claude-haiku-4-5`', ASK_MODEL)).toEqual([
      'anthropic/claude-haiku-4-5',
    ]);
    expect(staleMentions('Anthropic Haiku 4.5', ASK_MODEL)).toEqual(['Haiku 4.5']);
    expect(staleMentions(`${ASK_MODEL} and ${displayName(ASK_MODEL)}`, ASK_MODEL)).toEqual([]);
  });

  it('finds no stale model id or name in any doc', () => {
    const stale = docPaths().flatMap((relativePath) =>
      staleMentions(readFileSync(path.join(REPO_ROOT, relativePath), 'utf-8'), ASK_MODEL).map(
        (found) => `${relativePath}: ${found}`,
      ),
    );
    expect(stale).toEqual([]);
  });
});
