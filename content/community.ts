import { type CommunityEvent, CommunityEventSchema } from './schemas';

export const communityEvent: CommunityEvent = CommunityEventSchema.parse({
  name: 'DEVOPSDAYS_CAMPINAS',
  year: 2024,
  role: 'ORGANIZER',
  bullets: [
    'curated 10+ talks across DevOps, cloud infra, platform engineering, and architecture.',
    'ran the full speaker cycle: CFP launch → review → selection → program design → day-of → wrap.',
    'coordinated with speakers, sponsors, and co-organizers end-to-end.',
  ],
  statusLine: 'open to CFP submissions for 2026 · open to volunteer / organizer roles.',
});
