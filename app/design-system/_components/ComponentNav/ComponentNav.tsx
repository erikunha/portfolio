const COMPONENTS = [
  { id: 'button', label: 'Button' },
  { id: 'field', label: 'Field' },
  { id: 'badge', label: 'Badge' },
  { id: 'terminal-panel', label: 'TerminalPanel' },
  { id: 'stat-tile', label: 'StatTile' },
  { id: 'cmd-line', label: 'CmdLine' },
  { id: 'kbd-key', label: 'KbdKey' },
  { id: 'copybutton', label: 'CopyButton' },
  { id: 'menu-trigger', label: 'MenuTrigger' },
  { id: 'position-line', label: 'Position line' },
  { id: 'eq-spectrum-strip', label: 'EqSpectrumStrip' },
  { id: 'company-link', label: 'CompanyLink' },
];

export function ComponentNav() {
  return (
    <nav
      className="component-nav flex flex-wrap gap-2 mb-6 pb-4 border-b border-primary-border"
      aria-label="Jump to component"
    >
      {COMPONENTS.map(({ id, label }) => (
        <a
          key={id}
          href={`#${id}`}
          className="text-xs font-mono text-primary-400 no-underline border border-primary-border px-2 py-0.5 transition-[color,border-color] duration-[80ms] hover:text-primary-500 hover:border-primary-500 focus-visible:text-primary-500 focus-visible:border-primary-500 focus-visible:outline-none"
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
