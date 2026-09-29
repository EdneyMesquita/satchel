export type ParsedJson = { ok: true; value: unknown } | { ok: false };

// One-entry cache: the pane remounts the viewer on every tab switch, and a multi-MB body
// shouldn't be re-parsed each time.
let last: { text: string; result: ParsedJson } | null = null;

/** JSON.parse, remembered for the last text. */
export function parseJsonCached(text: string): ParsedJson {
  if (last && last.text === text) return last.result;
  let result: ParsedJson;
  try {
    result = { ok: true, value: JSON.parse(text) };
  } catch {
    result = { ok: false };
  }
  last = { text, result };
  return result;
}
