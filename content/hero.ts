import { z } from 'zod';

export const heroTagline = z
  .string()
  .min(1)
  .parse(
    'Senior Full-Stack Engineer · Applied AI · React · Next.js · TypeScript · Angular · Node.js · AWS',
  );

export const heroNowStatus = z.string().min(1).parse('open to new roles');

export const heroPlatformChip = z.string().min(1).parse('last: Raylu.ai · AI deal origination');
