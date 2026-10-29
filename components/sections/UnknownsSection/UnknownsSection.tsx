import { unknowns } from '@/content/unknowns';

export function UnknownsSection() {
  const groups = [
    { heading: unknowns.learningHeading, items: unknowns.learning },
    { heading: unknowns.notSpecializingHeading, items: unknowns.notSpecializing },
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
      <p className="opinions-unknowns-end">{unknowns.footer}</p>
    </>
  );
}
