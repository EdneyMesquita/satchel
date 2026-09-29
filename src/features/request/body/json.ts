/**
 * JSON bodies often hold bare {{variables}} (e.g. `"qty": {{qty}}`), which
 * isn't valid JSON until they're substituted. To validate / pretty-print we
 * swap every variable outside a string for a quoted placeholder, run the
 * real JSON parser, then put the variables back.
 */

const PLACEHOLDER = (i: number) => `"__satchel_var_${i}__"`;
const PLACEHOLDER_PATTERN = /"__satchel_var_(\d+)__"/g;

// Strings first, so a {{variable}} inside quotes is left alone.
const SCAN_PATTERN = /"(?:\\.|[^"\\])*"|\{\{[\w.-]+\}\}/g;

function protect(raw: string): { text: string; vars: string[] } {
  const vars: string[] = [];
  const text = raw.replace(SCAN_PATTERN, (m) => {
    if (m[0] === '"') return m;
    vars.push(m);
    return PLACEHOLDER(vars.length - 1);
  });
  return { text, vars };
}

/** Pretty-print with 2-space indent, keeping bare {{variables}}. null when it isn't valid JSON. */
export function beautifyJson(raw: string): string | null {
  const { text, vars } = protect(raw);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  return JSON.stringify(value, null, 2).replace(PLACEHOLDER_PATTERN, (m, i: string) => vars[Number(i)] ?? m);
}

/** Whether the body parses as JSON once its bare {{variables}} are substituted. Empty counts as valid. */
export function isJsonWithVariables(raw: string): boolean {
  if (!raw.trim()) return true;
  try {
    JSON.parse(protect(raw).text);
    return true;
  } catch {
    return false;
  }
}
