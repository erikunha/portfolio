import { describe, expect, it } from 'vitest';
import remarkTableCaption from '../lib/mdx/remark-table-caption.mjs';

type Node = {
  type: string;
  name?: string;
  depth?: number;
  value?: string;
  children?: Node[];
  data?: { hProperties?: Record<string, unknown> };
};

const mdHeading = (depth: number, text: string): Node => ({
  type: 'heading',
  depth,
  children: [{ type: 'text', value: text }],
});

const jsxHeading = (text: string): Node => ({
  type: 'mdxJsxFlowElement',
  name: 'h2',
  children: [{ type: 'text', value: text }],
});

const gfmTable = (): Node => ({
  type: 'table',
  children: [{ type: 'tableRow', children: [] }],
});

function run(nodes: Node[]) {
  const tree: Node = { type: 'root', children: nodes };
  remarkTableCaption()(tree, { value: '' });
  return tree;
}

function captions(tree: Node) {
  return (tree.children ?? [])
    .filter((node) => node.type === 'table')
    .map((node) => node.data?.hProperties?.caption);
}

describe('remarkTableCaption', () => {
  it('passes the nearest preceding markdown heading as the table caption', () => {
    const tree = run([mdHeading(2, 'Button'), gfmTable()]);
    expect(captions(tree)).toEqual(['Button']);
  });

  it('passes a JSX heading as the caption, since reference pages use raw h2 elements', () => {
    const tree = run([jsxHeading('Type Scale'), gfmTable()]);
    expect(captions(tree)).toEqual(['Type Scale']);
  });

  it('the nearest heading wins when several precede a table', () => {
    const tree = run([mdHeading(1, 'COMPONENTS'), mdHeading(2, 'Field'), gfmTable()]);
    expect(captions(tree)).toEqual(['Field']);
  });

  it('each table after its own heading gets its own caption', () => {
    const tree = run([mdHeading(2, 'Tokens'), gfmTable(), mdHeading(2, 'Styling'), gfmTable()]);
    expect(captions(tree)).toEqual(['Tokens', 'Styling']);
  });

  it('leaves a table before any heading without a caption', () => {
    const tree = run([gfmTable()]);
    expect(captions(tree)).toEqual([undefined]);
  });

  it('flattens formatted heading text', () => {
    const tree = run([
      {
        type: 'heading',
        depth: 3,
        children: [
          { type: 'text', value: 'Stat ' },
          { type: 'inlineCode', value: 'grid' },
        ],
      },
      gfmTable(),
    ]);
    expect(captions(tree)).toEqual(['Stat grid']);
  });

  it('merges the caption into existing hProperties instead of replacing them', () => {
    const tree = run([
      mdHeading(2, 'Button'),
      { ...gfmTable(), data: { hProperties: { align: [null, 'left'] } } },
    ]);
    const table = (tree.children ?? []).find((node) => node.type === 'table');
    expect(table?.data?.hProperties).toEqual({ align: [null, 'left'], caption: 'Button' });
  });
});
