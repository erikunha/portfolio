import { communityEvent } from '@/content/community';
import { SECTION_LABELS } from '@/content/section-labels';
import { IconCommunity } from '../../Icons';
import { Module } from '../../responsive/Module';
import { moduleHeaderId } from '../../responsive/Module/module.constants';

export function CommunitySection({
  defer,
  embedded = false,
}: {
  defer?: boolean;
  embedded?: boolean;
} = {}) {
  const content = (
    <div className="career-community">
      <p className="career-command" aria-hidden="true">
        $ git tag --list 'community/*'
      </p>
      <p className="career-community-event">
        community/{communityEvent.name} · {communityEvent.year} · {communityEvent.role}
      </p>
      <ul>
        {communityEvent.bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
      <p className="career-community-status">status: {communityEvent.statusLine}</p>
    </div>
  );

  if (embedded) {
    return (
      <section
        id="sec-community"
        tabIndex={-1}
        className="career-group"
        aria-labelledby="sec-community-header"
      >
        <h3 id={moduleHeaderId('sec-community')} className="career-group-title">
          Community
        </h3>
        {content}
      </section>
    );
  }

  return (
    <Module
      id="sec-community"
      header="CAT ~/.COMMUNITY"
      srLabel={SECTION_LABELS['sec-community']}
      icon={<IconCommunity />}
      defer={defer}
    >
      {content}
    </Module>
  );
}
