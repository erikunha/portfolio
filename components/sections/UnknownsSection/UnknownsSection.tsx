import type { SiteLocale } from '@/content/site-locale';
import { unknowns } from '@/content/unknowns';

export function UnknownsSection({ locale }: { locale: SiteLocale }) {
  const content = unknowns[locale];
  const groups = [
    { heading: content.learningHeading, items: content.learning },
    { heading: content.notSpecializingHeading, items: content.notSpecializing },
  ];

  return (
    <>
      <div className="opinions-unknowns">
        {groups.map((group) => (
          <div key={group.heading}>
            <h3>{group.heading}</h3>
            <ul>
              {group.items.map((item) => (
                <li key={item.claim}>
                  <b aria-hidden>{'-'}</b> {item.claim}
                  {item.showContext ? (
                    <span className="opinions-context"> ({item.context})</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="opinions-unknowns-end">{content.footer}</p>
    </>
  );
}
