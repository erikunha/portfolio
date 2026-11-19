import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AGENT_MANIFEST_PATH,
  buildDiscoverySource,
  findStaleDiscoveryFiles,
  LLMS_TXT_PATH,
  renderAgentManifest,
  renderLlmsTxt,
} from '../codegen/generate-discovery-files';

const ROOT = join(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

describe('discovery files generator', () => {
  it('renders llms.txt byte-identical to the committed file', () => {
    expect(renderLlmsTxt(buildDiscoverySource()), 'run `pnpm generate:discovery`').toBe(
      read(LLMS_TXT_PATH),
    );
  });

  it('renders agent.json byte-identical to the committed file', () => {
    expect(renderAgentManifest(buildDiscoverySource()), 'run `pnpm generate:discovery`').toBe(
      read(AGENT_MANIFEST_PATH),
    );
  });

  it('reports no stale file when the committed files are the generator output', () => {
    expect(findStaleDiscoveryFiles(read)).toEqual([]);
  });

  it('reports each committed file that no longer equals the generator output', () => {
    const drifted = (path: string) => `${read(path)} `;
    expect(findStaleDiscoveryFiles(drifted)).toEqual([LLMS_TXT_PATH, AGENT_MANIFEST_PATH]);
  });

  it('reports only the file that drifted', () => {
    const drifted = (path: string) => (path === LLMS_TXT_PATH ? `x${read(path)}` : read(path));
    expect(findStaleDiscoveryFiles(drifted)).toEqual([LLMS_TXT_PATH]);
  });

  it('ends both files with exactly one newline', () => {
    const source = buildDiscoverySource();
    expect(renderLlmsTxt(source)).toMatch(/[^\n]\n$/);
    expect(renderAgentManifest(source)).toMatch(/[^\n]\n$/);
  });
});

describe('discovery files follow content', () => {
  const source = buildDiscoverySource();

  it('carries the title, contact, phone and open roles of the source', () => {
    const text = renderLlmsTxt(source);
    expect(text).toContain(`# ${source.displayName} · ${source.title}`);
    expect(text).toContain(`- Contact: ${source.email} | ${source.phone}`);
    expect(text).toContain(`- Open to roles: ${source.openRoles}`);
    expect(text).toContain(`(${source.linkedinUrl})`);
  });

  it('changes the output when a derived fact changes', () => {
    const changed = renderLlmsTxt({ ...source, title: 'Staff Engineer' });
    expect(changed).toContain('# Erik Cunha · Staff Engineer');
    expect(changed).not.toBe(renderLlmsTxt(source));
  });

  it('lists every employer of the career log in the experience table', () => {
    const text = renderLlmsTxt(source);
    expect(source.experience.length).toBeGreaterThan(0);
    for (const row of source.experience) {
      expect(text).toContain(`| ${row.period} | `);
      expect(text).toContain(row.role);
    }
    const trimmed = renderLlmsTxt({ ...source, experience: source.experience.slice(1) });
    expect(trimmed.split('\n').filter((line) => line.startsWith('| ')).length).toBe(
      source.experience.length,
    );
  });

  it('lists every education entry, language and the community event', () => {
    const text = renderLlmsTxt(source);
    for (const entry of source.education) expect(text).toContain(entry);
    for (const entry of source.languages) expect(text).toContain(entry);
    expect(text).toContain(source.community.linkUrl);
    expect(text).toContain(source.community.statusLine);
  });

  it('derives the manifest identity and endpoint urls from the source', () => {
    const manifest = JSON.parse(renderAgentManifest(source)) as {
      name: string;
      url: string;
      provider: { name: string; contact: string };
      title: string;
      endpoints: { url: string }[];
      profiles: { url: string }[];
    };
    expect(manifest.name).toContain(source.displayName);
    expect(manifest.url).toBe(source.siteUrl);
    expect(manifest.provider).toEqual({
      name: source.fullName,
      url: source.siteUrl,
      contact: source.email,
    });
    expect(manifest.title).toBe(source.title);
    for (const endpoint of [...manifest.endpoints, ...manifest.profiles]) {
      expect(endpoint.url.startsWith(source.siteUrl)).toBe(true);
    }
    const moved = JSON.parse(
      renderAgentManifest({ ...source, siteUrl: 'https://example.test' }),
    ) as typeof manifest;
    expect(moved.endpoints[0]?.url.startsWith('https://example.test/')).toBe(true);
  });
});
