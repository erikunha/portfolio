import {
  Children,
  type ComponentPropsWithoutRef,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { tableRegionAriaLabel } from './table-region.constants';

const HEAD_TAG = 'thead';
const BODY_TAG = 'tbody';
const ROW_TAG = 'tr';
const HEADER_CELL_TAG = 'th';
const CELL_TAG = 'td';

type ElementWithChildren = ReactElement<{ children?: ReactNode }>;

function isTag(node: ReactNode, tag: string): node is ElementWithChildren {
  return isValidElement(node) && node.type === tag;
}

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return '';
}

function headerLabels(children: ReactNode): string[] {
  const head = Children.toArray(children).find((child) => isTag(child, HEAD_TAG));
  if (!isTag(head, HEAD_TAG)) return [];
  const row = Children.toArray(head.props.children).find((child) => isTag(child, ROW_TAG));
  if (!isTag(row, ROW_TAG)) return [];
  return Children.toArray(row.props.children)
    .filter((cell) => isTag(cell, HEADER_CELL_TAG))
    .map((cell) => textOf(cell.props.children));
}

const LABEL_CLASS = 'block text-xs tracking-wider text-primary-500 md:hidden';

function withRole(node: ReactNode, tag: string, role: string): ReactNode {
  if (!isTag(node, tag)) return node;
  return cloneElement(node as ReactElement<Record<string, unknown>>, { role });
}

function labelRow(row: ReactNode, labels: string[]): ReactNode {
  if (!isTag(row, ROW_TAG)) return row;
  let column = 0;
  const cells = Children.map(row.props.children, (cell) => {
    if (!isTag(cell, CELL_TAG)) return cell;
    const label = labels[column];
    column += 1;
    return cloneElement(
      cell as ReactElement<Record<string, unknown>>,
      { role: 'cell' },
      label ? <span className={LABEL_CLASS}>{label}</span> : null,
      cell.props.children,
    );
  });
  return cloneElement(row, { role: 'row' } as Record<string, unknown>, cells);
}

function headSection(section: ReactNode): ReactNode {
  if (!isTag(section, HEAD_TAG)) return section;
  const rows = Children.map(section.props.children, (row) => {
    if (!isTag(row, ROW_TAG)) return row;
    const cells = Children.map(row.props.children, (cell) =>
      withRole(cell, HEADER_CELL_TAG, 'columnheader'),
    );
    return cloneElement(row, { role: 'row' } as Record<string, unknown>, cells);
  });
  return cloneElement(section, { role: 'rowgroup' } as Record<string, unknown>, rows);
}

export function LabelledTable({ children, ...props }: ComponentPropsWithoutRef<'table'>) {
  const labels = headerLabels(children);
  const labelled = Children.map(children, (section) => {
    if (isTag(section, HEAD_TAG)) return headSection(section);
    if (!isTag(section, BODY_TAG)) return section;
    return cloneElement(
      section,
      { role: 'rowgroup' } as Record<string, unknown>,
      Children.map(section.props.children, (row) => labelRow(row, labels)),
    );
  });
  return (
    <section
      aria-label={tableRegionAriaLabel(labels)}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: axe scrollable-region-focusable (WCAG 2.1.1) requires a keyboard-focusable overflow-x-auto region
      tabIndex={0}
      className="max-w-full overflow-x-auto"
    >
      {/* biome-ignore lint/a11y/noRedundantRoles: display:block on the mobile layout strips implicit table semantics; the role restores them */}
      <table data-labelled-table="" role="table" {...props}>
        {labelled}
      </table>
    </section>
  );
}
