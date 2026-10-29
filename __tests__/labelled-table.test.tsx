import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LabelledTable } from '@/app/design-system/_components/LabelledTable';

function table(headers: string[], rows: string[][]) {
  return createElement(
    LabelledTable,
    null,
    createElement(
      'thead',
      null,
      createElement('tr', null, ...headers.map((h) => createElement('th', { key: h }, h))),
    ),
    createElement(
      'tbody',
      null,
      ...rows.map((row, i) =>
        createElement('tr', { key: i }, ...row.map((c, j) => createElement('td', { key: j }, c))),
      ),
    ),
  );
}

describe('LabelledTable', () => {
  it('renders each body cell label as real text inside the cell', () => {
    const html = renderToStaticMarkup(table(['Prop', 'Type'], [['size', 'string']]));
    expect(html).toMatch(/<td role="cell"><span[^>]*md:hidden[^>]*>Prop<\/span>size<\/td>/);
    expect(html).toMatch(/<td role="cell"><span[^>]*md:hidden[^>]*>Type<\/span>string<\/td>/);
  });

  it('keeps the cell label in the accessibility tree, since mobile hides the header row', () => {
    const html = renderToStaticMarkup(table(['Prop'], [['size']]));
    expect(html).not.toContain('aria-hidden');
  });

  it('re-applies table roles that display:block strips', () => {
    const html = renderToStaticMarkup(table(['Prop'], [['a']]));
    expect(html).toContain('role="table"');
    expect(html).toContain('<thead role="rowgroup">');
    expect(html).toContain('<tbody role="rowgroup">');
    expect(html.match(/<tr role="row">/g)).toHaveLength(2);
    expect(html).toContain('<th role="columnheader">Prop</th>');
  });

  it('keeps the header row and marks the table', () => {
    const html = renderToStaticMarkup(table(['Prop'], [['a']]));
    expect(html).toContain('data-labelled-table');
  });

  it('leaves cells beyond the header count unlabelled', () => {
    const html = renderToStaticMarkup(table(['Prop'], [['a', 'b']]));
    expect(html).toContain('<td role="cell">b</td>');
  });
});
