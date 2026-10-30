import { useId } from 'react';
import { communityEvent } from '@/content/community';
import { careerCredentials, credentials } from '@/content/credentials';
import { educationTags } from '@/content/education';

const EXTERNAL_REL = 'noopener noreferrer';
const EXTERNAL_TARGET = '_blank';

export function CredentialsSection({
  id,
  communityId,
}: {
  id?: string;
  communityId?: string;
} = {}) {
  const groupId = useId();
  const { link: eventLink } = communityEvent;
  const { certifications, education, community, prompt, statusMarker } = careerCredentials;
  const groups = [
    { ...certifications, entries: credentials },
    { ...education, entries: educationTags },
  ];
  return (
    <div id={id} className="career-tags">
      {groups.map((group) => (
        // biome-ignore lint/a11y/useSemanticElements: these are career facts, not form controls
        <div key={group.prefix} role="group" aria-labelledby={`${groupId}-${group.prefix}`}>
          <h3 id={`${groupId}-${group.prefix}`} className="career-command">
            <span className="sr-only">{group.label}</span>
            <span aria-hidden="true" data-type-reveal>
              <span>{prompt}</span> {group.command}
            </span>
          </h3>
          <ul className="career-tag-list">
            {group.entries.map((entry) => (
              <li key={entry.label}>
                <span className="career-tag-key">
                  {group.prefix}
                  {entry.label}
                </span>
                <span>{entry.badge}</span>
                <span>{entry.evidence}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {/* biome-ignore lint/a11y/useSemanticElements: these are career facts, not form controls */}
      <div id={communityId} role="group" aria-labelledby={`${groupId}-community`}>
        <h3 id={`${groupId}-community`} className="career-command">
          <span className="sr-only">{community.label}</span>
          <span aria-hidden="true" data-type-reveal>
            <span>{prompt}</span> {community.command}
          </span>
        </h3>
        <div className="career-community">
          <p className="career-tag-key">
            <a href={eventLink.href} target={EXTERNAL_TARGET} rel={EXTERNAL_REL}>
              <span>{community.heading}</span>
              <span className="sr-only"> {communityEvent.newTabLabel}</span>
            </a>
          </p>
          <ul>
            {community.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
          <p className="career-community-status">
            <span aria-hidden="true">{statusMarker}</span> {community.status}
          </p>
        </div>
      </div>
    </div>
  );
}
