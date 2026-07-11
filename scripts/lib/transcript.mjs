import { readFileSync, statSync } from 'node:fs';

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

const TASK_ID_RE = /<task-id>([a-z0-9]{6,})<\/task-id>/;
const SESSION_ID_RE = /^[A-Za-z0-9-]{6,}$/;
const TOOL_USE_ID_TAG = (id) => `<tool-use-id>${id}</tool-use-id>`;
const TASK_OUTPUT_FILE_RE = /<output-file>([^<]+)<\/output-file>/;
const TASK_OUTPUT_SUFFIX = (sessionId, taskId) => `/${sessionId}/tasks/${taskId}.output`;
const PROMPT_BIND_CHARS = 200;
const MIN_PROMPT_BIND_CHARS = 32;

function promptAnchorOf(prompt) {
  if (typeof prompt !== 'string') return null;
  const anchor = prompt.slice(0, PROMPT_BIND_CHARS);
  return anchor.length >= MIN_PROMPT_BIND_CHARS ? anchor : null;
}

function outputCarriesPrompt(content, promptAnchor) {
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    let record;
    try {
      record = JSON.parse(trimmed);
      // biome-ignore lint/suspicious/noEmptyBlockStatements: tolerate non-JSON lines
    } catch {}
    const message = record && typeof record === 'object' ? record.message : undefined;
    const body = message && typeof message === 'object' ? message.content : undefined;
    if (typeof body === 'string' && body.includes(promptAnchor)) return true;
    if (Array.isArray(body)) {
      for (const block of body) {
        if (
          block &&
          typeof block === 'object' &&
          typeof block.text === 'string' &&
          block.text.includes(promptAnchor)
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

function defaultReadTaskOutput(path) {
  try {
    return { content: readFileSync(path, 'utf8'), mtimeMs: statSync(path).mtimeMs };
  } catch {
    return null;
  }
}

function notificationStrings(record) {
  if (!record || typeof record !== 'object') return [];
  const out = [];
  if (typeof record.content === 'string') out.push(record.content);
  const message = record.message;
  if (message && typeof message === 'object' && typeof message.content === 'string') {
    out.push(message.content);
  }
  const attachment = record.attachment;
  if (attachment && typeof attachment === 'object' && typeof attachment.prompt === 'string') {
    out.push(attachment.prompt);
  }
  return out;
}

export function agentResultContains(records, subagentType, needle, readTaskOutput, sessionId) {
  const readOutput = readTaskOutput ?? defaultReadTaskOutput;
  const sessionAnchor =
    typeof sessionId === 'string' && SESSION_ID_RE.test(sessionId) ? sessionId : null;
  let toolUseId = null;
  let dispatchTsMs = Number.NaN;
  let promptAnchor = null;
  for (const record of records) {
    for (const tu of toolUses(record)) {
      if (tu.name !== 'Agent') continue;
      const input = tu.input && typeof tu.input === 'object' ? tu.input : {};
      if (input.subagent_type === subagentType && typeof tu.id === 'string') {
        toolUseId = tu.id;
        const ts = record.timestamp;
        dispatchTsMs = typeof ts === 'string' ? Date.parse(ts) : Number.NaN;
        promptAnchor = promptAnchorOf(input.prompt);
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
    }

    for (const s of notificationStrings(record)) {
      if (!s.includes(TOOL_USE_ID_TAG(toolUseId))) continue;
      const taskId = TASK_ID_RE.exec(s)?.[1];
      const outputFile = TASK_OUTPUT_FILE_RE.exec(s)?.[1];
      if (!taskId || !outputFile) continue;
      if (!sessionAnchor) continue;
      if (Number.isNaN(dispatchTsMs)) continue;
      if (!promptAnchor) continue;
      if (!outputFile.endsWith(TASK_OUTPUT_SUFFIX(sessionAnchor, taskId))) continue;
      const output = readOutput(outputFile);
      if (
        output &&
        typeof output === 'object' &&
        typeof output.content === 'string' &&
        Number.isFinite(output.mtimeMs) &&
        output.mtimeMs > dispatchTsMs &&
        output.content.includes(needle) &&
        outputCarriesPrompt(output.content, promptAnchor)
      ) {
        return true;
      }
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
