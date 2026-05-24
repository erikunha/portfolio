---
name: git-mv-stale-comments
enabled: true
event: bash
pattern: git\s+mv\s+
action: warn
---

**`git mv` detected — check for stale file-path header comments.**

After moving a file, any `// path/to/OldName.tsx` comment at the top of the moved file now points to the old location. This project actively maintains these comments as file-locator metadata.

Immediately after the move:
1. Open the destination file
2. Check line 1-3 for a `// components/...` or `// lib/...` path comment
3. Update it to the new path

This was missed in 7 files during the co-location migration and required a dedicated fix commit.
