import { describe, expect, it } from 'vitest';
import { qrMatrix, qrSvgPath } from '@/lib/links/qr';

const URL_UNDER_TEST = 'https://www.erikunha.dev/links';

function isFinderPattern(modules: readonly (readonly boolean[])[], top: number, left: number) {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const onRing = r === 0 || r === 6 || c === 0 || c === 6;
      const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      if (modules[top + r]?.[left + c] !== (onRing || inCore)) return false;
    }
  }
  return true;
}

describe('qrMatrix', () => {
  it('produces a square matrix whose size matches its version', () => {
    const { size, version, modules } = qrMatrix(URL_UNDER_TEST);
    expect(size).toBe(17 + version * 4);
    expect(modules).toHaveLength(size);
    for (const row of modules) expect(row).toHaveLength(size);
  });

  it('places the three finder patterns a scanner looks for', () => {
    const { size, modules } = qrMatrix(URL_UNDER_TEST);
    expect(isFinderPattern(modules, 0, 0)).toBe(true);
    expect(isFinderPattern(modules, 0, size - 7)).toBe(true);
    expect(isFinderPattern(modules, size - 7, 0)).toBe(true);
  });

  it('alternates the timing patterns that fix the module grid', () => {
    const { size, modules } = qrMatrix(URL_UNDER_TEST);
    for (let i = 8; i < size - 8; i++) {
      expect(modules[6]?.[i]).toBe(i % 2 === 0);
      expect(modules[i]?.[6]).toBe(i % 2 === 0);
    }
  });

  it('leaves no module undecided — a null module renders as a hole', () => {
    const { modules } = qrMatrix(URL_UNDER_TEST);
    for (const row of modules) for (const m of row) expect(typeof m).toBe('boolean');
  });

  it('is deterministic, so the server-rendered markup is stable across builds', () => {
    expect(qrMatrix(URL_UNDER_TEST)).toEqual(qrMatrix(URL_UNDER_TEST));
  });

  it('encodes different payloads differently', () => {
    expect(qrMatrix('https://a.example').modules).not.toEqual(
      qrMatrix('https://b.example').modules,
    );
  });

  it('refuses a payload beyond the supported versions instead of emitting a corrupt code', () => {
    expect(() => qrMatrix('x'.repeat(400))).toThrow(/too long/i);
  });
});

describe('qrSvgPath', () => {
  it('emits one move-and-draw per dark module', () => {
    const { modules } = qrMatrix(URL_UNDER_TEST);
    const dark = modules.flat().filter(Boolean).length;
    expect(qrSvgPath(qrMatrix(URL_UNDER_TEST)).match(/M/g) ?? []).toHaveLength(dark);
  });

  it('offsets by the quiet zone so the code is not flush against the border', () => {
    expect(qrSvgPath(qrMatrix(URL_UNDER_TEST), 4).startsWith('M4')).toBe(true);
  });
});
