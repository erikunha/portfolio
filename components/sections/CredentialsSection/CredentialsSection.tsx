import { credentials } from '@/content/credentials';
import { SECTION_LABELS } from '@/content/section-labels';
import { IconCredentials } from '../../Icons';
import { Module } from '../../responsive/Module';
import { moduleHeaderId } from '../../responsive/Module/module.constants';

export function CredentialsSection({
  defer,
  embedded = false,
}: {
  defer?: boolean;
  embedded?: boolean;
} = {}) {
  const content = (
    <>
      <p className="career-command" aria-hidden="true">
        $ git tag --list 'cert/*'
      </p>
      <ul className="career-fields">
        {credentials.map((credential) => (
          <li key={credential.label}>
            <span className="career-field-label">cert/{credential.label}</span>
            <span>{credential.badge}</span>
            <span className="career-field-evidence">{credential.evidence}</span>
          </li>
        ))}
      </ul>
    </>
  );

  if (embedded) {
    return (
      <section
        id="sec-credentials"
        tabIndex={-1}
        className="career-group"
        aria-labelledby="sec-credentials-header"
      >
        <h3 id={moduleHeaderId('sec-credentials')} className="career-group-title">
          Certifications
        </h3>
        {content}
      </section>
    );
  }

  return (
    <Module
      id="sec-credentials"
      header="CAT ~/.CREDENTIALS"
      srLabel={SECTION_LABELS['sec-credentials']}
      icon={<IconCredentials />}
      defer={defer}
    >
      {content}
    </Module>
  );
}
