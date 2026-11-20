import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FONT_DIR = path.join(REPO_ROOT, 'public', 'fonts');
const CONTENT_DIR = path.join(REPO_ROOT, 'content');
const CSS_DIR = path.join(REPO_ROOT, 'app', 'css');
const TEXT_FACES = ['jetbrains-mono-400.woff2', 'jetbrains-mono-700.woff2'];
const COPY_FILE = /(?<!\.test)\.ts$/;
const STYLESHEET = /\.css$/;

const WOFF2_SIGNATURE = 'wOF2';
const WOFF2_SIGNATURE_BYTES = 4;
const WOFF2_TABLE_COUNT_OFFSET = 12;
const WOFF2_COMPRESSED_SIZE_OFFSET = 20;
const WOFF2_DIRECTORY_OFFSET = 48;
const TABLE_TAG_MASK = 0x3f;
const TABLE_TRANSFORM_SHIFT = 6;
const ARBITRARY_TAG = 0x3f;
const ARBITRARY_TAG_BYTES = 4;
const CMAP_TAG = 0;
const GLYF_TAG = 10;
const LOCA_TAG = 11;
const GLYPH_TRANSFORM = 0;
const NO_TRANSFORM = 0;
const BASE128_RADIX = 128;
const BASE128_PAYLOAD = 0x7f;
const BASE128_CONTINUES = 0x80;

const CMAP_SUBTABLE_COUNT_OFFSET = 2;
const CMAP_RECORDS_OFFSET = 4;
const CMAP_RECORD_BYTES = 8;
const CMAP_RECORD_SUBTABLE_OFFSET = 4;
const SEGMENT_FORMAT = 4;
const SEGMENT_COUNT_OFFSET = 6;
const SEGMENT_ARRAYS_OFFSET = 14;
const SEGMENT_PAD_BYTES = 2;
const SEGMENT_ENTRY_BYTES = 2;
const SEGMENT_SENTINEL = 0xffff;
const GLYPH_INDEX_MASK = 0xffff;
const MISSING_GLYPH = 0;

