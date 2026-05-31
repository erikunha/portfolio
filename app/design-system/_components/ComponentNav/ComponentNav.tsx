const COMPONENTS = [
  { id: 'button', label: 'Button' },
  { id: 'field', label: 'Field' },
  { id: 'badge', label: 'Badge' },
  { id: 'terminal-panel', label: 'TerminalPanel' },
  { id: 'stat-tile', label: 'StatTile' },
  { id: 'cmd-line', label: 'CmdLine' },
  { id: 'kbd-key', label: 'KbdKey' },
  { id: 'copybutton', label: 'CopyButton' },
];

export function ComponentNav() {
  return (
    <nav
      className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-border-default"
      aria-label="Jump to component"
    >
      {COMPONENTS.map(({ id, label }) => (
        <a
          key={id}
          href={`#${id}`}
          className="text-[10px] font-mono text-text-muted no-underline border border-border-default px-2 py-0.5 transition-[color,border-color] duration-[80ms] hover:text-signal hover:border-signal focus-visible:text-signal focus-visible:border-signal focus-visible:outline-none"
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
