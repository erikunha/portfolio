import { z } from 'zod';
import { type NpmTile, NpmTileSchema } from './schemas';

export const npmStack: NpmTile[] = z.array(NpmTileSchema).parse([
  {
    label: 'REACT',
    path: 'M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
  },
  { label: 'NEXT.JS', path: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z M8 17V7l8 10V7' },

  { label: 'NODE', path: 'M12 2l9 5v10l-9 5-9-5V7z' },
  { label: 'EXPRESS', path: 'M4 12h16M4 6h16M4 18h10' },

  { label: 'AWS', path: 'M4 16l8-12 8 12H4z M8 13h8 M12 8v3' },
  {
    label: 'DOCKER',
    path: 'M2 12h3v3H2zM6 12h3v3H6zM10 12h3v3h-3zM14 8h3v3h-3zM10 8h3v3h-3zM6 8h3v3H6zM10 4h3v3h-3z M19 12c0-1-1-2-2-2h-1V9c0-3-2-5-5-5',
  },

  { label: 'ANGULAR', path: 'M3 5l9-2 9 2-1 13-8 4-8-4z' },
  { label: 'NGRX', path: 'M12 3l8 5v8l-8 5-8-5V8z M12 9v6M9 10.5l3-1.5 3 1.5' },
  { label: 'RXJS', path: 'M4 6h16M4 12h10M4 18h7' },
  { label: 'NX', path: 'M3 6h18v12H3z M3 10h18' },
  {
    label: 'STENCIL',
    path: 'M12 3a9 9 0 1 0 0 18A9 9 0 0 0 12 3zm0 2a7 7 0 0 1 7 7 7 7 0 0 1-7 7 7 7 0 0 1-7-7 7 7 0 0 1 7-7z M8 12l2 2 4-4',
  },
  {
    label: 'MODULE FED',
    path: 'M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM20 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 9l-5 6M12 9l5 6',
  },

  { label: 'TS', path: 'M4 4h16v16H4z M12 9v8M9 12l3-3 3 3' },
  { label: 'CSS', path: 'M19 7a7 7 0 0 0-14 2v6a7 7 0 0 0 14 2M19 12h-6' },

  {
    label: 'POSTGRES',
    path: 'M12 3C7 3 4 6 4 9v6c0 3 3 6 8 6s8-3 8-6V9c0-3-3-6-8-6zM4 12c0 2.5 3.5 5 8 5s8-2.5 8-5',
  },
  { label: 'MONGO', path: 'M12 3v18M9 5.5C9 5.5 7 8 7 12s2 6.5 5 7c3-.5 5-3 5-7s-2-6.5-5-6.5z' },
  {
    label: 'REDIS',
    path: 'M12 4C8 4 5 5.3 5 7s3 3 7 3 7-1.3 7-3-3-3-7-3zM5 7v10c0 1.7 3 3 7 3s7-1.3 7-3V7M5 11c0 1.7 3 3 7 3s7-1.3 7-3',
  },

  { label: 'JEST', path: 'M4 4h16v16H4z M8 14l3 3 5-6' },
  { label: 'VITEST', path: 'M4 6l8 13 8-13M4 6h16' },
  { label: 'PLAYWRIGHT', path: 'M3 12l4-7 4 7-4 7zM13 12l4-7 4 7-4 7z' },
  { label: 'A11Y', path: 'M12 3a9 9 0 1 0 0 18A9 9 0 0 0 12 3z M8 12l3 3 5-6' },

  { label: 'COPILOT', path: 'M3 4h18v13H3z M8 21h8M12 17v4M9 9h6M9 13h4' },
  { label: 'CLAUDE', path: 'M12 3L4 21h16L12 3zM9 14h6M11 9h2' },

  {
    label: 'GIT',
    path: 'M7 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 7v10M7 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM17 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM9 5h5a3 3 0 0 1 3 3v2',
  },
  { label: 'VERCEL', path: 'M12 3L22 21H2L12 3z' },
  {
    label: 'BIOME',
    path: 'M12 22V2M4 12c0-4.4 3.6-8 8-8M20 12c0-4.4-3.6-8-8-8M4 12c4 0 8-2 8-10M20 12c-4 0-8-2-8-10',
  },
]);
