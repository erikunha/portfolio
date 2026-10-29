import {
  Children,
  type ComponentPropsWithoutRef,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';

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

function labelRow(row: ReactNode, labels: string[]): ReactNode {
  if (!isTag(row, ROW_TAG)) return row;
  let column = 0;
  const cells = Children.map(row.props.children, (cell) => {
    if (!isTag(cell, CELL_TAG)) return cell;
    const label = labels[column];
    column += 1;
    return label
      ? cloneElement(cell as ReactElement<Record<string, unknown>>, { 'data-label': label })
      : cell;
  });
  return cloneElement(row, undefined, cells);
}

export function LabelledTable({ children, ...props }: ComponentPropsWithoutRef<'table'>) {
  const labels = headerLabels(children);
  const labelled = Children.map(children, (section) => {
    if (!isTag(section, BODY_TAG)) return section;
    return cloneElement(
      section,
      undefined,
      Children.map(section.props.children, (row) => labelRow(row, labels)),
    );
  });
  return (
    <table data-labelled-table="" {...props}>
      {labelled}
    </table>
  );
}
