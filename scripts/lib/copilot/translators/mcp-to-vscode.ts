import type { McpServerSource, TranslatorOutput } from '../types';

type VscodeInput = {
  type: 'promptString';
  id: string;
  description: string;
  password: boolean;
};

type VscodeServer = {
  type: 'stdio' | 'http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
};

const SECRET_TOKEN_RE = /\$\{([A-Z_][A-Z0-9_]*)\}/g;

function rewriteSecretsInString(s: string, collected: Set<string>): string {
  return s.replace(SECRET_TOKEN_RE, (_, name) => {
    collected.add(name);
    return `\${input:${name}}`;
  });
}

function rewriteSecretsInMap(
  obj: Record<string, unknown> | undefined,
  collected: Set<string>,
): Record<string, string> | undefined {
  if (!obj) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === 'string' ? rewriteSecretsInString(v, collected) : String(v);
  }
  return out;
}

function rewriteSecretsInArray(
  arr: unknown[] | undefined,
  collected: Set<string>,
): string[] | undefined {
  if (!arr) return undefined;
  return arr.map((v) => (typeof v === 'string' ? rewriteSecretsInString(v, collected) : String(v)));
}

export function normalizeServer(src: McpServerSource): {
  server: VscodeServer;
  inputs: VscodeInput[];
} {
  const config = src.config;
  const hasCommand = typeof config.command === 'string';
  const hasUrl = typeof config.url === 'string';

  if (!hasCommand && !hasUrl) {
    throw new Error(`MCP server '${src.name}' has neither command nor url`);
  }

  const collected = new Set<string>();
  const server: VscodeServer = {
    type: hasUrl ? 'http' : 'stdio',
  };

  if (hasCommand) {
    server.command = config.command as string;
    const args = rewriteSecretsInArray(config.args as unknown[] | undefined, collected);
    if (args !== undefined) server.args = args;
    const env = rewriteSecretsInMap(config.env as Record<string, unknown> | undefined, collected);
    if (env !== undefined) server.env = env;
  }
  if (hasUrl) {
    server.url = rewriteSecretsInString(config.url as string, collected);
    const headers = rewriteSecretsInMap(
      config.headers as Record<string, unknown> | undefined,
      collected,
    );
    if (headers !== undefined) server.headers = headers;
  }

  const inputs: VscodeInput[] = [...collected].map((id) => ({
    type: 'promptString',
    id,
    description: `Value for ${id}`,
    password: true,
  }));

  return { server, inputs };
}

export function mcpToVscode(sources: McpServerSource[]): TranslatorOutput {
  const inputsById = new Map<string, VscodeInput>();
  const servers: Record<string, VscodeServer> = {};

  for (const src of sources) {
    const { server, inputs } = normalizeServer(src);
    servers[src.name] = server;
    for (const input of inputs) {
      if (!inputsById.has(input.id)) inputsById.set(input.id, input);
    }
  }

  const output = {
    inputs: [...inputsById.values()],
    servers,
  };

  return {
    path: '.vscode/mcp.json',
    content: `${JSON.stringify(output, null, 2)}\n`,
  };
}
