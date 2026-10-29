'use client';

import dynamic from 'next/dynamic';
import { shellLoadingLabel } from '@/content/shell-ui';

export const InteractiveShellLazy = dynamic(
  () => import('./InteractiveShell').then((m) => ({ default: m.InteractiveShell })),
  {
    ssr: false,
    loading: () => <div role="status" aria-busy="true" aria-label={shellLoadingLabel} />,
  },
);
