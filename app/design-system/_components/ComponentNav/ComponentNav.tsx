import styles from './ComponentNav.module.css';

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
    <nav className={styles.root} aria-label="Jump to component">
      {COMPONENTS.map(({ id, label }) => (
        <a key={id} href={`#${id}`} className={styles.link}>
          {label}
        </a>
      ))}
    </nav>
  );
}