const DRAWS_NO_GLYPH = /[\p{Cc}\p{Cf}]/u;
const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;
const CSS_STRING = String.raw`"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'`;
const CSS_VALUE = `((?:${CSS_STRING}|[^;}"'])+)`;
const CONTENT_DECLARATION = new RegExp(String.raw`(?<![\w-])content\s*:${CSS_VALUE}`, 'g');
const CUSTOM_PROPERTY = new RegExp(String.raw`(--[\w-]+)\s*:${CSS_VALUE}`, 'g');
const STRING_TOKEN = new RegExp(CSS_STRING, 'g');
const VAR_REFERENCE = /var\(\s*(--[\w-]+)/g;
const CSS_ESCAPE = /\\(?:([0-9a-fA-F]{1,6})\s?|([\s\S]))/g;
const HEX_RADIX = 16;
const CODE_POINT_DIGITS = 4;

interface Face {
  name: string;
  codePoints: Set<number>;
}

interface Text {
  source: string;
  text: string;
}

function readBase128(bytes: Buffer, cursor: { offset: number }): number {
  let value = 0;
  let byte = 0;
  do {
    byte = bytes.readUInt8(cursor.offset);
    cursor.offset += 1;
    value = value * BASE128_RADIX + (byte & BASE128_PAYLOAD);
  } while ((byte & BASE128_CONTINUES) !== 0);
  return value;
}

function cmapTable(font: Buffer): Buffer {
  if (font.toString('latin1', 0, WOFF2_SIGNATURE_BYTES) !== WOFF2_SIGNATURE) {
    throw new Error('the font file is not WOFF2');
  }
  const cursor = { offset: WOFF2_DIRECTORY_OFFSET };
  const tables: { tag: number; length: number }[] = [];
  for (let index = 0; index < font.readUInt16BE(WOFF2_TABLE_COUNT_OFFSET); index += 1) {
    const flags = font.readUInt8(cursor.offset);
    cursor.offset += 1;
    const tag = flags & TABLE_TAG_MASK;
    if (tag === ARBITRARY_TAG) cursor.offset += ARBITRARY_TAG_BYTES;
    const version = flags >> TABLE_TRANSFORM_SHIFT;
    const transformed =
      tag === GLYF_TAG || tag === LOCA_TAG ? version === GLYPH_TRANSFORM : version !== NO_TRANSFORM;
    const originalLength = readBase128(font, cursor);
    const length = transformed ? readBase128(font, cursor) : originalLength;
    tables.push({ tag, length });
  }
  const data = brotliDecompressSync(
    font.subarray(cursor.offset, cursor.offset + font.readUInt32BE(WOFF2_COMPRESSED_SIZE_OFFSET)),
  );
  let start = 0;
  for (const table of tables) {
    if (table.tag === CMAP_TAG) return data.subarray(start, start + table.length);
    start += table.length;
  }
  throw new Error('the font file has no cmap table');
}

function segmentCodePoints(cmap: Buffer, subtable: number, codePoints: Set<number>): void {
  const arrayBytes = cmap.readUInt16BE(subtable + SEGMENT_COUNT_OFFSET);
  const ends = subtable + SEGMENT_ARRAYS_OFFSET;
  const starts = ends + arrayBytes + SEGMENT_PAD_BYTES;
  const deltas = starts + arrayBytes;
  const rangeOffsets = deltas + arrayBytes;
  for (let segment = 0; segment < arrayBytes; segment += SEGMENT_ENTRY_BYTES) {
    const end = cmap.readUInt16BE(ends + segment);
    const start = cmap.readUInt16BE(starts + segment);
    const delta = cmap.readUInt16BE(deltas + segment);
    const rangeOffset = cmap.readUInt16BE(rangeOffsets + segment);
    for (let codePoint = start; codePoint <= end && codePoint < SEGMENT_SENTINEL; codePoint += 1) {
      const glyph =
        rangeOffset === 0
          ? (codePoint + delta) & GLYPH_INDEX_MASK
          : cmap.readUInt16BE(
              rangeOffsets + segment + rangeOffset + (codePoint - start) * SEGMENT_ENTRY_BYTES,
            );
      if (glyph !== MISSING_GLYPH) codePoints.add(codePoint);
    }
  }
}

function coveredCodePoints(font: Buffer): Set<number> {
  const cmap = cmapTable(font);
  const codePoints = new Set<number>();
  for (let record = 0; record < cmap.readUInt16BE(CMAP_SUBTABLE_COUNT_OFFSET); record += 1) {
    const subtable = cmap.readUInt32BE(
      CMAP_RECORDS_OFFSET + record * CMAP_RECORD_BYTES + CMAP_RECORD_SUBTABLE_OFFSET,
    );
    if (cmap.readUInt16BE(subtable) === SEGMENT_FORMAT) {
      segmentCodePoints(cmap, subtable, codePoints);
    }
  }
  return codePoints;
}

const textFaces = (): Face[] =>
  TEXT_FACES.map((name) => ({
    name,
    codePoints: coveredCodePoints(readFileSync(path.join(FONT_DIR, name))),
  }));

function stringLiterals(file: string, source: string): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteralLike(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddleOrTemplateTail(node)
    ) {
      found.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(file, source, ts.ScriptTarget.Latest));
  return found;
}

const unescapeCss = (token: string): string =>
  token
    .slice(1, -1)
    .replace(CSS_ESCAPE, (_, hex: string | undefined, literal: string | undefined) =>
      hex === undefined ? (literal ?? '') : String.fromCodePoint(Number.parseInt(hex, HEX_RADIX)),
    );

function generatedText(stylesheet: string): string[] {
  const css = stylesheet.replace(CSS_COMMENT, '');
  const properties = new Map<string, string[]>();
  for (const [, name = '', value = ''] of css.matchAll(CUSTOM_PROPERTY)) {
    properties.set(name, [...(properties.get(name) ?? []), value]);
  }
  const strings = (value: string, seen: ReadonlySet<string>): string[] => [
    ...[...value.matchAll(STRING_TOKEN)].map(([token]) => unescapeCss(token)),
    ...[...value.matchAll(VAR_REFERENCE)].flatMap(([, name = '']) =>
      seen.has(name)
        ? []
        : (properties.get(name) ?? []).flatMap((inner) => strings(inner, new Set([...seen, name]))),
    ),
  ];
  return [...css.matchAll(CONTENT_DECLARATION)].flatMap(([, value = '']) =>
    strings(value, new Set()),
  );
}

