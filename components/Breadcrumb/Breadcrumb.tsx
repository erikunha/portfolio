import { breadcrumbSchema } from '@/content/seo';

export function Breadcrumb({ trail }: { trail: { name: string; path: string }[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="font-mono text-[11px] tracking-[0.08em] text-primary-400 mb-6"
    >
      <script type="application/ld+json">{JSON.stringify(breadcrumbSchema(trail))}</script>
      <ol className="flex flex-wrap items-center gap-1.5 m-0 p-0 list-none">
        {trail.map((crumb, i) => {
          const isLast = i === trail.length - 1;
          return (
            <li key={crumb.path} className="flex items-center gap-1.5">
              {i > 0 ? (
                <span aria-hidden className="text-primary-subtle">
                  /
                </span>
              ) : null}
              {isLast ? (
                <span aria-current="page" className="text-primary-500">
                  {crumb.name}
                </span>
              ) : (
                <a href={crumb.path} className="hover:text-primary-500">
                  {crumb.name}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
