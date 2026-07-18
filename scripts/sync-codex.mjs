#!/usr/bin/env node
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

const CLAUDE_SKILLS = '.claude/skills';
const CLAUDE_HOOKS = '.claude/hooks';
const CLAUDE_RULES = '.claude/rules';
const CLAUDE_AGENTS = '.claude/agents';
const CODEX_HOOKS = '.codex/hooks';
const CLAUDE_INSTRUCTIONS = 'CLAUDE.md';
const CODEX_INSTRUCTIONS = 'AGENTS.md';
const SKILL_FILE = 'SKILL.md';

// hooks/ subtrees that are dev-only and not part of what an agent EXECUTES: the test
// suite and Python bytecode. Excluded so the mirror stays the runtime harness, not its
// tests. Everything else under hooks/ (the .sh guards, bash-guard-detect.py, and the
// vendored bashlex parser it imports) is copied byte-for-byte, because bash-guard.sh
// runs `python3 $HOOK_DIR/bash-guard-detect.py` and, if that file is absent, python exits
// 2 and the guard treats exit 2 as BLOCK-with-empty-message — blocking every command.
const HOOK_EXCLUDE = new Set(['__tests__', '__pycache__']);

// Only the harness's own paths differ between the two agents. Everything else in these
// files is a FACT about this repo — the model string /api/ask sends, the review command,
// the bot that posts the verdict, the script that gates the merge — identical whoever
// reads it. A previous mirror replaced "claude" with "Codex" everywhere, rewriting 45 of
// those facts to fix 6 paths: it told Codex to call `anthropic/Codex-haiku-4-5` (not a
// model), run `/Codex-review` and `pnpm Codex-gate` (not commands), wait on `Codex[bot]`
// (not a bot). Skills live under .agents/ for Codex; everything else under .codex/. There
// is deliberately NO catch-all `.claude/`->`.codex/`: it would invent `.codex/settings.json`
// (Codex config is config.toml) and mis-route `.claude/skills` to `.codex/skills`.
const PATH_REWRITES = [
  [/\.claude\/skills/g, '.agents/skills'],
  [/\.claude\/hooks/g, CODEX_HOOKS],
  [/\.claude\/rules/g, '.codex/rules'],
  [/\.claude\/agents/g, '.codex/agents'],
  // The api-edit marker is per-tree runtime state under the repo root: a writer
  // (api-edit-marker.sh — which `mkdir -p`s the dir AND appends the file) and a reader
  // (api-security-push-guard.sh), both mirrored. Rewrite the whole `$ROOT/.claude` prefix (the
  // marker's parent dir AND the marker path) to `$ROOT/.codex` so the hooks create and use the
  // Codex-tree dir, stay consistent with each other, and keep no `.claude/` reference — a
  // session only ever runs one agent's hooks, so they never need a shared file.
  [/\$ROOT\/\.claude\b/g, '$ROOT/.codex'],
  // Prose references to the same marker without the `$ROOT/` prefix (e.g. a rule naming the
  // path). Only the full marker path is safe to rewrite; a bare `.claude` would mis-route
  // `.claude/skills` (which goes to `.agents/`), which is why these two rules are specific.
  [/\.claude\/\.api-edit-pending/g, '.codex/.api-edit-pending'],
  // No leading \b: in a hook's `"...\nCLAUDE.md: ..."` message the `n` of the `\n` escape
  // sits against `CLAUDE`, so a leading boundary would skip exactly the hook prose this must fix.
  [/CLAUDE\.md\b/g, CODEX_INSTRUCTIONS],
  // Two non-path claims are rewritten here, everything else in PATH_REWRITES is a path.
  // CLAUDE.md's opening line says the file is auto-loaded by Claude Code, which is false for
  // AGENTS.md — Codex auto-loads it instead. The other rewrites a live-fire evidence citation
  // that would otherwise read as a factual override of the AGENTS_BANNER/CODEX_NOTE disclaimer
  // sitting above it. Every OTHER "Claude Code" is a genuine product fact (e.g. "Claude Code is
  // available as a CLI") and is left alone; a blanket "Claude Code"->"Codex" is the naive-replace
  // trap this design avoids.
  [/Auto-loaded by Claude Code/g, 'Auto-loaded by Codex'],
  [/\*\*Confirmed enforced \(/g, '**Confirmed enforced where hooks are registered ('],
];

// If a sync writes one of these, a path rewrite has leaked into a repo fact and the mirror
// is lying to Codex.
const FORBIDDEN = [
  /anthropic\/Codex-/,
  /\/Codex-review/,
  /Codex\[bot\]/,
  /Codex-gate/,
  /check-Codex-approval/,
  /\.Codex\//,
];

export const rewriteText = (source) =>
  PATH_REWRITES.reduce((text, [from, to]) => text.replace(from, to), source);

export const findFiction = (text) => {
  for (const pattern of FORBIDDEN) {
    const hit = text.match(pattern);
    if (hit) return hit[0];
  }
  return null;
};

// Runtime STATE a hook creates at runtime (gitignored, absent at rest) — not mirror content,
// so a reference to one is not a dangling mirror ref. Named + narrow so the fail-closed check
// still catches any OTHER missing dotfile reference; widen this set deliberately, not by pattern.
const RUNTIME_STATE = new Set(['.api-edit-pending']);

// Literal repo-relative mirror paths a rewritten file points at. Each must exist in the
// mirror, or the file references something that was never generated (the dangling-ref
// class the fail-open predecessor could not see). Bounded to the two mirror roots; runtime
// state (RUNTIME_STATE) is excluded because it is created at runtime, not generated here.
export const referencedMirrorPaths = (text) => {
  const matches = text.match(/(?:\.agents|\.codex)\/[A-Za-z0-9_./-]+/g) ?? [];
  return [...new Set(matches.map((m) => m.replace(/[.]+$/, '')))].filter(
    (p) => !RUNTIME_STATE.has(path.basename(p)),
  );
};

// Sibling files a hook invokes by `$HOOK_DIR/NAME` (bash-guard.sh -> bash-guard-detect.py).
// A missing sibling is invisible to a path scan because the reference is relative, yet it
// is the defect that hard-blocks every command, so it gets its own check.
export const referencedHookSiblings = (text) => {
  const matches = text.match(/\$HOOK_DIR\/([A-Za-z0-9_.-]+)/g) ?? [];
  return [...new Set(matches.map((m) => m.replace('$HOOK_DIR/', '')))];
};

const walk = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (HOOK_EXCLUDE.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
};

const toCodexHook = (from) => path.join(CODEX_HOOKS, path.relative(CLAUDE_HOOKS, from));

// text = rewrite the harness paths + assert no fiction; binary = byte-for-byte. The hook
// SCRIPTS are text: their advisory messages and the api-edit marker path must be remapped for
// the Codex copy (CLAUDE.md->AGENTS.md, `.claude/.api-edit-pending`->`.codex/...`). Only the
// VENDORED bashlex parser is binary: it is upstream GPLv3 code, has no harness paths to
// rewrite, and is not ours to edit even by a no-op pass.
// AGENTS.md is content-mirrored, not activated: the body it inherits describes hooks as
// "WIRED"/"enforced", which only holds where the hooks are registered — they are not, in this
// repo, for the mirror's runtime. This banner says so at the top so the mirror does not assert
// enforcement it cannot deliver. It is Codex-native (names no other agent): the mirror files
// must not cross-reference — the only unavoidable non-Codex strings are repo-infra facts (the
// review bot, the review command) that renaming would turn into fiction.
export const AGENTS_BANNER = `<!-- GENERATED — do not edit by hand. Regenerate with \`pnpm sync:codex\`. -->
> **Generated harness file.** Hook activation is not configured in this repo, so every hook and gate described below is **guidance to self-enforce**, not an automated gate.

`;

// Skills and rules are loaded contextually — often WITHOUT AGENTS.md's banner in view —
// yet they carry "the hook blocks", "enforced", "WIRED", "exit 2" claims (in the body AND in
// a skill's frontmatter description) that only hold where the hooks are registered. Rather than
// rewrite each phrasing, every mirrored skill/rule/agent gets this note reframing how to read
// ALL such claims in the file. Codex-native, like the banner (no cross-reference). Inserted
// AFTER the note-target's frontmatter (see insertNote) so a skill's `---name/description---`
// block stays parseable.
export const CODEX_NOTE = `> **Codex note:** hook activation is not configured in this repo, so every "the hook blocks", "enforced", "WIRED", or "exit 2" claim here — including in this file's description — is a **hard rule to self-enforce**, not an automated gate.

`;

// Insert after YAML frontmatter (`---\n...\n---\n`) if present, else at the very top. A skill's
// frontmatter must remain the first bytes of the file to stay discoverable.
export const insertNote = (text, note) => {
  const fm = text.match(/^---\n[\s\S]*?\n---\n/);
  return fm ? fm[0] + note + text.slice(fm[0].length) : note + text;
};

const ENFORCEMENT_CLAIM_TOKENS = /\b(WIRED|Confirmed enforced|exit 2)\b/g;
// Coupled to the literal "to self-enforce" phrase inside AGENTS_BANNER and CODEX_NOTE above.
const SELF_ENFORCE_DISCLAIMER = 'to self-enforce';

export const undisclaimedEnforcementClaims = (text) => {
  if (text.includes(SELF_ENFORCE_DISCLAIMER)) return null;
  const matches = text.match(ENFORCEMENT_CLAIM_TOKENS);
  return matches ? [...new Set(matches)] : null;
};

// The vendored bashlex parser + its upstream LICENSE are byte-copied: upstream GPLv3 code we do
// not edit. VENDORED.txt is the EXCEPTION — a repo-authored notice describing THIS vendoring
// instance, so it is text-rewritten to point at the `.codex/` detector it actually sits beside.
const isVendored = (from) =>
  from.includes(`${path.sep}vendor${path.sep}`) && !from.endsWith('VENDORED.txt');

export const collectSources = () => {
  const sources = [];
  for (const skill of readdirSync(CLAUDE_SKILLS)) {
    const from = path.join(CLAUDE_SKILLS, skill, SKILL_FILE);
    if (existsSync(from))
      sources.push({
        from,
        to: path.join('.agents/skills', skill, SKILL_FILE),
        mode: 'text',
        note: CODEX_NOTE,
      });
  }
  for (const rule of readdirSync(CLAUDE_RULES)) {
    sources.push({
      from: path.join(CLAUDE_RULES, rule),
      to: path.join('.codex/rules', rule),
      mode: 'text',
      note: CODEX_NOTE,
    });
  }
  for (const agent of readdirSync(CLAUDE_AGENTS)) {
    sources.push({
      from: path.join(CLAUDE_AGENTS, agent),
      to: path.join('.codex/agents', agent),
      mode: 'text',
      note: CODEX_NOTE,
    });
  }
  for (const from of walk(CLAUDE_HOOKS)) {
    sources.push({ from, to: toCodexHook(from), mode: isVendored(from) ? 'binary' : 'text' });
  }
  sources.push({
    from: CLAUDE_INSTRUCTIONS,
    to: CODEX_INSTRUCTIONS,
    mode: 'text',
    prepend: AGENTS_BANNER,
  });
  return sources;
};

const renderText = (from, to) => {
  const next = rewriteText(readFileSync(from, 'utf-8'));
  const fiction = findFiction(next);
  if (fiction) {
    throw new Error(
      `${to}: sync produced "${fiction}", which names nothing that exists. A path rewrite ` +
        'leaked into a repo fact — the model string, review command, bot name, and gate script ' +
        'are the same for every agent and must pass through verbatim.',
    );
  }
  return next;
};

// The pure fail-closed decision for one mirrored file: which of the paths it references
// resolve neither to another mirror target nor to a real file on disk. A file that survives
// the drift diff can still point at a rule, agent, or detector that was never generated; the
// predecessor diffed only the files it wrote and reported OK over exactly that gap.
// `exists` is injected so this is testable without touching the filesystem.
export const unresolvedRefs = ({ to, text, present, exists }) => {
  const problems = [];
  for (const ref of referencedMirrorPaths(text)) {
    if (!present.has(ref) && !exists(ref)) problems.push(`${to} -> missing ${ref}`);
  }
  if (to.startsWith(`${CODEX_HOOKS}/`) && to.endsWith('.sh')) {
    for (const sibling of referencedHookSiblings(text)) {
      const siblingPath = path.join(CODEX_HOOKS, sibling);
      if (!present.has(siblingPath) && !exists(siblingPath)) {
        problems.push(`${to} -> missing sibling ${siblingPath}`);
      }
    }
  }
  return problems;
};

const findIncompleteness = (targets) => {
  const present = new Set(targets);
  const problems = [];
  for (const to of targets) {
    if (!/\.(md|sh|txt)$/.test(to)) continue;
    const text = readFileSync(to, 'utf-8');
    problems.push(...unresolvedRefs({ to, text, present, exists: existsSync }));
  }
  return problems;
};

const findUndisclaimedClaims = (targets) => {
  const problems = [];
  for (const to of targets) {
    if (!to.endsWith('.md')) continue;
    const text = readFileSync(to, 'utf-8');
    const claims = undisclaimedEnforcementClaims(text);
    if (claims) problems.push(`${to} -> undisclaimed ${claims.join(', ')}`);
  }
  return problems;
};

export const run = ({ check }) => {
  const sources = collectSources();
  let drifted = 0;
  const targets = [];

  for (const { from, to, mode, prepend, note } of sources) {
    targets.push(to);
    if (mode === 'text') {
      const body = renderText(from, to);
      const next = prepend ? prepend + body : note ? insertNote(body, note) : body;
      const current = existsSync(to) ? readFileSync(to, 'utf-8') : null;
      if (current === next) continue;
      drifted++;
      if (!check) {
        mkdirSync(path.dirname(to), { recursive: true });
        writeFileSync(to, next);
        // writeFileSync only sets mode on CREATE (default non-executable); a first-time mirror
        // of a new executable hook would land non-executable and --check (content-only) would
        // not catch it. Copy the source bit like the binary branch's copyFileSync does.
        chmodSync(to, statSync(from).mode);
      }
    } else {
      const bytes = readFileSync(from);
      if (existsSync(to) && readFileSync(to).equals(bytes)) continue;
      drifted++;
      if (!check) {
        mkdirSync(path.dirname(to), { recursive: true });
        copyFileSync(from, to);
      }
    }
    console.log(`${check ? 'DRIFT' : 'sync '}  ${to}`);
  }

  // Completeness runs against on-disk state, so in --check mode it inspects the committed
  // mirror; drift is reported first because a re-sync is the fix for both.
  if (check) {
    if (drifted > 0) {
      console.error(`\n${drifted} file(s) drifted from .claude/. Run \`pnpm sync:codex\`.`);
      process.exit(1);
    }
    const problems = findIncompleteness(targets);
    if (problems.length > 0) {
      console.error(
        '\nMirror is incomplete (a reference points at a file that was never generated):',
      );
      for (const p of problems) console.error(`  ${p}`);
      process.exit(1);
    }
    const claimProblems = findUndisclaimedClaims(targets);
    if (claimProblems.length > 0) {
      console.error('\nMirror asserts hook enforcement without the self-enforce disclaimer:');
      for (const p of claimProblems) console.error(`  ${p}`);
      process.exit(1);
    }
    console.log('OK  .agents/ and .codex/ match .claude/ and reference nothing missing');
    return;
  }
  console.log(drifted === 0 ? 'OK  already in sync' : `\n${drifted} file(s) synced`);
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)
) {
  run({ check: process.argv.includes('--check') });
}
