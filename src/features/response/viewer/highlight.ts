import type { JsonRun } from "@/jsonTokens";
import type { Range } from "./jsonSearch";

export interface Piece {
  text: string;
  kind: JsonRun["kind"];
  /** index of the search match this piece belongs to, or -1 */
  match: number;
}

/**
 * Split token runs at search-match boundaries, so each piece has one token kind and at most
 * one match. A match spanning several tokens yields several pieces with the same index.
 * `ranges` must be sorted and non-overlapping.
 */
export function buildPieces(runs: readonly JsonRun[], ranges: readonly Range[]): Piece[] {
  const pieces: Piece[] = [];
  let offset = 0;
  let r = 0;
  for (const run of runs) {
    const start = offset;
    const end = offset + run.text.length;
    offset = end;
    let pos = start;
    while (pos < end) {
      while (r < ranges.length && ranges[r][1] <= pos) r++;
      const range = ranges[r];
      if (!range || range[0] >= end) {
        pieces.push({ text: run.text.slice(pos - start), kind: run.kind, match: -1 });
        break;
      }
      if (range[0] > pos) {
        pieces.push({ text: run.text.slice(pos - start, range[0] - start), kind: run.kind, match: -1 });
        pos = range[0];
      }
      const stop = Math.min(range[1], end);
      pieces.push({ text: run.text.slice(pos - start, stop - start), kind: run.kind, match: r });
      pos = stop;
    }
  }
  return pieces;
}
