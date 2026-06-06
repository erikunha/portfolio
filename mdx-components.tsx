import type { MDXComponents } from 'mdx/types';
import { ColorSwatch } from './app/design-system/_components/ColorSwatch';
import { ComponentNav } from './app/design-system/_components/ComponentNav';
import { CopyButton } from './app/design-system/_components/CopyButton';
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
    CopyButton,
    ColorSwatch,
    ComponentNav,
    ...components,
  };
}
