import { describe, expect, it } from 'vitest';
import { mapClaudeTools } from '@/scripts/lib/copilot/tool-map';

describe('mapClaudeTools', () => {
  it('maps known Claude tools to Copilot tool IDs', () => {
    const { mapped, dropped } = mapClaudeTools(['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob']);
    expect(mapped).toEqual([
      'read_file',
      'create_file',
      'replace_string_in_file',
      'run_in_terminal',
      'grep_search',
      'file_search',
    ]);
    expect(dropped).toEqual([]);
  });

  it('drops unmapped tools and reports them', () => {
    const { mapped, dropped } = mapClaudeTools(['Read', 'TaskCreate', 'Skill', 'ScheduleWakeup']);
    expect(mapped).toEqual(['read_file']);
    expect(dropped.sort()).toEqual(['ScheduleWakeup', 'Skill', 'TaskCreate']);
  });

  it('handles empty input', () => {
    expect(mapClaudeTools([])).toEqual({ mapped: [], dropped: [] });
  });
});
