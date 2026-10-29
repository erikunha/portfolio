import { designSystemOpinionConfig, designSystemTake } from '@/content/hottest-takes';

const TRAILING_DOT = /\.$/;

export function DesignSystemOpinion() {
  if (!designSystemTake) return null;

  const number = designSystemTake.num.replace(TRAILING_DOT, '');

  return (
    <section id={`opinion-${number}`} className="my-6 border border-primary-border p-4">
      <h2 className="font-mono text-primary-500">
        {`Opinion ${number}: ${designSystemOpinionConfig.topic}`}
      </h2>
      <p className="font-mono text-tertiary-50">
        <span className="text-primary-500">{designSystemTake.category}</span>{' '}
        {designSystemTake.thesis}
      </p>
      <p className="font-mono text-tertiary-50">{designSystemTake.body}</p>
    </section>
  );
}
