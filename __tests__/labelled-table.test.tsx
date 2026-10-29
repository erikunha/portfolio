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
  it('labels each body cell with its column header', () => {
    const html = renderToStaticMarkup(table(['Prop', 'Type'], [['size', 'string']]));
    expect(html).toContain('<td data-label="Prop">size</td>');
    expect(html).toContain('<td data-label="Type">string</td>');
  });

  it('keeps the header row and marks the table', () => {
    const html = renderToStaticMarkup(table(['Prop'], [['a']]));
    expect(html).toContain('<th>Prop</th>');
    expect(html).toContain('data-labelled-table');
  });

  it('leaves cells beyond the header count unlabelled', () => {
    const html = renderToStaticMarkup(table(['Prop'], [['a', 'b']]));
    expect(html).toContain('<td>b</td>');
  });
});
