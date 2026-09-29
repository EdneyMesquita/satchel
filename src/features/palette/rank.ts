/** Palette matching, ported from the mockup: substring > word-prefix > short subsequence. */

export interface Rankable {
  group: "Requests" | "Commands";
  label: string;
  sub: string;
  method?: string;
}

/** 3 = substring, 2 = every query word starts a word, 1 = subsequence (≤ 4 chars), 0 = no match. */
export function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const s = text.toLowerCase();
  if (!q) return 1;
  if (s.includes(q)) return 3;
  const words = s.split(/[^a-z0-9]+/);
  if (q.split(/\s+/).every((w) => words.some((x) => x.startsWith(w)))) return 2;
  let i = 0;
  for (const c of s) if (c === q[i]) i++;
  return i === q.length && q.length <= 4 ? 1 : 0;
}

/** Items to show for a query. Empty query: first `requestLimit` requests + every command. Otherwise only the best-scoring tier. */
export function rankItems<T extends Rankable>(items: T[], query: string, requestLimit = 6): T[] {
  const q = query.trim();
  if (!q) {
    return [...items.filter((i) => i.group === "Requests").slice(0, requestLimit), ...items.filter((i) => i.group === "Commands")];
  }
  const scored = items
    .map((item) => {
      const whole = fuzzyScore(q, `${item.label} ${item.sub} ${item.method ?? ""}`);
      // A hit in the label itself beats one found only in the sub text.
      const inLabel = whole === 3 && item.label.toLowerCase().includes(q.toLowerCase()) ? 0.5 : 0;
      return { item, score: whole + inLabel };
    })
    .filter((x) => x.score > 0);
  const best = Math.max(0, ...scored.map((x) => Math.floor(x.score)));
  const tier = scored.filter((x) => Math.floor(x.score) === best);
  // Stable: label hits first, then source order.
  return tier.sort((a, b) => b.score - a.score).map((x) => x.item);
}

/** Split a ranked list into groups, ordered by where each group's first item landed. */
export function groupRanked<T extends Rankable>(items: T[]): { group: T["group"]; items: T[] }[] {
  const groups: { group: T["group"]; items: T[] }[] = [];
  for (const item of items) {
    let g = groups.find((x) => x.group === item.group);
    if (!g) groups.push((g = { group: item.group, items: [] }));
    g.items.push(item);
  }
  return groups;
}
