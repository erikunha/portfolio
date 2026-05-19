import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mcpToVscode, normalizeServer } from '@/scripts/lib/copilot/translators/mcp-to-vscode';
import type { McpServerSource } from '@/scripts/lib/copilot/types';

const FIXTURES = path.resolve(__dirname, 'fixtures/mcp');

function loadVariant(filename: string, serverName: string): McpServerSource {
  const raw = JSON.parse(readFileSync(path.join(FIXTURES, filename), 'utf8'));
  const servers = raw.mcpServers ?? raw;
  return {
    name: serverName,
    path: path.join(FIXTURES, filename),
    config: servers[serverName],
    origin: 'plugin',
    plugin: 'test',
  };
}

describe('normalizeServer (per source variant)', () => {
  it('A: bare wrapper, stdio, no env', () => {
    const src = loadVariant('variant-a-bare.json', 'context7');
    const { server, inputs } = normalizeServer(src);
    expect(server.type).toBe('stdio');
    expect(server.command).toBe('npx');
    expect(server.args).toEqual(['-y', '@upstash/context7-mcp']);
    expect(inputs).toEqual([]);
  });

  it('B: wrapped stdio, no env', () => {
    const src = loadVariant('variant-b-stdio-no-env.json', 'chrome-devtools');
    const { server, inputs } = normalizeServer(src);
    expect(server.type).toBe('stdio');
    expect(server.command).toBe('npx');
    expect(inputs).toEqual([]);
  });

  it('C: stdio with env secrets — rewrites ${SECRET} to ${input:SECRET}', () => {
    const src = loadVariant('variant-c-stdio-env-secrets.json', 'some-server');
    const { server, inputs } = normalizeServer(src);
    expect(server.type).toBe('stdio');
    expect((server.env as Record<string, string>).API_KEY).toBe('${input:SOME_API_KEY}');
    expect((server.env as Record<string, string>).REGION).toBe('us-east-1');
    expect(inputs).toContainEqual({
      type: 'promptString',
      id: 'SOME_API_KEY',
      description: 'Value for SOME_API_KEY',
      password: true,
    });
  });

  it('D: http with headers secrets — rewrites Bearer ${X}', () => {
    const src = loadVariant('variant-d-http-headers-secrets.json', 'postman');
    const { server, inputs } = normalizeServer(src);
    expect(server.type).toBe('http');
    expect(server.url).toBe('https://mcp.postman.com/mcp');
    expect((server.headers as Record<string, string>).Authorization).toBe(
      'Bearer ${input:POSTMAN_API_KEY}',
    );
    expect((server.headers as Record<string, string>)['X-Source']).toBe('claude-code-plugin');
    expect(inputs.some((i) => i.id === 'POSTMAN_API_KEY')).toBe(true);
  });

  it('E: http OAuth — no inputs, strips note field', () => {
    const src = loadVariant('variant-e-http-oauth.json', 'vercel');
    const { server, inputs } = normalizeServer(src);
    expect(server.type).toBe('http');
    expect(server.url).toBe('https://mcp.vercel.com');
    expect('note' in server).toBe(false);
    expect(inputs).toEqual([]);
  });

  it('mixed: rewrites secrets across env, args, url, headers', () => {
    const src = loadVariant('mixed.json', 'weird-server');
    const { server, inputs } = normalizeServer(src);
    expect((server.env as Record<string, string>).DEBUG_KEY).toBe('${input:DEBUG_VAL}');
    expect((server.args as string[]).join(' ')).toContain('${input:WEIRD_TOKEN}');
    expect(server.url).toBe('https://weird.example/${input:WEIRD_PATH}');
    expect((server.headers as Record<string, string>)['X-Auth']).toBe(
      'Bearer ${input:ANOTHER_KEY}',
    );
    const ids = inputs.map((i) => i.id).sort();
    expect(ids).toEqual(['ANOTHER_KEY', 'DEBUG_VAL', 'WEIRD_PATH', 'WEIRD_TOKEN']);
  });

  it('hard-fails when neither command nor url is present', () => {
    const src: McpServerSource = {
      name: 'broken',
      path: 'fake',
      config: { args: ['x'] },
      origin: 'personal',
    };
    expect(() => normalizeServer(src)).toThrow(/neither command nor url/);
  });
});

describe('mcpToVscode (whole-file output)', () => {
  it('writes to .vscode/mcp.json with inputs and servers keys', () => {
    const sources: McpServerSource[] = [
      loadVariant('variant-a-bare.json', 'context7'),
      loadVariant('variant-d-http-headers-secrets.json', 'postman'),
    ];
    const out = mcpToVscode(sources);
    expect(out.path).toBe('.vscode/mcp.json');
    const parsed = JSON.parse(out.content);
    expect(parsed.servers.context7).toBeDefined();
    expect(parsed.servers.postman).toBeDefined();
    expect(parsed.inputs.some((i: { id: string }) => i.id === 'POSTMAN_API_KEY')).toBe(true);
  });

  it('produces an empty inputs array when no secrets exist', () => {
    const out = mcpToVscode([loadVariant('variant-a-bare.json', 'context7')]);
    const parsed = JSON.parse(out.content);
    expect(parsed.inputs).toEqual([]);
  });

  it('deduplicates inputs across servers', () => {
    const a = loadVariant('variant-d-http-headers-secrets.json', 'postman');
    const b: McpServerSource = { ...a, name: 'postman-2' };
    const out = mcpToVscode([a, b]);
    const parsed = JSON.parse(out.content);
    const ids = parsed.inputs.map((i: { id: string }) => i.id);
    expect(ids.filter((id: string) => id === 'POSTMAN_API_KEY')).toHaveLength(1);
  });
});
