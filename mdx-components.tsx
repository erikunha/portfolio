import type { MDXComponents } from 'mdx/types';
import { ColorSwatch } from './app/design-system/_components/ColorSwatch';
import { CopyButton } from './app/design-system/_components/CopyButton';
import { Preview } from './app/design-system/_components/Preview';
import { SpacingRuler } from './app/design-system/_components/SpacingRuler';
import { TypeSpecimen } from './app/design-system/_components/TypeSpecimen';
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
    SpacingRuler,
    TypeSpecimen,
    ...components,
  };
}
