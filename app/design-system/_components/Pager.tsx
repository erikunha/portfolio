import { DS_PAGER, DS_PAGER_NAV_LABEL, DS_PAGER_NEXT_LABEL, DS_PAGER_PREV_LABEL } from './ds-nav';

export function Pager({ slug }: { slug: string }) {
  const index = DS_PAGER.findIndex((page) => page.slug === slug);
  if (index === -1) return null;

  const prev = index > 0 ? DS_PAGER[index - 1] : null;
  const next = index < DS_PAGER.length - 1 ? DS_PAGER[index + 1] : null;

  return (
    <nav className="pager" aria-label={DS_PAGER_NAV_LABEL}>
      {prev ? (
        <a className="nav-item pager-prev" href={prev.href}>
          <span className="nav-label">{`${DS_PAGER_PREV_LABEL}${prev.label}`}</span>
        </a>
      ) : null}
      {next ? (
        <a className="nav-item pager-next" href={next.href}>
          <span className="nav-label">{`${DS_PAGER_NEXT_LABEL}${next.label}`}</span>
        </a>
      ) : null}
    </nav>
  );
}
