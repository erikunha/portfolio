import type { MDXComponents } from 'mdx/types';
import { Preview } from './app/design-system/_components/Preview';
import { Badge, Button, CmdLine, KbdKey, StatTile, TerminalPanel } from './design-system';
import { Field } from './design-system/components/Field';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    Preview,
    Button,
    Field,
    Badge,
    TerminalPanel,
    StatTile,
    CmdLine,
    KbdKey,
    ...components,
  };
}
