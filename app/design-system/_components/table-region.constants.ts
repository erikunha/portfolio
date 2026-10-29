export const TABLE_REGION_LABEL_FALLBACK = 'Table';
export const TABLE_REGION_COLUMN_SEPARATOR = ', ';

export function tableRegionAriaLabel(columns: string[]): string {
  if (columns.length === 0) return TABLE_REGION_LABEL_FALLBACK;
  return `Table with columns ${columns.join(TABLE_REGION_COLUMN_SEPARATOR)}`;
}
