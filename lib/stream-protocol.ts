/**
 * Sentinel prefix written by the ask route when Anthropic throws after the
 * stream has already started. The NUL byte (\x00) never appears in valid
 * UTF-8 prose, making this unambiguous regardless of what partial text was
 * already delivered.
 *
 * Server: appends `STREAM_ERR_SENTINEL + message` then closes.
 * Client: strips it from the live display; surfaces a typed error line on close.
 */
export const STREAM_ERR_SENTINEL = '\x00ERR:';

/**
 * Result of splitting an accumulated /api/ask stream buffer into the
 * user-visible answer text and an optional upstream error message.
 */
export type ParsedStreamChunk = {
  /** The trimmed answer text to display (everything before the sentinel). */
  displayText: string;
  /** The error message after the sentinel, or undefined if no error. */
  errorMessage: string | undefined;
};

/**
 * Pure parser for the /api/ask stream protocol. Given an accumulated buffer of
 * decoded stream text, splits the user-facing answer from any sentinel-marked
 * upstream error.
 *
 * Extracted from InteractiveShell.streamQuestion so the protocol logic can be
 * unit-tested directly without rendering the component or mocking a network
 * stream. The component calls this both per-chunk (live display) and once on
 * stream close (final answer + typed error line).
 *
 * Behavior:
 *  - No sentinel  → displayText is the whole buffer (trimmed), no error.
 *  - With sentinel → displayText is the prefix before the sentinel; the
 *    remainder after the sentinel is the error message. An empty remainder
 *    falls back to the generic 'upstream error'.
 */
export function parseStreamChunk(accumulated: string): ParsedStreamChunk {
  const sentinelIdx = accumulated.indexOf(STREAM_ERR_SENTINEL);
  if (sentinelIdx === -1) {
    return { displayText: accumulated.trim(), errorMessage: undefined };
  }
  const displayText = accumulated.slice(0, sentinelIdx).trim();
  const rawError = accumulated.slice(sentinelIdx + STREAM_ERR_SENTINEL.length).trim();
  return { displayText, errorMessage: rawError || 'upstream error' };
}
