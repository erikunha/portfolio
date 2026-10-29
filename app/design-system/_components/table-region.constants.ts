export const TABLE_REGION_LABEL_FALLBACK = 'Table';
export const TABLE_REGION_COLUMN_SEPARATOR = ', ';
export const TABLE_REGION_COLUMN_PREFIX = 'Table with columns ';
export const TABLE_REGION_CAPTION_COLUMN_PREFIX = ' table with columns ';
export const TABLE_REGION_CAPTION_TABLE_SUFFIX = ' table';

export function tableRegionAriaLabel(columns: string[], caption?: string): string {
  const columnList = columns.join(TABLE_REGION_COLUMN_SEPARATOR);
  if (caption !== undefined && columns.length > 0) {
    return `${caption}${TABLE_REGION_CAPTION_COLUMN_PREFIX}${columnList}`;
  }
  if (caption !== undefined) return `${caption}${TABLE_REGION_CAPTION_TABLE_SUFFIX}`;
  if (columns.length > 0) return `${TABLE_REGION_COLUMN_PREFIX}${columnList}`;
  return TABLE_REGION_LABEL_FALLBACK;
}
