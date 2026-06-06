Create a git commit following the repo conventions.

Invoke the `commit-commands:commit` skill.

The skill will:
- Check git status and diff
- Draft a commit message following the scope-based convention: `type(scope): description`
  - scope = feature area (hero, shell, contact, ci, harness...), not technical category
- Stage the relevant files
- Create the commit

Do not use `Co-Authored-By` — authorship is solely the repo owner's.
