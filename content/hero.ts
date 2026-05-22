import { z } from 'zod';

export const heroTagline = z
  .string()
  .min(1)
  .parse(
    'Staff Full-Stack Engineer · Applied AI · 8+ yrs building regulated, high-scale systems across iGaming (PCI-DSS), healthcare, and e-commerce',
  );
