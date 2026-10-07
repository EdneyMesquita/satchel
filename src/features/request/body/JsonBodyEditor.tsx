import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import type { VariableContext } from "@/variables";
import { isResolved } from "@/variables";
import { cn } from "@/lib/utils";
import { CodeEditor } from "@/components/common/CodeEditor";
import { textSegments } from "@/features/variables/segments";
import { jsonHighlightParts, type HighlightPart } from "./jsonHighlight";
import { isJsonWithVariables } from "./json";

/** Past this, JSON coloring is skipped (variables still show): a pasted multi-MB body would mount a span per token. */
const HIGHLIGHT_LIMIT = 50_000;

interface JsonBodyEditorProps {
  value: string;
  onChange: (value: string) => void;
  context: VariableContext;
  /** JSON gets syntax colors; other raw languages only get {{variable}} tokens */
  json?: boolean;
  "aria-label"?: string;
}

/** The raw body editor: CodeEditor with JSON colors, {{variable}} tokens, and a validity toast on blur. */
export function JsonBodyEditor({ value, onChange, context, json = true, "aria-label": ariaLabel }: JsonBodyEditorProps) {
  const editedSinceFocus = useRef(false);
  const parts = useMemo<HighlightPart[]>(
    () =>
      json && value.length <= HIGHLIGHT_LIMIT
        ? jsonHighlightParts(value)
        : textSegments(value).map((s) => (s.kind === "var" ? { text: s.text, variable: s.key } : { text: s.text })),
    [json, value],
  );

  const renderMirror = useCallback(
    () =>
      parts.map((p, i) =>
        p.variable !== undefined ? (
          <span key={i} className={cn("tok", !isResolved(p.variable, context) && "tok-miss")} data-var={p.variable}>
            {p.text}
          </span>
        ) : (
          <span key={i} className={p.className}>
            {p.text}
          </span>
        ),
      ),
    [parts, context],
  );

  return (
    <CodeEditor
      value={value}
      onChange={(v) => {
        editedSinceFocus.current = true;
        onChange(v);
      }}
      renderMirror={renderMirror}
      onFocus={() => (editedSinceFocus.current = false)}
      onBlur={() => {
        if (json && editedSinceFocus.current && !isJsonWithVariables(value)) toast.error("Not valid JSON yet. Kept as text; it'll be sent as-is.");
        editedSinceFocus.current = false;
      }}
      aria-label={ariaLabel}
    />
  );
}
