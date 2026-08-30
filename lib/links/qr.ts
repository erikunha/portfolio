export type QrMatrix = {
  version: number;
  size: number;
  modules: boolean[][];
};

const MAX_VERSION = 10;
const MIN_VERSION = 1;
const MODULES_PER_VERSION = 4;
const BASE_SIZE = 17;
const BYTE_MODE_INDICATOR = 4;
const BYTE_MODE_BITS = 4;
const SHORT_COUNT_BITS = 8;
const LONG_COUNT_BITS = 16;
const LONG_COUNT_FROM_VERSION = 10;
const TERMINATOR_BITS = 4;
const PAD_CODEWORDS = [0xec, 0x11] as const;
const GF_PRIMITIVE = 0x11d;
const GF_SIZE = 256;
const GF_ORDER = 255;
const MASK_COUNT = 8;
const FINDER_SIZE = 7;
const ALIGNMENT_RADIUS = 2;
const FORMAT_BITS = 15;
const VERSION_INFO_BITS = 18;
const VERSION_INFO_FROM = 7;
const PENALTY_BLOCK = 3;
const PENALTY_RUN = 3;
const PENALTY_RUN_EXTRA = 1;
const PENALTY_RUN_LENGTH = 5;

type VersionSpec = { ecPerBlock: number; groups: readonly (readonly [number, number])[] };

const VERSION_SPECS: Record<number, VersionSpec> = {
  1: { ecPerBlock: 10, groups: [[1, 16]] },
  2: { ecPerBlock: 16, groups: [[1, 28]] },
  3: { ecPerBlock: 26, groups: [[1, 44]] },
  4: { ecPerBlock: 18, groups: [[2, 32]] },
  5: { ecPerBlock: 24, groups: [[2, 43]] },
  6: { ecPerBlock: 16, groups: [[4, 27]] },
  7: { ecPerBlock: 18, groups: [[4, 31]] },
  8: {
    ecPerBlock: 22,
    groups: [
      [2, 38],
      [2, 39],
    ],
  },
  9: {
    ecPerBlock: 22,
    groups: [
      [3, 36],
      [2, 37],
    ],
  },
  10: {
    ecPerBlock: 26,
    groups: [
      [4, 43],
      [1, 44],
    ],
  },
};

const ALIGNMENT_CENTERS: Record<number, readonly number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

const FORMAT_INFO_EC_M: readonly string[] = [
  '101010000010010',
  '101000100100101',
  '101111001111100',
  '101101101001011',
  '100010111111001',
  '100000011001110',
  '100111110010111',
  '100101010100000',
];

const VERSION_INFO: Record<number, string> = {
  7: '000111110010010100',
  8: '001000010110111100',
  9: '001001101010011001',
  10: '001010010011010011',
};

const EXP = new Array<number>(GF_SIZE);
const LOG = new Array<number>(GF_SIZE);
{
  let x = 1;
  for (let i = 0; i < GF_ORDER; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= GF_PRIMITIVE;
  }
  EXP[GF_ORDER] = EXP[0] as number;
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[((LOG[a] as number) + (LOG[b] as number)) % GF_ORDER] as number;
}

function generatorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const term = [1, EXP[i] as number];
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let a = 0; a < poly.length; a++) {
      for (let b = 0; b < term.length; b++) {
        next[a + b] = (next[a + b] as number) ^ gfMul(poly[a] as number, term[b] as number);
      }
    }
    poly = next;
  }
  return poly;
}

function reedSolomon(data: readonly number[], degree: number): number[] {
  const gen = generatorPoly(degree);
  const ec = new Array<number>(degree).fill(0);
  for (const d of data) {
    const factor = d ^ (ec[0] as number);
    ec.shift();
    ec.push(0);
    if (factor === 0) continue;
    for (let i = 0; i < degree; i++) {
      ec[i] = (ec[i] as number) ^ gfMul(gen[i + 1] as number, factor);
    }
  }
  return ec;
}

