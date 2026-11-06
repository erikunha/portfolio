import { designSystemOpinionConfig, designSystemTake } from '@/content/hottest-takes';
import { SITE_LOCALE } from '@/content/site-locale';

const TRAILING_DOT = /\.$/;

export function DesignSystemOpinion() {
  const take = designSystemTake(SITE_LOCALE.en);
  if (!take) return null;

  const number = take.num.replace(TRAILING_DOT, '');

  return (
    <section id={`opinion-${number}`} className="my-6 border border-primary-border p-4">
      <h2 className="font-mono text-primary-500">
        {`Opinion ${number}: ${designSystemOpinionConfig.topic}`}
      </h2>
      <p className="font-mono text-tertiary-50">
        <span className="text-primary-500">{take.category}</span> {take.thesis}
      </p>
      <p className="font-mono text-tertiary-50">{take.body}</p>
    </section>
  );
}
