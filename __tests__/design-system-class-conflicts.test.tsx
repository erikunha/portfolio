import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { Badge } from '@/design-system/components/Badge/Badge';
import { Button } from '@/design-system/components/Button/Button';
import { Field } from '@/design-system/components/Field/Field';
import { KbdKey } from '@/design-system/components/KbdKey/KbdKey';
import { StatTile } from '@/design-system/components/StatTile/StatTile';

const PROPERTY_GROUPS: Array<[string, RegExp]> = [
  ['padding-x', /^px-/],
  ['padding-y', /^py-/],
  ['border-color', /^border-(?:primary|secondary|tertiary|senary|quaternary|quinary)-/],
  ['text-color', /^text-(?:primary|secondary|tertiary|senary|quaternary|quinary|text)-?/],
  ['background-color', /^bg-/],
];

const VARIANTS: Array<[string, ReactElement]> = [
  ['Badge default md', <Badge key="a">x</Badge>],
  [
    'Badge dot sm',
    <Badge key="b" variant="dot" size="sm">
      x
    </Badge>,
  ],
  [
    'Button primary sm',
    <Button key="c" size="sm">
      x
    </Button>,
  ],
  ['Button primary md', <Button key="d">x</Button>],
  [
    'Button secondary lg',
    <Button key="e" variant="secondary" size="lg">
      x
    </Button>,
  ],
  ['KbdKey md', <KbdKey key="f">x</KbdKey>],
  [
    'KbdKey sm',
    <KbdKey key="g" size="sm">
      x
    </KbdKey>,
  ],
  ['Field input', <Field key="h" name="n" label="l" />],
  ['Field textarea', <Field key="i" name="n" label="l" multiline />],
  ['StatTile compact', <StatTile key="j" value="1" label="l" variant="compact" />],
  ['StatTile display', <StatTile key="k" value="1" label="l" variant="display" />],
];

function conflicts(classes: string[]): string[] {
  const unprefixed = classes.filter((name) => !name.includes(':') && !name.startsWith('['));
  return PROPERTY_GROUPS.flatMap(([group, pattern]) => {
    const hits = unprefixed.filter((name) => pattern.test(name));
    return hits.length > 1 ? [`${group}: ${hits.join(' vs ')}`] : [];
  });
}

describe('design-system class lists', () => {
  it.each(VARIANTS)(
    '%s never sets one CSS property through two utilities, because source order picks the winner',
    (_name, element) => {
      const { container } = render(element);
      const root = container.firstElementChild;
      const targets = [root, ...(root?.querySelectorAll('input, textarea') ?? [])];
      for (const target of targets) {
        expect(conflicts([...(target?.classList ?? [])])).toEqual([]);
      }
    },
  );
});