function buildCodewords(text: string): { version: number; data: number[] } {
  const bytes = Array.from(new TextEncoder().encode(text));

  let version = 0;
  let spec: VersionSpec | undefined;
  let dataCodewords = 0;
  let countBits = SHORT_COUNT_BITS;

  for (let v = MIN_VERSION; v <= MAX_VERSION; v++) {
    const candidate = VERSION_SPECS[v];
    if (!candidate) continue;
    const capacity = candidate.groups.reduce((total, [count, size]) => total + count * size, 0);
    const bits = v < LONG_COUNT_FROM_VERSION ? SHORT_COUNT_BITS : LONG_COUNT_BITS;
    if (BYTE_MODE_BITS + bits + bytes.length * 8 <= capacity * 8) {
      version = v;
      spec = candidate;
      dataCodewords = capacity;
      countBits = bits;
      break;
    }
  }
  if (version === 0 || !spec) {
    throw new Error(
      `QR: payload of ${bytes.length} bytes is too long for versions ${MIN_VERSION}-${MAX_VERSION}`,
    );
  }

  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };
  push(BYTE_MODE_INDICATOR, BYTE_MODE_BITS);
  push(bytes.length, countBits);
  for (const byte of bytes) push(byte, 8);

  const capacityBits = dataCodewords * 8;
  for (let i = 0; i < TERMINATOR_BITS && bits.length < capacityBits; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    codewords.push(Number.parseInt(bits.slice(i, i + 8).join(''), 2));
  }
  let padIndex = 0;
  while (codewords.length < dataCodewords) {
    codewords.push(PAD_CODEWORDS[padIndex++ % PAD_CODEWORDS.length] as number);
  }

  const blocks: { data: number[]; ec: number[] }[] = [];
  let cursor = 0;
  for (const [count, size] of spec.groups) {
    for (let i = 0; i < count; i++) {
      const chunk = codewords.slice(cursor, cursor + size);
      cursor += size;
      blocks.push({ data: chunk, ec: reedSolomon(chunk, spec.ecPerBlock) });
    }
  }

  const interleaved: number[] = [];
  const longestBlock = Math.max(...blocks.map((b) => b.data.length));
  for (let i = 0; i < longestBlock; i++) {
    for (const block of blocks) {
      const value = block.data[i];
      if (value !== undefined) interleaved.push(value);
    }
  }
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (const block of blocks) interleaved.push(block.ec[i] as number);
  }

  return { version, data: interleaved };
}

function maskAt(mask: number, row: number, col: number): boolean {
  switch (mask) {
    case 0:
      return (row + col) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return col % 3 === 0;
    case 3:
      return (row + col) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5:
      return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6:
      return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    default:
      return (((row * col) % 3) + ((row + col) % 2)) % 2 === 0;
  }
}

