# Sample project

## Project agent dispatch

Invoke the named agent before the described action.

| Phase | Trigger | Agent |
|---|---|---|
| Planning | Before invoking writing-plans | architect-reviewer agent |
| Testing | When writing tests | test-automator agent |

## Skill dispatch

| Trigger | Skill |
|---|---|
| Before any feature | superpowers:brainstorming skill |
| Before any git commit | commit-commands:commit skill |
