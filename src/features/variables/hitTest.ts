export interface RectLike {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Index of the first rect containing the point (edges inclusive), or -1.
 * Used to find which mirrored {{token}} is under the mouse, since the
 * mirror sits under a real <input>/<textarea> with pointer-events: none.
 */
export function hitIndex(rects: RectLike[], x: number, y: number): number {
  return rects.findIndex((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
}

/** Selector for hoverable token spans (variables and :path params). */
export const HOVER_TOKEN_SELECTOR = "[data-var], [data-pp]";

/** Find the mirrored token under (x, y) for a VariableInput / JsonBodyEditor field element. */
export function hitMirrorToken(field: Element, x: number, y: number): HTMLElement | null {
  const wrap = field.closest("[data-vf]");
  const mirror = wrap?.querySelector("[data-vf-mirror]");
  if (!mirror) return null;
  const spans = [...mirror.querySelectorAll<HTMLElement>(HOVER_TOKEN_SELECTOR)];
  const i = hitIndex(
    spans.map((s) => s.getBoundingClientRect()),
    x,
    y,
  );
  return i >= 0 ? spans[i] : null;
}
