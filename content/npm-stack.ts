import { z } from 'zod';
import { type NpmTile, NpmTileSchema } from './schemas';

export const npmStack: NpmTile[] = z.array(NpmTileSchema).parse([
  { label: 'ANGULAR',    path: 'M3 5l9-2 9 2-1 13-8 4-8-4z' },
  { label: 'REACT',      path: 'M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z' },
  { label: 'NEXT.JS',    path: 'M4 4h16v16H4z M8 8l8 8M16 8l-8 8' },
  { label: 'TS',         path: 'M4 4h16v16H4z M12 9v8M9 12l3-3 3 3' },
  { label: 'NODE',       path: 'M12 2l9 5v10l-9 5-9-5V7z' },
  { label: 'RXJS',       path: 'M4 6h16M4 12h10M4 18h7' },
  { label: 'STENCIL',    path: 'M12 3a9 9 0 1 0 0 18A9 9 0 0 0 12 3zm0 2a7 7 0 0 1 7 7 7 7 0 0 1-7 7 7 7 0 0 1-7-7 7 7 0 0 1 7-7z M8 12l2 2 4-4' },
  { label: 'NX',         path: 'M3 6h18v12H3z M3 10h18' },
  { label: 'JEST',       path: 'M4 4h16v16H4z M8 14l3 3 5-6' },
  { label: 'PLAYWRIGHT', path: 'M3 12l4-7 4 7-4 7zM13 12l4-7 4 7-4 7z' },
  { label: 'A11Y',       path: 'M12 3a9 9 0 1 0 0 18A9 9 0 0 0 12 3z M8 12l3 3 5-6' },
  { label: 'PCI-DSS',    path: 'M4 7h16v10H4z M4 11h16 M7 14a1 1 0 1 0 2 0 1 1 0 0 0-2 0z' },
]);
