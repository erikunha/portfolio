import { z } from 'zod';
import { type Responsibility, ResponsibilitySchema } from './schemas';

export const responsibilities: Responsibility[] = z.array(ResponsibilitySchema).parse([
  {
    perms: 'drwxr-xr-x',
    user: 'erik',
    group: 'core',
    name: 'frontend-architecture',
    highlight: true,
  },
  {
    perms: 'drwxr-xr-x',
    user: 'erik',
    group: 'core',
    name: 'performance-optimization',
    highlight: true,
  },
  { perms: 'drwxr-x---', user: 'erik', group: 'core', name: 'security-mindset', highlight: true },
  { perms: 'drwxrwxrwx', user: 'erik', group: 'team', name: 'mentoring-juniors', highlight: false },
  {
    perms: '-rw-r--r--',
    user: 'erik',
    group: 'team',
    name: 'written-knowledge-system',
    highlight: false,
  },
  { perms: 'drwxr-xr-x', user: 'erik', group: 'team', name: 'ai-tooling', highlight: false },
  {
    perms: '-rwx------',
    user: 'erik',
    group: 'self',
    name: 'taste-and-judgment',
    highlight: false,
  },
]);
