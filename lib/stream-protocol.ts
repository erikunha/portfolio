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
