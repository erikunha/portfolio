import { type CommunityEvent, CommunityEventSchema } from './schemas';

export const communityTalksSentence =
  'curated 10+ talks across DevOps, cloud infra, platform engineering, and architecture.';

export const communityEvent: CommunityEvent = CommunityEventSchema.parse({
  name: 'DEVOPSDAYS_CAMPINAS',
  year: 2024,
  role: 'ORGANIZER',
  bullets: [
    communityTalksSentence,
    'ran the full speaker cycle: CFP launch → review → selection → program design → day-of → wrap.',
    'coordinated with speakers, sponsors, and co-organizers end-to-end.',
  ],
  link: { label: 'devopsdays.org', href: 'https://devopsdays.org/events/2024-campinas/welcome/' },
  newTabLabel: '(opens in a new tab)',
  statusLine: 'open to CFP submissions for 2027 · open to volunteer / organizer roles.',
});
