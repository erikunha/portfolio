import type { MDXComponents } from 'mdx/types';
import { Preview } from './app/design-system/_components/Preview';
import { Badge, Button, CmdLine, KbdKey, StatTile, TerminalPanel } from './design-system';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    Preview,
    Button,
    Badge,
    TerminalPanel,
    StatTile,
    CmdLine,
    KbdKey,
    ...components,
  };
}
