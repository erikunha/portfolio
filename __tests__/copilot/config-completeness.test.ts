/**
 * Asserts that every agent/skill referenced in CLAUDE.md dispatch tables
 * is covered by copilot-port.config.ts — so the drift gate catches gaps
 * before they reach the generated artifacts.
 *
 * Update INTENTIONALLY_EXCLUDED_SKILLS if a skill is deliberately not ported
 * (add a comment explaining why).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { config } from '@/scripts/copilot-port.config';

const CLAUDE_MD = path.resolve(__dirname, '..', '..', 'CLAUDE.md');

/**
 * Return the text of CLAUDE.md strictly between two heading strings,
 * excluding both heading lines.
 */
function extractSection(source: string, startHeading: string, endHeading: string): string {
  const startIdx = source.indexOf(startHeading);
  const endIdx = source.indexOf(endHeading, startIdx + startHeading.length);
  if (startIdx === -1) throw new Error(`Section "${startHeading}" not found in CLAUDE.md`);
  if (endIdx === -1) throw new Error(`Section "${endHeading}" not found in CLAUDE.md`);
  return source.slice(startIdx + startHeading.length, endIdx);
}

/**
 * Parse the last `|`-delimited cell from every table data row in `section`,
 * returning all backtick-quoted names matching the agent/skill name pattern
 * (kebab-case with optional colon namespace prefix, no slashes or dots).
 */
function parseLastColumnNames(section: string): string[] {
  const names: string[] = [];
  for (const raw of section.split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('|')) continue;
    // Skip separator rows: |---|---|
    if (/^\|[\s|:-]+\|$/.test(line)) continue;
    const cells = line.split('|').filter((s) => s.trim());
    if (cells.length === 0) continue;
    const lastCell = cells.at(-1)?.trim() ?? '';
    // Match names like `architect-reviewer`, `superpowers:brainstorming`, `vercel:nextjs`
    for (const m of lastCell.matchAll(/`([a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)?)`/g)) {
      names.push(m[1] as string);
    }
  }
  return [...new Set(names)];
}

// ---------------------------------------------------------------------------
// Parse dispatch tables
// ---------------------------------------------------------------------------

const source = readFileSync(CLAUDE_MD, 'utf8');

const agentSection = extractSection(source, '## Project agent dispatch', '## Skill dispatch');
const skillSection = extractSection(source, '## Skill dispatch', '## Stack');

const dispatchAgents = parseLastColumnNames(agentSection);
const dispatchSkills = parseLastColumnNames(skillSection);

// ---------------------------------------------------------------------------
// Build covered sets
// ---------------------------------------------------------------------------

/** All skill identifiers considered "ported": standalone prompts + applyTo sources */
const coveredSkills = new Set<string>([
  ...config.skills,
  ...config.instructions.applyTo.flatMap((a) => (a.sourceSkill ? [a.sourceSkill] : [])),
]);

/**
 * Skills intentionally not ported as standalone Copilot artifacts.
 * Add an entry here (with a comment) instead of silencing the failure another way.
 *
 * vercel:nextjs — Vercel SDK plugin skill; coverage is provided by the
 *   nextjs-developer agent and the `vercel:vercel-functions` applyTo entry.
 *   No standalone SKILL.md is available via the generator for this name.
 */
const INTENTIONALLY_EXCLUDED_SKILLS = new Set<string>(['vercel:nextjs']);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('copilot config completeness', () => {
  it('every agent in the CLAUDE.md dispatch table is in config.agents', () => {
    const missing = dispatchAgents.filter((name) => !config.agents.includes(name));
    expect(
      missing,
      `Agents in CLAUDE.md dispatch table but absent from config.agents: [${missing.join(', ')}]. ` +
        'Add them to the agents array in scripts/copilot-port.config.ts and run pnpm sync:copilot.',
    ).toEqual([]);
  });

  it('every skill in the CLAUDE.md dispatch table is covered or explicitly excluded', () => {
    const missing = dispatchSkills.filter(
      (name) => !coveredSkills.has(name) && !INTENTIONALLY_EXCLUDED_SKILLS.has(name),
    );
    expect(
      missing,
      'Skills in CLAUDE.md dispatch table but not covered by config.skills, an applyTo sourceSkill, ' +
        `or INTENTIONALLY_EXCLUDED_SKILLS: [${missing.join(', ')}]. ` +
        'Add the skill to config.skills in scripts/copilot-port.config.ts and run pnpm sync:copilot, ' +
        'or add it to INTENTIONALLY_EXCLUDED_SKILLS with a comment explaining why.',
    ).toEqual([]);
  });

  it('INTENTIONALLY_EXCLUDED_SKILLS has no dead entries (each excluded skill must not be covered)', () => {
    for (const excluded of INTENTIONALLY_EXCLUDED_SKILLS) {
      expect(
        coveredSkills.has(excluded),
        `"${excluded}" is listed in INTENTIONALLY_EXCLUDED_SKILLS but is now also covered by ` +
          'config.skills or an applyTo sourceSkill — remove it from the exclusion set.',
      ).toBe(false);
    }
  });
});
