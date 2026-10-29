export type OnThisPageItem = { id: string; label: string };

type OnThisPageProps = { items: readonly OnThisPageItem[] };

export function OnThisPage({ items }: OnThisPageProps) {
  return (
    <nav className="toc" aria-label="On this page">
      <p className="toc-title">ON THIS PAGE</p>
      <ul>
        {items.map(({ id, label }) => (
          <li key={id}>
            <a className="ds-nav-item" href={`#${id}`}>
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