function uncoveredGlyphs(texts: readonly Text[], faces: readonly Face[]): string[] {
  const usedIn = new Map<number, Set<string>>();
  for (const { source, text } of texts) {
    for (const glyph of text) {
      if (DRAWS_NO_GLYPH.test(glyph)) continue;
      const codePoint = glyph.codePointAt(0) ?? 0;
      usedIn.set(codePoint, (usedIn.get(codePoint) ?? new Set()).add(source));
    }
  }
  return [...usedIn.entries()]
    .sort(([left], [right]) => left - right)
    .flatMap(([codePoint, sources]) => {
      const lacking = faces.filter((face) => !face.codePoints.has(codePoint));
      if (lacking.length === 0) return [];
      const name = codePoint.toString(HEX_RADIX).toUpperCase().padStart(CODE_POINT_DIGITS, '0');
      const faceNames = lacking.map((face) => face.name).join(', ');
      return [
        `U+${name} ${String.fromCodePoint(codePoint)} is not in ${faceNames}; used in ${[...sources].sort().join(', ')}`,
      ];
    });
}

const filesOf = (directory: string, pattern: RegExp): string[] =>
  readdirSync(directory)
    .filter((name) => pattern.test(name))
    .map((name) => path.join(directory, name));

const FALLBACK_CONSEQUENCE =
  'a glyph the self-hosted face lacks is drawn by whatever font the visitor has, so its width ' +
  'and shape change per machine (one em in WenQuanYi Zen Hei Mono, 0.6 em in DejaVu Sans Mono) ' +
  'and the layout moves with it. Add the glyph to every face in TEXT_FACES or use one they hold.';

describe('the checks that read the faces and the stylesheets', () => {
  it('reports a glyph the faces lack and accepts the ones they hold', () => {
    const texts = [{ source: 'probe', text: 'Az09 é \n​漢' }];
    expect(uncoveredGlyphs(texts, textFaces())).toEqual([
      `U+6F22 漢 is not in ${TEXT_FACES.join(', ')}; used in probe`,
    ]);
  });

  it('reads the strings a content declaration generates, through escapes and custom properties', () => {
    const stylesheet = [
      ':root { --glyph: "\\b7"; --loop: var(--loop); }',
      '.a::before { content: "\\2500\\25b6 ;}" / ""; justify-content: "no"; }',
      ".b::after { content: var(--glyph) '\\'' var(--loop) attr(data-x); }",
      '/* content: "comment"; */',
    ].join('\n');
    expect(generatedText(stylesheet)).toEqual(['─▶;}', '', "'", '·']);
  });

  it('reads every string literal and template part of a module, with escapes decoded', () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the string is module source under test and the placeholder belongs to the template literal it holds
    const source = 'const a = "\\u2192"; const b = `x${a}\\u2713`; // 漢';
    expect(stringLiterals('probe.ts', source)).toEqual(['→', 'x', '✓']);
  });
});

describe('the self-hosted text faces draw every glyph the site writes', () => {
  it('covers the copy in content/*.ts', () => {
    const texts = filesOf(CONTENT_DIR, COPY_FILE).flatMap((file) => {
      // behavioral-test-allow: the copy is the input under test; a glyph inside a string a function builds has no exported value to walk
      const source = readFileSync(file, 'utf8');
      return stringLiterals(file, source).map((text) => ({
        source: path.relative(REPO_ROOT, file),
        text,
      }));
    });
    const uncovered = uncoveredGlyphs(texts, textFaces());
    expect(texts, 'the scan must reach the copy').not.toEqual([]);
    expect(uncovered, `${FALLBACK_CONSEQUENCE}\n${uncovered.join('\n')}`).toEqual([]);
  });

  it('covers the text CSS content values generate', () => {
    const texts = filesOf(CSS_DIR, STYLESHEET).flatMap((file) =>
      // behavioral-test-allow: generated content exists only in the stylesheet; the browser guard in tests/e2e/glyph-coverage.spec.ts sees it rendered, this names the declaration
      generatedText(readFileSync(file, 'utf8')).map((text) => ({
        source: path.relative(REPO_ROOT, file),
        text,
      })),
    );
    const uncovered = uncoveredGlyphs(texts, textFaces());
    expect(texts, 'the scan must reach the generated content').not.toEqual([]);
    expect(uncovered, `${FALLBACK_CONSEQUENCE}\n${uncovered.join('\n')}`).toEqual([]);
  });
});
