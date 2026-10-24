import { education } from '@/content/education';
import { moduleHeaderId } from '../../responsive/Module/module.constants';

export function EducationSection() {
  return (
    <section
      id="sec-education"
      tabIndex={-1}
      className="career-group"
      aria-labelledby="sec-education-header"
    >
      <h3 id={moduleHeaderId('sec-education')} className="career-group-title">
        Education
      </h3>
      <p className="career-command" aria-hidden="true">
        $ git tag --list 'edu/*'
      </p>
      <ul className="career-fields">
        {education.map((entry) => (
          <li key={entry.id}>
            <span className="career-field-label">{entry.degree}</span>
            <span>
              {entry.institution}
              {entry.studyMode ? ` (${entry.studyMode})` : ''}
            </span>
            <span>{entry.location}</span>
            <span className="career-field-evidence">{entry.period}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
