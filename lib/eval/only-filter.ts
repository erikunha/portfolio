export const ONLY_FLAG = '--only';

const ID_SEPARATOR = ',';

function noIds(): Error {
  return new Error(
    `${ONLY_FLAG} needs at least one id: a corpus item id or a calibration case id, comma separated`,
  );
}

export function parseOnly(argv: readonly string[]): string[] | null {
  const inline = `${ONLY_FLAG}=`;
  let raw: string | undefined;
  let present = false;
  for (const [index, arg] of argv.entries()) {
    if (arg === ONLY_FLAG) {
      present = true;
      const next = argv[index + 1];
      raw = next?.startsWith('--') ? undefined : next;
    } else if (arg.startsWith(inline)) {
      present = true;
      raw = arg.slice(inline.length);
    }
  }
  if (!present) return null;
  const ids = [
    ...new Set(
      (raw ?? '')
        .split(ID_SEPARATOR)
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    ),
  ];
  if (ids.length === 0) throw noIds();
  return ids;
}

export function resolveOnly(
  ids: readonly string[],
  corpusIds: readonly string[],
  calibrationIds: readonly string[],
): { corpus: string[]; calibration: string[] } {
  const corpusSet = new Set(corpusIds);
  const calibrationSet = new Set(calibrationIds);
  const unknown = ids.filter((id) => !corpusSet.has(id) && !calibrationSet.has(id));
  if (unknown.length > 0) {
    throw new Error(
      `${ONLY_FLAG}: unknown id(s): ${unknown.join(', ')}. Use a corpus item id or a calibration case id`,
    );
  }
  return {
    corpus: ids.filter((id) => corpusSet.has(id)),
    calibration: ids.filter((id) => calibrationSet.has(id)),
  };
}
