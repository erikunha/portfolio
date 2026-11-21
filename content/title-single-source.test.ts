import { describe, expect, it } from 'vitest';
import { ASK_EVAL_CORPUS } from './ask-eval-corpus';
import { NOW_CURRENTLY, WHOIS_TITLE } from './now-currently';
import { profile } from './profile';

describe('title single source', () => {
  it('whois title is the profile title', () => {
    expect(WHOIS_TITLE).toBe(profile.title);
  });

  it('now-currently starts with the profile title', () => {
    expect(NOW_CURRENTLY.startsWith(`${profile.title}. `)).toBe(true);
  });

  it('title facts in the eval corpus equal the profile title', () => {
    const titled = ASK_EVAL_CORPUS.filter((item) => item.facts?.includes(profile.title));
    expect(titled.length).toBeGreaterThanOrEqual(3);
  });
});
