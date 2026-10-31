import { describe, expect, it } from 'vitest';

const LAZY_BARRELS = {
  ContactForm: () => import('@/components/client/ContactForm'),
  InteractiveShell: () => import('@/components/client/InteractiveShell'),
  MatrixRain: () => import('@/components/responsive/MatrixRain'),
} as const;

describe('barrels next to a *Lazy wrapper', () => {
  it.each(Object.entries(LAZY_BARRELS))('%s exports only its Lazy wrapper', async (name, load) => {
    const barrel = await load();
    expect(
      Object.keys(barrel),
      `${name}/index.ts must not re-export the real 'use client' component: an RSC importing through the barrel registers it as a client reference and its chunk lands in the first-load set despite ssr: false`,
    ).toEqual([`${name}Lazy`]);
  });
});
