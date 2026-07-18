export function toSubsystem(filePath: string): string {
  const parts = filePath.split('/');
  if (parts.length === 1) return '(root)';
  return parts.slice(0, -1).slice(0, 2).join('/');
}
