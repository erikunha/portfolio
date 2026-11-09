# Skill dispatch: discovery, matching, invocation

A review needs one specialist per material surface. A skill is how a specialist gets its method:
the checks, the traps, the order, the failure modes of one surface. This file says how to find
the skills this session can run, how to decide which ones apply to this diff, and how to run one.

Two sources. They carry different weight.

| Source | Where it lives | Weight when it matches |
| ------ | -------------- | ----------------------- |
| Repository skills | one directory per skill, beside this skill's own directory, each with a `SKILL.md` | **mandatory** track |
| Session skills | the skills this runtime can load for the developer | **opportunistic** track |

A missing skill never removes a domain from the matrix. It removes that method and leaves the
question open, which the completion matrix must show.

## 1. Discover the repository skills

This file lives in the `references/` directory of this skill, so the skill's own directory is the
one that contains it. That directory is one of several in the repository's canonical skills
directory, one per repository skill, each with a `SKILL.md`.

```
<skills directory>/
  <this skill's directory>/      <- the parent of the references directory this file lives in
    SKILL.md
    references/
  <other repository skill>/      <- one per sibling
    SKILL.md
```

So: list the directories that contain this skill's own directory, keep the ones holding a
`SKILL.md`, and read each one's frontmatter `description`. That is the whole discovery: no path
is written down, nothing is assumed to exist, and a repository that adds a skill is picked up
without touching this file.

The trigger table in `AGENTS.md` maps surfaces to repository skills. Read it instead of
reproducing it; when the two disagree, `AGENTS.md` wins.

## 2. Discover the session skills

The developer's own skills live outside the repository, and every developer has a different set.
Do not assume a layout; find what this machine and this runtime actually expose:

1. If the runtime advertises a catalogue of loadable skills, that catalogue is the list. Read
   each entry's name and description.
2. Otherwise look for per-user skill directories that exist on this machine (the runtime's own
   configuration directory, and any equivalent the developer keeps elsewhere). List what is
   there; a directory that does not exist is not a finding.
3. Each candidate skill is a directory or file with a `SKILL.md`. Read its frontmatter
   `description` and its first heading: that is what tells you what it covers.

Never hardcode a path to a developer's machine, and never fail the review because a personal
skill is missing. The review runs on any machine.

## 3. Match skills to domains

For every MATERIAL domain from the domain matrix, look for a skill whose declared trigger
covers that surface. Match on the **declared trigger**, not on the name: a skill named after a
tool may still cover a different surface, and a skill with an ordinary name may cover exactly
the surface at hand.

- **Repository skill matched** -> mandatory track. Run it, or state why it did not apply
  (the surface is untouched, the skill's own precondition is absent).
- **Session skill matched** -> run it when it fits the domain. Its absence costs nothing;
  its presence adds a specialist the repository does not carry.
- **Two skills cover one domain** -> run the repository one, and use the session one as a second
  opinion on the same question. Two specialists on one question is not two opinions if they
  share a source; the independence rule still applies.

A skill whose trigger matches nothing in this diff does not run. A skill that does not exist for
a MATERIAL domain leaves that domain on the generic specialist track.

## 4. Invoke a skill

Invoke by loading the skill's `SKILL.md` and following its procedure. If the runtime has a native
way to invoke a skill by name, use it; reading the file and following it is the same invocation
with fewer moving parts.

The split of labour:

| The skill owns | The track owns |
| --------------- | -------------- |
| the method, the order, the checks, the known traps | the question, the scope, the evidence format, the verdict |

A skill that ends in "PASS" is a method result, not a review verdict. Its conclusion enters the
matrix as evidence from a named method; you still decide severity and readiness.

A skill that instructs you to write code, change configuration or push belongs to implementation,
not to review. A review track stays read-only. When a skill's procedure needs a change to run,
report it as a limit instead of making it.

## 5. Record what ran

The completion matrix carries one row per dispatched skill:

```
SKILL: <name> | SOURCE: repository | session | TRIGGER: <the trigger that matched>
RESULT: ran | not-applicable | blocked | not-available
EVIDENCE: <what it produced, one line>
```

`not-available` means the skill exists in the repository but this session could not load it.
`not-applicable` means it loaded and its own precondition was absent. Both are limits the reader
must see; neither is a pass.

And one row per skill that was considered and did not run:

```
SKILL: <name> | SOURCE: repository | session | SKIPPED: <the trigger did not match this diff>
```

This second list is what makes the dispatch auditable: the reader sees every skill the session
could have used and why each one stayed out. A skill that was never looked at does not belong in
either list.

## Failure modes

- **Listing skills without running them.** A catalogue is not a review. Every mandatory skill
  either ran or has a recorded reason.
- **Running a skill outside the question.** A skill answers its own question; a track answers
  the track's. If they differ, the skill's output is context, not the answer.
- **Letting a skill's conclusion end the review.** One method cannot see what another surface
  breaks.
- **Hardcoding a developer's layout.** It makes the procedure fail on the next machine, which is
  the failure this design exists to prevent.