function buildMatrix(version: number, data: readonly number[], mask: number): QrMatrix {
  const size = BASE_SIZE + version * MODULES_PER_VERSION;
  const grid: (boolean | null)[][] = Array.from({ length: size }, () =>
    new Array<boolean | null>(size).fill(null),
  );
  const set = (row: number, col: number, value: boolean) => {
    if (row < 0 || row >= size || col < 0 || col >= size) return;
    (grid[row] as (boolean | null)[])[col] = value;
  };
  const at = (row: number, col: number): boolean | null =>
    (grid[row] as (boolean | null)[] | undefined)?.[col] ?? null;

  const finder = (top: number, left: number) => {
    for (let r = -1; r <= FINDER_SIZE; r++) {
      for (let c = -1; c <= FINDER_SIZE; c++) {
        const onRing =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6));
        const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        set(top + r, left + c, onRing || inCore);
      }
    }
  };
  finder(0, 0);
  finder(size - FINDER_SIZE, 0);
  finder(0, size - FINDER_SIZE);

  for (let r = 8; r < size - 8; r++) if (at(r, 6) === null) set(r, 6, r % 2 === 0);
  for (let c = 8; c < size - 8; c++) if (at(6, c) === null) set(6, c, c % 2 === 0);

  for (const row of ALIGNMENT_CENTERS[version] ?? []) {
    for (const col of ALIGNMENT_CENTERS[version] ?? []) {
      if (at(row, col) !== null) continue;
      for (let r = -ALIGNMENT_RADIUS; r <= ALIGNMENT_RADIUS; r++) {
        for (let c = -ALIGNMENT_RADIUS; c <= ALIGNMENT_RADIUS; c++) {
          const onRing =
            Math.abs(r) === ALIGNMENT_RADIUS ||
            Math.abs(c) === ALIGNMENT_RADIUS ||
            (r === 0 && c === 0);
          set(row + r, col + c, onRing);
        }
      }
    }
  }

  if (version >= VERSION_INFO_FROM) {
    const info = Number.parseInt(VERSION_INFO[version] as string, 2);
    for (let i = 0; i < VERSION_INFO_BITS; i++) {
      const on = ((info >> i) & 1) === 1;
      set(Math.floor(i / 3), (i % 3) + size - 11, on);
      set((i % 3) + size - 11, Math.floor(i / 3), on);
    }
  }

  const format = Number.parseInt(FORMAT_INFO_EC_M[mask] as string, 2);
  for (let i = 0; i < FORMAT_BITS; i++) {
    const on = ((format >> i) & 1) === 1;
    if (i < 6) set(i, 8, on);
    else if (i < 8) set(i + 1, 8, on);
    else set(size - FORMAT_BITS + i, 8, on);

    if (i < 8) set(8, size - i - 1, on);
    else if (i < 9) set(8, 8 - (i - 7), on);
    else set(8, FORMAT_BITS - i - 1, on);
  }
  set(size - 8, 8, true);

  let direction = -1;
  let row = size - 1;
  let bitIndex = 7;
  let byteIndex = 0;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (;;) {
      for (let offset = 0; offset < 2; offset++) {
        const target = col - offset;
        if (at(row, target) !== null) continue;
        const byte = data[byteIndex];
        let dark = byte !== undefined && ((byte >>> bitIndex) & 1) === 1;
        if (maskAt(mask, row, target)) dark = !dark;
        set(row, target, dark);
        bitIndex--;
        if (bitIndex === -1) {
          byteIndex++;
          bitIndex = 7;
        }
      }
      row += direction;
      if (row < 0 || row >= size) {
        row -= direction;
        direction = -direction;
        break;
      }
    }
  }

  return { version, size, modules: grid as boolean[][] };
}

function penalty({ size, modules }: QrMatrix): number {
  let score = 0;
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const value = modules[r]?.[c];
      if (
        value === modules[r]?.[c + 1] &&
        value === modules[r + 1]?.[c] &&
        value === modules[r + 1]?.[c + 1]
      ) {
        score += PENALTY_BLOCK;
      }
    }
  }
  const scoreRuns = (read: (a: number, b: number) => boolean | undefined) => {
    for (let a = 0; a < size; a++) {
      let previous: boolean | undefined;
      let run = 0;
      for (let b = 0; b < size; b++) {
        const value = read(a, b);
        if (value === previous) {
          run++;
          if (run === PENALTY_RUN_LENGTH) score += PENALTY_RUN;
          else if (run > PENALTY_RUN_LENGTH) score += PENALTY_RUN_EXTRA;
        } else {
          previous = value;
          run = 1;
        }
      }
    }
  };
  scoreRuns((a, b) => modules[a]?.[b]);
  scoreRuns((a, b) => modules[b]?.[a]);
  return score;
}

export function qrMatrix(text: string): QrMatrix {
  const { version, data } = buildCodewords(text);
  let best: QrMatrix | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < MASK_COUNT; mask++) {
    const candidate = buildMatrix(version, data, mask);
    const score = penalty(candidate);
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best as QrMatrix;
}

export function qrSvgPath({ size, modules }: QrMatrix, quietZone = 0): string {
  const segments: string[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules[r]?.[c]) segments.push(`M${c + quietZone} ${r + quietZone}h1v1h-1z`);
    }
  }
  return segments.join('');
}
