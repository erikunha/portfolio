import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const PRIMITIVES_DIR = path.join(ROOT, 'app/(en)/design-system/primitives');
const PAGE_FILE = 'page.mdx';
const PROPS_HEADING = '<h2 id="props">Props</h2>';
const SOURCE_LINE = /^Source: `([^`]+)`/m;
const TABLE_ROW_NAME = /^\|\s*`([A-Za-z_$][\w$]*)`\s*\|/;
const TABLE_ROW = /^\|/;
const NODE_MODULES_SEGMENT = `${path.sep}node_modules${path.sep}`;
const TEST_TIMEOUT_MS = 60_000;
const FIXTURE_FILE = path.join(ROOT, '__fixture__/Widget.tsx');
const FIXTURE_SOURCE = `
export type WidgetProps = { label: string; tone?: 'a' | 'b'; onPick?: () => void };
`;

type PropKeys = { declared: Set<string>; all: Set<string> };

type Drift = { undocumented: string[]; unknown: string[] };

function loadCompilerOptions(): ts.CompilerOptions {
  const configPath = path.join(ROOT, 'tsconfig.json');
  const raw = ts.readConfigFile(configPath, ts.sys.readFile);
  return ts.parseJsonConfigFileContent(raw.config, ts.sys, ROOT).options;
}

function buildProgram(files: string[], virtual: Record<string, string> = {}): ts.Program {
  const options = loadCompilerOptions();
  const host = ts.createCompilerHost(options);
  const realGetSourceFile = host.getSourceFile.bind(host);
  const realFileExists = host.fileExists.bind(host);
  const realReadFile = host.readFile.bind(host);
  host.fileExists = (name) => name in virtual || realFileExists(name);
  host.readFile = (name) => virtual[name] ?? realReadFile(name);
  host.getSourceFile = (name, languageVersion, onError, shouldCreate) => {
    const text = virtual[name];
    return text === undefined
      ? realGetSourceFile(name, languageVersion, onError, shouldCreate)
      : ts.createSourceFile(name, text, languageVersion);
  };
  return ts.createProgram({ rootNames: files, options, host });
}

function isProjectDeclaration(declaration: ts.Declaration): boolean {
  const file = declaration.getSourceFile();
  return !file.fileName.includes(NODE_MODULES_SEGMENT) && !file.hasNoDefaultLib;
}

function findTypeSymbol(source: ts.SourceFile, checker: ts.TypeChecker, typeName: string) {
  for (const statement of source.statements) {
    if (
      (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) &&
      statement.name.text === typeName
    ) {
      return checker.getSymbolAtLocation(statement.name);
    }
  }
  return undefined;
}

function readPropKeys(program: ts.Program, file: string, typeName: string): PropKeys {
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(file);
  if (!source) throw new Error(`source not found: ${file}`);
  const symbol = findTypeSymbol(source, checker, typeName);
  if (!symbol) throw new Error(`${typeName} not declared in ${file}`);
  const type = checker.getDeclaredTypeOfSymbol(symbol);
  const members = type.isUnion() ? type.types : [type];
  const keys: PropKeys = { declared: new Set(), all: new Set() };
  for (const member of members) {
    for (const property of checker.getPropertiesOfType(member)) {
      keys.all.add(property.name);
      if (property.declarations?.some(isProjectDeclaration)) keys.declared.add(property.name);
    }
  }
  return keys;
}

function readDocumentedProps(mdx: string): string[] {
  const start = mdx.indexOf(PROPS_HEADING);
  if (start < 0) throw new Error('props heading missing');
  const lines = mdx.slice(start + PROPS_HEADING.length).split('\n');
  const names: string[] = [];
  let inTable = false;
  for (const line of lines) {
    if (TABLE_ROW.test(line)) {
      inTable = true;
      const name = TABLE_ROW_NAME.exec(line)?.[1];
      if (name) names.push(name);
    } else if (inTable) {
      break;
    }
  }
  return names;
}

function diffProps(documented: string[], keys: PropKeys): Drift {
  const documentedSet = new Set(documented);
  return {
    undocumented: [...keys.declared].filter((name) => !documentedSet.has(name)).sort(),
    unknown: documented.filter((name) => !keys.all.has(name)).sort(),
  };
}

function readPage(dir: string): { source: string; typeName: string; documented: string[] } {
  // behavioral-test-allow: the property under test is that a docs page states the props its source type declares; the page is MDX with no runtime surface
  const mdx = readFileSync(path.join(PRIMITIVES_DIR, dir, PAGE_FILE), 'utf8');
  const sourcePath = SOURCE_LINE.exec(mdx)?.[1];
  if (!sourcePath) throw new Error(`${dir}: no Source line`);
  const component = path.basename(sourcePath).split('.')[0];
  return {
    source: path.join(ROOT, sourcePath),
    typeName: `${component}Props`,
    documented: readDocumentedProps(mdx),
  };
}

describe('design-system prop tables', () => {
  const fixtureProgram = buildProgram([FIXTURE_FILE], { [FIXTURE_FILE]: FIXTURE_SOURCE });
  const fixtureKeys = readPropKeys(fixtureProgram, FIXTURE_FILE, 'WidgetProps');

  it('reads the declared keys of a props type with the compiler API', () => {
    expect([...fixtureKeys.declared].sort()).toEqual(['label', 'onPick', 'tone']);
  });

  it('accepts a table that matches the type', () => {
    expect(diffProps(['label', 'tone', 'onPick'], fixtureKeys)).toEqual({
      undocumented: [],
      unknown: [],
    });
  });

  it('reports a prop missing from the table', () => {
    expect(diffProps(['label', 'tone'], fixtureKeys).undocumented).toEqual(['onPick']);
  });

  it('reports a documented prop the type does not have', () => {
    expect(diffProps(['label', 'tone', 'onPick', 'size'], fixtureKeys).unknown).toEqual(['size']);
  });

  it('reads prop names from the props table only', () => {
    const mdx = `${PROPS_HEADING}\n\n| Prop | Type |\n|---|---|\n| \`label\` | \`string\` |\n\n| State | Label |\n|---|---|\n| \`idle\` | \`COPY\` |\n`;
    expect(readDocumentedProps(mdx)).toEqual(['label']);
  });

  const pages = readdirSync(PRIMITIVES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readPage(entry.name));
  const program = buildProgram(pages.map((page) => page.source));

  it.each(pages.map((page) => [page.typeName, page] as const))(
    '%s documents the props its type declares',
    (_name, page) => {
      const keys = readPropKeys(program, page.source, page.typeName);
      expect(diffProps(page.documented, keys)).toEqual({ undocumented: [], unknown: [] });
    },
    TEST_TIMEOUT_MS,
  );
});
