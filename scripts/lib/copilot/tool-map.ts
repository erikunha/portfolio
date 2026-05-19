const TOOL_MAP: Record<string, string> = {
  Read: 'read_file',
  Write: 'create_file',
  Edit: 'replace_string_in_file',
  Bash: 'run_in_terminal',
  Grep: 'grep_search',
  Glob: 'file_search',
  WebFetch: 'fetch_webpage',
  WebSearch: 'open_simple_browser',
};

export function mapClaudeTools(tools: string[]): { mapped: string[]; dropped: string[] } {
  const mapped: string[] = [];
  const dropped: string[] = [];
  for (const t of tools) {
    if (t in TOOL_MAP) mapped.push(TOOL_MAP[t]!);
    else dropped.push(t);
  }
  return { mapped, dropped };
}
