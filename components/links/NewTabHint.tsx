export function NewTabHint({ text }: { text: string }) {
  return <span className="sr-only"> ({text})</span>;
}
