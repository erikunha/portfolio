import { describe, expect, it } from 'vitest';
import { ONLY_FLAG, parseOnly, resolveOnly } from '@/lib/eval/only-filter';

describe('parseOnly', () => {
  it('returns null when the flag is absent, so the run is not filtered', () => {
    expect(parseOnly([])).toBeNull();
    expect(parseOnly(['--judge-repeats', '5'])).toBeNull();
  });

  it('reads a comma list after the flag or after an equals sign', () => {
    expect(parseOnly([ONLY_FLAG, 'a,b'])).toEqual(['a', 'b']);
    expect(parseOnly([`${ONLY_FLAG}=a,b`])).toEqual(['a', 'b']);
  });

  it('trims spaces, drops empty entries and repeated ids', () => {
    expect(parseOnly([ONLY_FLAG, ' a, b ,,a'])).toEqual(['a', 'b']);
  });

  it('refuses a flag with no ids', () => {
    expect(() => parseOnly([ONLY_FLAG])).toThrow(/--only needs at least one id/);
    expect(() => parseOnly([ONLY_FLAG, '--judge-repeats', '2'])).toThrow(/needs at least one id/);
    expect(() => parseOnly([`${ONLY_FLAG}=`])).toThrow(/needs at least one id/);
    expect(() => parseOnly([ONLY_FLAG, ' , '])).toThrow(/needs at least one id/);
  });
});

describe('resolveOnly', () => {
  const corpus = ['fact-a', 'edge-b'];
  const calibration = ['cal-c'];

  it('splits the ids between the corpus and the gold set', () => {
    expect(resolveOnly(['cal-c', 'fact-a'], corpus, calibration)).toEqual({
      corpus: ['fact-a'],
      calibration: ['cal-c'],
    });
  });

  it('names every unknown id and refuses the run', () => {
    expect(() => resolveOnly(['fact-a', 'nope', 'also-nope'], corpus, calibration)).toThrow(
      /unknown id\(s\): nope, also-nope/,
    );
  });
});

describe('parseOnly with a repeated flag', () => {
  it('merges every occurrence in order, whatever the spelling', () => {
    expect(parseOnly([ONLY_FLAG, 'a', ONLY_FLAG, 'b'])).toEqual(['a', 'b']);
    expect(parseOnly([ONLY_FLAG, 'a,b', `${ONLY_FLAG}=c`])).toEqual(['a', 'b', 'c']);
  });

  it('drops an id repeated across occurrences', () => {
    expect(parseOnly([ONLY_FLAG, 'a,b', ONLY_FLAG, 'b,c'])).toEqual(['a', 'b', 'c']);
  });

  it('still refuses when no occurrence carries an id', () => {
    expect(() => parseOnly([ONLY_FLAG, ONLY_FLAG])).toThrow(/needs at least one id/);
  });
});
