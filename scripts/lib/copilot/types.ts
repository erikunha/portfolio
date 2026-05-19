// Manifest types (what the user edits in copilot-port.config.ts)

export type ApplyToEntry = {
  name: string;
  applyTo: string;
  /** Pull body from a skill (mutually exclusive with `body`) */
  sourceSkill?: string;
  /** Inline body (mutually exclusive with `sourceSkill`) */
  body?: string;
};

export type CopilotPortConfig = {
  instructions: {
    projectClaudeMd: string; // repo-relative path
    globalClaudeMd: string; // absolute path (may include ~)
    applyTo: ApplyToEntry[];
  };
  skills: string[]; // bare or plugin-prefixed names
  agents: string[]; // agent names from ~/.claude/agents/
  mcp: string[]; // MCP server names to whitelist
};

// Source types (what sources.ts produces by scanning ~/.claude/)

export type SourceKind = 'skill' | 'agent';

export type SkillSource = {
  kind: 'skill';
  name: string; // bare name (e.g., 'brainstorming')
  qualifiedName: string; // with plugin prefix (e.g., 'superpowers:brainstorming')
  path: string; // absolute path to SKILL.md or skill markdown
  frontmatter: Record<string, unknown>;
  body: string;
  origin: 'personal' | 'plugin';
  plugin?: string; // plugin name if origin === 'plugin'
};

export type AgentSource = {
  kind: 'agent';
  name: string;
  path: string;
  frontmatter: Record<string, unknown>;
  body: string;
};

export type McpServerSource = {
  name: string; // server name as it appears in source file
  path: string; // absolute path to .mcp.json
  config: Record<string, unknown>; // the server's config object
  origin: 'personal' | 'plugin';
  plugin?: string;
};

export type SourceIndex = {
  skills: Map<string, SkillSource>; // keyed by bare name
  agents: Map<string, AgentSource>;
  mcpServers: Map<string, McpServerSource>;
};

// Output types (what translators produce)

export type TranslatorOutput = {
  path: string; // repo-relative output path
  content: string;
};

// Pass 1 / Pass 2 reference resolution
export type PortedNames = Map<string, SourceKind>;
