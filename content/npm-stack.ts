import { z } from 'zod';
import { type NpmTile, NpmTileSchema } from './schemas';

export const npmStack: NpmTile[] = z.array(NpmTileSchema).parse([
  { label: 'ANGULAR', path: 'M3 5l9-2 9 2-1 13-8 4-8-4z' },
  {
    label: 'REACT',
    path: 'M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
  },
  { label: 'NEXT.JS', path: 'M4 4h16v16H4z M8 8l8 8M16 8l-8 8' },
  { label: 'TS', path: 'M4 4h16v16H4z M12 9v8M9 12l3-3 3 3' },
  { label: 'NODE', path: 'M12 2l9 5v10l-9 5-9-5V7z' },
  { label: 'EXPRESS', path: 'M4 12h16M4 6h16M4 18h10' },
  {
    label: 'POSTGRES',
    path: 'M12 3C7 3 4 6 4 9v6c0 3 3 6 8 6s8-3 8-6V9c0-3-3-6-8-6zM4 12c0 2.5 3.5 5 8 5s8-2.5 8-5',
  },
  { label: 'MONGO', path: 'M12 3v18M9 5.5C9 5.5 7 8 7 12s2 6.5 5 7c3-.5 5-3 5-7s-2-6.5-5-6.5z' },
  { label: 'RXJS', path: 'M4 6h16M4 12h10M4 18h7' },
  {
    label: 'STENCIL',
    path: 'M12 3a9 9 0 1 0 0 18A9 9 0 0 0 12 3zm0 2a7 7 0 0 1 7 7 7 7 0 0 1-7 7 7 7 0 0 1-7-7 7 7 0 0 1 7-7z M8 12l2 2 4-4',
  },
  { label: 'NX', path: 'M3 6h18v12H3z M3 10h18' },
  { label: 'JEST', path: 'M4 4h16v16H4z M8 14l3 3 5-6' },
  { label: 'PLAYWRIGHT', path: 'M3 12l4-7 4 7-4 7zM13 12l4-7 4 7-4 7z' },
  { label: 'A11Y', path: 'M12 3a9 9 0 1 0 0 18A9 9 0 0 0 12 3z M8 12l3 3 5-6' },
  { label: 'NGRX', path: 'M12 3l8 5v8l-8 5-8-5V8z M12 9v6M9 10.5l3-1.5 3 1.5' },
  {
    label: 'DOCKER',
    path: 'M2 12h3v3H2zM6 12h3v3H6zM10 12h3v3h-3zM14 8h3v3h-3zM10 8h3v3h-3zM6 8h3v3H6zM10 4h3v3h-3z M19 12c0-1-1-2-2-2h-1V9c0-3-2-5-5-5',
  },
  { label: 'AWS', path: 'M4 16l8-12 8 12H4z M8 13h8 M12 8v3' },
]);
