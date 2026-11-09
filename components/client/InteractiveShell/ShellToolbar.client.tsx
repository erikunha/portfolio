'use client';

import { useRef, useState } from 'react';
import type { ShellUi } from '@/content/shell-ui';
import { ShellKey } from './shell-keys';

function roveTarget(key: string, index: number, count: number): number | null {
  switch (key) {
    case ShellKey.Home:
      return 0;
    case ShellKey.End:
      return count - 1;
    case ShellKey.Right:
      return (index + 1) % count;
    case ShellKey.Left:
      return (index - 1 + count) % count;
    default:
      return null;
  }
}

export function ShellToolbar({
  ui,
  busy,
  onActivate,
}: {
  ui: ShellUi;
  busy: boolean;
  onActivate: (command: string) => void;
}) {
  const [toolbarIndex, setToolbarIndex] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div
      className="shell-toolbar"
      role="toolbar"
      aria-label={ui.toolbarLabel}
      data-testid="shell-commands"
    >
      {ui.commands.map((command, index) => (
        <button
          key={command}
          ref={(node) => {
            buttons.current[index] = node;
          }}
          type="button"
          className="shell-control shell-cmd-hint"
          data-cmd={command}
          tabIndex={index === toolbarIndex ? 0 : -1}
          aria-disabled={busy}
          onFocus={() => setToolbarIndex(index)}
          onClick={() => onActivate(command)}
          onKeyDown={(event) => {
            if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
            const target = roveTarget(event.key, index, ui.commands.length);
            if (target === null) return;
            event.preventDefault();
            setToolbarIndex(target);
            buttons.current[target]?.focus();
          }}
        >
          {command}
        </button>
      ))}
      <span className="shell-command-hint">{ui.commandHint}</span>
    </div>
  );
}
