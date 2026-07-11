import { z } from 'zod';

export const heroTagline = z
  .string()
  .min(1)
  .parse(
    'Senior Full-Stack Engineer · Applied AI · React · Next.js · TypeScript · Angular · Node.js · AWS',
  );

export const heroCurrentEmployer = z.string().min(1).parse('Raylu.ai');

export const heroPlatformChip = z.string().min(1).parse('platform / headless DataTable');
