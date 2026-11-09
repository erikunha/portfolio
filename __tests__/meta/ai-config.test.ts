import { execFileSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { basename, join } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import limits from '../../scripts/harness-size.json';

const SUBPROCESS_TEST_TIMEOUT_MS = 60_000;

const ROOT = process.cwd();
const SELF = '__tests__/meta/ai-config.test.ts';
const HISTORY_FILES = new Set(['DECISIONS.md', 'pnpm-lock.yaml']);
const SKILLS_CANONICAL = '.agents/skills';
const SKILLS_CLAUDE = '.claude/skills';
const AGENTS_DIR = '.claude/agents';
const COMMANDS_DIR = '.claude/commands';
const RULES_DIR = '.claude/rules';
const LOCAL_SKILL_PREFIX = 'speckit-';
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SKILL_NAME_MAX = 64;
const SKILL_DESCRIPTION_MAX = 1024;
const SYMLINK_MODE = '120000';
const AGENTS_MD_MAX_BYTES = 32 * 1024;
const SPEC_FRONTMATTER_KEYS = new Set([
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'allowed-tools',
]);
const CLAUDE_ONLY_FRONTMATTER_KEYS = new Set(['disable-model-invocation']);
const REQUIRED_DENY_RULES = [
  'Bash(git add .:*)',
  'Bash(git add -A:*)',
  'Bash(git add --all:*)',
  'Read(./.env)',
];
const OWNED_AI_PATHS = [
  '/AGENTS.md',
  '/CLAUDE.md',
  '/REVIEW.md',
  '/.claude/',
  '/.agents/',
  '/.codex/',
];

const HARNESS_TERMS =
  /claude-skills|cross-runtime|model-delegate|routing-(?:reviewer|validator|challenger|implementer|tdd|architect)|ROUTING-CONTRACT|hindsight|ai-dev-runtime|\/Users\/|~\/Desktop|MiMo/i;

const RETIRED_NAMES = [
  'humanizer',
  'thinking-risk-premortem',
  'react-best-practices',
  'web-design-guidelines',
  'vercel:nextjs',
  'security-auditor',
  'ui-ux-tester',
  'ai-engineer',
  'architect-reviewer',
  'dx-optimizer',
  'nextjs-developer',
  'performance-engineer',
  'seo-specialist',
  'test-automator',
];

const tracked = (): string[] => {
  const out = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  return out
    .split('\0')
    .filter((file) => file !== '')
    .filter((file) => existsSync(join(ROOT, file)))
    .filter((file) => !lstatSync(join(ROOT, file)).isSymbolicLink());
};

const readText = (file: string): string | null => {
  const buffer = readFileSync(join(ROOT, file));
  return buffer.includes(0) ? null : buffer.toString('utf8');
};

const listDir = (dir: string): string[] =>
  existsSync(join(ROOT, dir)) ? readdirSync(join(ROOT, dir)).sort() : [];

const canonicalSkills = (): string[] =>
  listDir(SKILLS_CANONICAL).filter((name) =>
    existsSync(join(ROOT, SKILLS_CANONICAL, name, 'SKILL.md')),
  );

const legacySkills = (): string[] =>
  listDir(SKILLS_CLAUDE).filter(
    (name) =>
      !name.startsWith(LOCAL_SKILL_PREFIX) &&
      existsSync(join(ROOT, SKILLS_CLAUDE, name, 'SKILL.md')),
  );

const skillNames = (): string[] => [...new Set([...canonicalSkills(), ...legacySkills()])];

const agentNames = (): string[] =>
  listDir(AGENTS_DIR)
    .filter((file) => file.endsWith('.md'))
    .map((file) => basename(file, '.md'));

const commandNames = (): string[] =>
  listDir(COMMANDS_DIR)
    .filter((file) => file.endsWith('.md'))
    .map((file) => basename(file, '.md'));

const escapeRegExp = (value: string) => value.replace(/[$\\^*+?.()|[\]{}]/g, '\\$&');

const namesToken = (name: string): RegExp =>
  new RegExp(`(?<![\\w:./-])${escapeRegExp(name)}(?![\\w/-]|\\.\\w)`);

const ownerOf = (file: string): string | null => {
  const skill = file.match(/^\.(?:agents|claude)\/skills\/([^/]+)\//);
  if (skill) return skill[1] ?? null;
  const agent = file.match(/^\.claude\/agents\/([^/]+)\.md$/);
  if (agent) return agent[1] ?? null;
  const command = file.match(/^\.claude\/commands\/([^/]+)\.md$/);
  return command ? (command[1] ?? null) : null;
};

describe('AI configuration guard', { timeout: SUBPROCESS_TEST_TIMEOUT_MS }, () => {
  it('names no harness, provider-routing or local-machine term in any tracked file', () => {
    const offenders = tracked()
      .filter((file) => file !== SELF && !HISTORY_FILES.has(file))
      .flatMap((file) => {
        const text = readText(file);
        if (text === null) return [];
        const hit = text.match(HARNESS_TERMS);
        return hit ? [`${file}: ${hit[0]}`] : [];
      });
    expect(
      offenders,
      'Repo files describe the repo. Orchestration tooling and personal paths live in the owner config; rewrite the line as a plain engineering rule.',
    ).toEqual([]);
  });

  it('keeps retired skill and agent names out of every tracked file', () => {
    const offenders = tracked()
      .filter((file) => file !== SELF && !HISTORY_FILES.has(file))
      .flatMap((file) => {
        const text = readText(file);
        if (text === null) return [];
        return RETIRED_NAMES.filter((name) => namesToken(name).test(text)).map(
          (name) => `${file}: ${name}`,
        );
      });
    expect(
      offenders,
      'These names resolve to nothing in this repository. An instruction naming them fails silently.',
    ).toEqual([]);
  });

  it('lets no file under .agents or .claude name another skill, agent, command or a config path', () => {
    const names = [...skillNames(), ...agentNames(), ...commandNames()];
    const offenders = tracked()
      .filter((file) => file.startsWith('.agents/') || file.startsWith('.claude/'))
      .flatMap((file) => {
        const text = readText(file);
        if (text === null) return [];
        const owner = ownerOf(file);
        const foundNames = names
          .filter((name) => name !== owner && namesToken(name).test(text))
          .map((name) => `${file}: names "${name}"`);
        const foundPaths = /(?:^|[^\w])\.(?:claude|agents)\//.test(text)
          ? [`${file}: names a .claude or .agents path`]
          : [];
        return [...foundNames, ...foundPaths];
      });
    expect(
      offenders,
      'Each skill, agent, command and rule must work alone: a reference breaks the moment the other file is renamed, absent or loaded by another tool.',
    ).toEqual([]);
  });

  it('names only skills, agents and commands that exist in AGENTS.md, CLAUDE.md, rules and settings', () => {
    const known = new Set([...skillNames(), ...agentNames(), ...commandNames()]);
    const sources = [
      'AGENTS.md',
      'CLAUDE.md',
      '.claude/settings.json',
      ...listDir(RULES_DIR)
        .filter((file) => file.endsWith('.md'))
        .map((file) => `${RULES_DIR}/${file}`),
    ].filter((file) => existsSync(join(ROOT, file)));
    const patterns = [
      /`([a-z0-9][a-z0-9:-]*)`\s+(?:skill|agent|subagent|command)\b/gi,
      /\b(?:skill|agent|subagent|command)\s+`([a-z0-9][a-z0-9:-]*)`/gi,
      /Skill\(([^)]+)\)/g,
      /\.(?:claude|agents)\/(?:skills|agents|commands)\/([\w-]+)/g,
    ];
    const missing = sources.flatMap((file) => {
      const text = readText(file) ?? '';
      return patterns.flatMap((pattern) =>
        [...text.matchAll(pattern)]
          .map((match) => match[1] ?? '')
          .filter((name) => name !== '' && !known.has(name) && !name.startsWith(LOCAL_SKILL_PREFIX))
          .map((name) => `${file}: ${name}`),
      );
    });
    expect(missing, 'A named skill, agent or command must exist in this repository.').toEqual([]);
  });

  it('keeps skill frontmatter inside the Agent Skills specification', () => {
    const skills = canonicalSkills();
    expect(skills.length, 'no canonical skills found under .agents/skills').toBeGreaterThan(0);
    const problems = skills.flatMap((skill) => {
      const text = readFileSync(join(ROOT, SKILLS_CANONICAL, skill, 'SKILL.md'), 'utf8');
      const match = text.match(/^---\n([\s\S]*?)\n---\n/);
      if (!match) return [`${skill}: no frontmatter`];
      const data = parseYaml(match[1] ?? '') as Record<string, unknown> | null;
      const keys = Object.keys(data ?? {});
      const found: string[] = keys
        .filter((key) => !SPEC_FRONTMATTER_KEYS.has(key) && !CLAUDE_ONLY_FRONTMATTER_KEYS.has(key))
        .map((key) => `${skill}: key "${key}" is outside the specification`);
      if (data?.name !== skill) found.push(`${skill}: name must equal the directory`);
      if (!SKILL_NAME.test(skill) || skill.length > SKILL_NAME_MAX)
        found.push(`${skill}: invalid name`);
      const description = data?.description;
      if (typeof description !== 'string' || description.trim() === '')
        found.push(`${skill}: description missing`);
      else if (description.length > SKILL_DESCRIPTION_MAX)
        found.push(`${skill}: description over ${SKILL_DESCRIPTION_MAX} characters`);
      return found;
    });
    expect(problems).toEqual([]);
  });

  it('links every .claude skill to its canonical .agents skill', () => {
    const canonical = canonicalSkills();
    expect(canonical.length, 'no canonical skills found under .agents/skills').toBeGreaterThan(0);
    const staged = execFileSync('git', ['ls-files', '-s', '-z', SKILLS_CLAUDE], {
      cwd: ROOT,
      encoding: 'utf8',
    })
      .split('\0')
      .filter((row) => row !== '');
    const nonLinks = staged
      .filter((row) => !row.startsWith(SYMLINK_MODE) && !row.includes(`/${LOCAL_SKILL_PREFIX}`))
      .map((row) => row.split('\t')[1]);
    expect(nonLinks, 'tracked entries under .claude/skills must be symlinks').toEqual([]);

    const problems = canonical.flatMap((skill) => {
      const link = join(ROOT, SKILLS_CLAUDE, skill);
      if (!existsSync(link) && !lstatOrNull(link)) return [`${skill}: no .claude/skills link`];
      if (!lstatSync(link).isSymbolicLink()) return [`${skill}: not a symlink`];
      const target = readlinkSync(link);
      const expected = `../../${SKILLS_CANONICAL}/${skill}`;
      const found: string[] = target === expected ? [] : [`${skill}: points to ${target}`];
      const resolved = realpathSync(join(link, 'SKILL.md'));
      if (resolved !== realpathSync(join(ROOT, SKILLS_CANONICAL, skill, 'SKILL.md')))
        found.push(`${skill}: does not resolve to the canonical SKILL.md`);
      return found;
    });
    expect(problems).toEqual([]);

    const dangling = legacySkills().filter((skill) => !canonical.includes(skill));
    expect(dangling, 'a .claude skill without a canonical .agents skill').toEqual([]);
  });

  it('keeps the managed Next.js agent rules current so next dev leaves AGENTS.md untouched', () => {
    const requireNext = createRequire(join(ROOT, 'package.json'));
    const { hasCurrentAgentRules, hasCurrentAgentFeedback, AGENT_FEEDBACK_START_MARKER } =
      requireNext('next/dist/server/lib/generate-agent-files') as {
        hasCurrentAgentRules: (dir: string) => boolean;
        hasCurrentAgentFeedback: (dir: string) => boolean;
        AGENT_FEEDBACK_START_MARKER: string;
      };
    expect(
      hasCurrentAgentRules(ROOT),
      'The nextjs-agent-rules block in AGENTS.md no longer matches the installed Next.js, so next dev rewrites AGENTS.md. A Next upgrade changed the block: delete the old block (BEGIN:nextjs-agent-rules to END:nextjs-agent-rules) and run node -e "require(\'next/dist/server/lib/generate-agent-files\').writeAgentFiles(process.cwd())", then commit AGENTS.md.',
    ).toBe(true);
    expect(
      hasCurrentAgentFeedback(ROOT),
      'experimental.agentFeedback is false in next.config.ts, so next dev removes the feedback block: it must not be committed.',
    ).toBe(false);
    expect(readFileSync(join(ROOT, 'AGENTS.md'), 'utf8')).not.toContain(
      AGENT_FEEDBACK_START_MARKER,
    );
  });

  it('keeps AGENTS.md the single instruction source and CLAUDE.md a thin import', () => {
    const agents = readFileSync(join(ROOT, 'AGENTS.md'), 'utf8');
    const claude = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8');
    const agentLines = agents.split('\n').length;
    const claudeLines = claude.split('\n').length;
    expect(
      agentLines,
      `AGENTS.md is ${agentLines} lines; the budget is ${limits['AGENTS.md'].maxLines}`,
    ).toBeLessThanOrEqual(limits['AGENTS.md'].maxLines);
    expect(Buffer.byteLength(agents)).toBeLessThan(AGENTS_MD_MAX_BYTES);
    expect(
      claudeLines,
      `CLAUDE.md is ${claudeLines} lines; the budget is ${limits['CLAUDE.md'].maxLines}`,
    ).toBeLessThanOrEqual(limits['CLAUDE.md'].maxLines);
    expect(claude.split('\n').find((line) => line.trim() !== '')).toBe('@AGENTS.md');
  });

  it('commits no personal Claude Code files', () => {
    const personal = tracked().filter(
      (file) => file.startsWith('.claude/') && /\.local\./.test(basename(file)),
    );
    expect(
      personal,
      'personal files stay in the owner config or in gitignored .local files',
    ).toEqual([]);
  });

  it('turns the zero-exception rules into permission denials and registers no hook', () => {
    const settings = JSON.parse(readFileSync(join(ROOT, '.claude/settings.json'), 'utf8')) as {
      permissions?: { deny?: string[] };
      hooks?: unknown;
    };
    expect(settings.permissions?.deny ?? []).toEqual(expect.arrayContaining(REQUIRED_DENY_RULES));
    expect(
      settings.hooks,
      "A project hook runs a command on every contributor machine that uses this tool. Workflow hooks (merge guards, edit guards, end-of-turn checks) belong in each engineer's own config; the repository enforces its rules through git hooks and CI.",
    ).toBeUndefined();
  });

  it('keeps the Codex invocation policy in step with disable-model-invocation', () => {
    const problems = canonicalSkills().flatMap((skill) => {
      const text = readFileSync(join(ROOT, SKILLS_CANONICAL, skill, 'SKILL.md'), 'utf8');
      const frontmatter = parseYaml(text.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? '') as Record<
        string,
        unknown
      > | null;
      const manual = frontmatter?.['disable-model-invocation'] === true;
      const policyFile = join(ROOT, SKILLS_CANONICAL, skill, 'agents/openai.yaml');
      const policy = existsSync(policyFile)
        ? (parseYaml(readFileSync(policyFile, 'utf8')) as {
            policy?: { allow_implicit_invocation?: boolean };
          })
        : null;
      const codexManual = policy?.policy?.allow_implicit_invocation === false;
      return manual === codexManual ? [] : [`${skill}: Claude and Codex invocation policy differ`];
    });
    expect(problems).toEqual([]);
  });

  it('assigns code owners to the AI configuration and keeps REVIEW.md at the root', () => {
    expect(existsSync(join(ROOT, 'REVIEW.md')), 'REVIEW.md is missing').toBe(true);
    const owners = readFileSync(join(ROOT, '.github/CODEOWNERS'), 'utf8');
    const missing = OWNED_AI_PATHS.filter(
      (path) => !owners.split('\n').some((line) => line.startsWith(`${path} @`)),
    );
    expect(missing).toEqual([]);
  });

  it('mirrors the .mcp.json servers in .codex/config.toml', () => {
    const mcp = JSON.parse(readFileSync(join(ROOT, '.mcp.json'), 'utf8')) as {
      mcpServers: Record<string, { url?: string }>;
    };
    expect(existsSync(join(ROOT, '.codex/config.toml')), '.codex/config.toml is missing').toBe(
      true,
    );
    const codex = parseToml(readFileSync(join(ROOT, '.codex/config.toml'), 'utf8')) as {
      mcp_servers?: Record<string, { url?: string }>;
    };
    const mirrored = codex.mcp_servers ?? {};
    expect(Object.keys(mirrored).sort()).toEqual(Object.keys(mcp.mcpServers).sort());
    for (const [name, server] of Object.entries(mcp.mcpServers)) {
      expect(mirrored[name]?.url, `${name} url`).toBe(server.url);
    }
  });
});

function lstatOrNull(path: string) {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
}
