import { designSystemOpinionConfig, designSystemTake } from '@/content/hottest-takes';

const OPINION_ANCHOR_ID = 'opinion-07';

export function DesignSystemOpinion() {
  if (!designSystemTake) return null;

  return (
    <section id={OPINION_ANCHOR_ID} className="my-6 border border-primary-border p-4">
      <h2 className="font-mono text-primary-500">{designSystemOpinionConfig.title}</h2>
      <p className="font-mono text-tertiary-50">
        <span className="text-primary-500">{designSystemTake.category}</span>{' '}
        {designSystemTake.thesis}
      </p>
      <p className="font-mono text-tertiary-50">{designSystemTake.body}</p>
    </section>
  );
}
