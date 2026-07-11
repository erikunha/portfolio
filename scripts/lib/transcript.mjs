import { readFileSync } from 'node:fs';

export function readTranscript(transcriptPath) {
  let raw;
  try {
    raw = readFileSync(transcriptPath, 'utf8');
  } catch {
    return [];
  }
  const records = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    try {
      records.push(JSON.parse(trimmed));
      // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op
    } catch {}
  }
  return records;
}

function toolUses(record) {
  const message = record?.message;
  if (!message || typeof message !== 'object') return [];
  const content = message.content;
  if (!Array.isArray(content)) return [];
  return content.filter((item) => item && typeof item === 'object' && item.type === 'tool_use');
}

export function lastUserCommitMarker(records) {
  let marker = -1;
  records.forEach((record, index) => {
    for (const tu of toolUses(record)) {
      const name = tu.name;
      const input = tu.input && typeof tu.input === 'object' ? tu.input : {};
      if (name === 'Bash' && typeof input.command === 'string') {
        if (/\bgit\s+commit\b/.test(input.command)) marker = index;
      }
      if (name === 'Skill' && input.skill === 'commit-commands:commit') {
        marker = index;
      }
    }
  });
  return marker;
}

export function agentsDispatchedSince(records, boundaryIndex) {
  const seen = new Set();
  records.forEach((record, index) => {
    if (index <= boundaryIndex) return;
    for (const tu of toolUses(record)) {
      if (tu.name !== 'Agent') continue;
      const input = tu.input && typeof tu.input === 'object' ? tu.input : {};
      if (typeof input.subagent_type === 'string') seen.add(input.subagent_type);
    }
  });
  return [...seen];
}

export function lastDispatchIndex(records, subagentType) {
  let idx = -1;
  records.forEach((record, index) => {
    for (const tu of toolUses(record)) {
      if (tu.name !== 'Agent') continue;
      const input = tu.input && typeof tu.input === 'object' ? tu.input : {};
      if (input.subagent_type === subagentType) idx = index;
    }
  });
  return idx;
}

export function containsSince(records, needle, boundaryIndex) {
  for (let index = 0; index < records.length; index++) {
    if (index <= boundaryIndex) continue;
    if (JSON.stringify(records[index]).includes(needle)) return true;
  }
  return false;
}

export function containsInToolResultSince(records, needle, boundaryIndex) {
  for (let index = 0; index < records.length; index++) {
    if (index <= boundaryIndex) continue;
    const record = records[index];
    const message = record && typeof record === 'object' ? record.message : undefined;
    const content = message && typeof message === 'object' ? message.content : undefined;
    if (!Array.isArray(content)) continue;
    for (const item of content) {
      if (item && typeof item === 'object' && item.type === 'tool_result') {
        if (JSON.stringify(item).includes(needle)) return true;
      }
    }
  }
  return false;
}

export function agentResultContains(records, subagentType, needle) {
  let toolUseId = null;
  for (const record of records) {
    for (const tu of toolUses(record)) {
      if (tu.name !== 'Agent') continue;
      const input = tu.input && typeof tu.input === 'object' ? tu.input : {};
      if (input.subagent_type === subagentType && typeof tu.id === 'string') {
        toolUseId = tu.id;
      }
    }
  }
  if (!toolUseId) return false;
  for (const record of records) {
    const message = record && typeof record === 'object' ? record.message : undefined;
    const content = message && typeof message === 'object' ? message.content : undefined;

    if (Array.isArray(content)) {
      for (const item of content) {
        if (
          item &&
          typeof item === 'object' &&
          item.type === 'tool_result' &&
          item.tool_use_id === toolUseId &&
          JSON.stringify(item).includes(needle)
        ) {
          return true;
        }
      }
      continue;
    }

    const role = message && typeof message === 'object' ? message.role : undefined;
    const origin = record && typeof record === 'object' ? record.origin : undefined;
    const isHarnessNotification =
      origin && typeof origin === 'object' && origin.kind === 'task-notification';
    if (
      typeof content === 'string' &&
      role === 'user' &&
      isHarnessNotification &&
      content.includes(`<tool-use-id>${toolUseId}</tool-use-id>`) &&
      content.includes(needle)
    ) {
      return true;
    }
  }
  return false;
}

export function agentDispatchedAfter(records, subagentType, afterIso) {
  const afterMs = Date.parse(afterIso);
  if (Number.isNaN(afterMs)) return false;
  for (const record of records) {
    const ts = record && typeof record === 'object' ? record.timestamp : null;
    const tsMs = typeof ts === 'string' ? Date.parse(ts) : Number.NaN;
    if (Number.isNaN(tsMs) || tsMs <= afterMs) continue;
    for (const tu of toolUses(record)) {
      if (tu.name !== 'Agent') continue;
      const input = tu.input && typeof tu.input === 'object' ? tu.input : {};
      if (input.subagent_type === subagentType) return true;
    }
  }
  return false;
}
