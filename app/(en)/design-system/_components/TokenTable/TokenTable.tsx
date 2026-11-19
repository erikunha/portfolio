import {
  aliasTarget,
  displayTokenValue,
  getThemeTokens,
  type ThemeToken,
  type ThemeTokenScope,
  tokensWithPrefix,
} from '../../_lib/theme-tokens';
import { LabelledTable } from '../LabelledTable';

const TOKEN_HEADER = 'Token';
const UTILITY_HEADER = 'Utility';
const VALUE_HEADER = 'Value';
const SIZE_HEADER = 'Size';
const USAGE_HEADER = 'Usage';
const ROLE_HEADER = 'Role';
const RESOLVES_HEADER = 'Resolves to';
const USE_HEADER = 'Use';
const STEP_HEADER = 'Step';
const MIN_WIDTH_HEADER = 'Min width';
const MAX_WIDTH_HEADER = 'Max width (below)';
const BELOW_HEADER_PREFIX = 'Below ';
const FROM_HEADER_PREFIX = 'From ';
const STEP_PLACEHOLDER = '{step}';
const COLOR_PREFIX = '--color-';
const VIEWPORT_PREFIX = 'viewport-';
const VIEWPORT_BELOW_PREFIX = 'viewport-below-';
const NO_VALUE = 'n/a';
const CUSTOM_PROPERTY_LEAD = /^--/;
const COLOR_ROLE_LEAD = /^color-/;

type Usage = Record<string, string>;

type Selection = {
  prefix?: string;
  names?: string[];
  exclude?: string[];
  scope?: ThemeTokenScope;
  sortByValue?: boolean;
};

function bare(name: string): string {
  return name.replace(CUSTOM_PROPERTY_LEAD, '');
}

function select(tokens: ThemeToken[], selection: Selection): ThemeToken[] {
  const { prefix, names, exclude = [], scope, sortByValue } = selection;
  const picked = names
    ? names.map((name) => tokens.find((token) => bare(token.name) === name && !token.minWidth))
    : tokensWithPrefix(tokens, prefix ?? '', scope);
  const found = picked.filter(
    (token): token is ThemeToken => token !== undefined && !exclude.includes(bare(token.name)),
  );
  if (names && found.length !== names.length) {
    const missing = names.filter((name) => !found.some((token) => bare(token.name) === name));
    throw new Error(`theme.css declares no token named ${missing.map((n) => `--${n}`).join(', ')}`);
  }
  return sortByValue ? [...found].sort((a, b) => Number(a.value) - Number(b.value)) : found;
}

type TableProps = { caption: string; headers: string[]; rows: (string | null)[][] };

function Table({ caption, headers, rows }: TableProps) {
  return (
    <LabelledTable caption={caption}>
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells) => (
          <tr key={cells[0]}>
            {cells.map((cell, index) => (
              <td key={headers[index]}>{index === 0 ? <code>{cell}</code> : (cell ?? '')}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </LabelledTable>
  );
}

type TokenTableProps = Selection & {
  caption: string;
  utility?: string;
  valueHeader?: string;
  usage?: Usage;
  source?: boolean;
};

export function TokenTable({
  caption,
  utility,
  valueHeader = VALUE_HEADER,
  usage,
  source,
  ...selection
}: TokenTableProps) {
  const tokens = getThemeTokens();
  const picked = select(tokens, selection);
  const stripped = `--${selection.prefix ?? ''}`;
  const headers = [
    TOKEN_HEADER,
    ...(utility ? [UTILITY_HEADER] : []),
    valueHeader,
    ...(source ? [SIZE_HEADER] : []),
    ...(usage ? [USAGE_HEADER] : []),
  ];
  const rows = picked.map((token) => {
    const step = token.name.startsWith(stripped)
      ? token.name.slice(stripped.length)
      : bare(token.name);
    const shown = displayTokenValue(token, tokens);
    return [
      token.name,
      ...(utility ? [utility.replace(STEP_PLACEHOLDER, step)] : []),
      source ? token.value : shown,
      ...(source ? [shown === token.value ? NO_VALUE : shown] : []),
      ...(usage ? [usage[bare(token.name)] ?? ''] : []),
    ];
  });
  return <Table caption={caption} headers={headers} rows={rows} />;
}

type RoleTableProps = { caption: string; names: string[]; usage: Usage };

export function RoleTable({ caption, names, usage }: RoleTableProps) {
  const tokens = getThemeTokens();
  const rows = select(tokens, { names: names.map((name) => `color-${name}`) }).map((token) => [
    bare(token.name).replace(COLOR_ROLE_LEAD, ''),
    aliasTarget(token, COLOR_PREFIX) ?? token.value,
    usage[bare(token.name).replace(COLOR_ROLE_LEAD, '')] ?? '',
  ]);
  return (
    <Table caption={caption} headers={[ROLE_HEADER, RESOLVES_HEADER, USE_HEADER]} rows={rows} />
  );
}

type ResponsiveTokenTableProps = {
  caption: string;
  names: string[];
  breakpoint: string;
  usage?: Usage;
};

export function ResponsiveTokenTable({
  caption,
  names,
  breakpoint,
  usage,
}: ResponsiveTokenTableProps) {
  const tokens = getThemeTokens();
  const rows = select(tokens, { names }).map((token) => {
    const wide = tokens.find((t) => t.name === token.name && t.minWidth === breakpoint);
    return [
      token.name,
      displayTokenValue(token, tokens),
      wide ? displayTokenValue(wide, tokens) : displayTokenValue(token, tokens),
      ...(usage ? [usage[bare(token.name)] ?? ''] : []),
    ];
  });
  return (
    <Table
      caption={caption}
      headers={[
        TOKEN_HEADER,
        `${BELOW_HEADER_PREFIX}${breakpoint}`,
        `${FROM_HEADER_PREFIX}${breakpoint}`,
        ...(usage ? [USAGE_HEADER] : []),
      ]}
      rows={rows}
    />
  );
}

export function ViewportTable({ caption, usage }: { caption: string; usage: Usage }) {
  const tokens = getThemeTokens();
  const steps = tokensWithPrefix(tokens, VIEWPORT_PREFIX).filter(
    (token) => !token.name.startsWith(`--${VIEWPORT_BELOW_PREFIX}`),
  );
  const rows = steps.map((token) => {
    const step = token.name.replace(`--${VIEWPORT_PREFIX}`, '');
    const below = tokens.find((t) => t.name === `--${VIEWPORT_BELOW_PREFIX}${step}`);
    return [token.name, token.value, below?.value ?? NO_VALUE, usage[step] ?? ''];
  });
  return (
    <Table
      caption={caption}
      headers={[STEP_HEADER, MIN_WIDTH_HEADER, MAX_WIDTH_HEADER, USAGE_HEADER]}
      rows={rows}
    />
  );
}
