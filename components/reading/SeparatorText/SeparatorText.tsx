const NO_BREAK_SPACE = ' ';
const SEPARATOR = ' · ';
const BOUND_SEPARATOR = `${NO_BREAK_SPACE}· `;

export function SeparatorText({ children }: { children: string }) {
  return children.replaceAll(SEPARATOR, BOUND_SEPARATOR);
}
