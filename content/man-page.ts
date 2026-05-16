import { type ManPage, ManPageSchema } from './schemas';

export const manPage: ManPage = ManPageSchema.parse({
  name: 'erik',
  tagline: 'full-stack engineer (frontend-heavy)',
  version: 'v8.0',
  date: '2026-05-15',
});
