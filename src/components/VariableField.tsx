import { useEffect, useRef, useState } from "react";
import type { KeyValue } from "../types";
import { findVariable, splitVariableTokens } from "../variableTokens";
import { tokenizeJsonLike, JSON_TOKEN_CLASS } from "../jsonTokens";

const INDENT = "  ";
const TOOLTIP_DELAY = 300;

interface TooltipState {
  text: string;
  x: number;
  y: number;
}

// The native `title` attribute is not a reliable way to show this: WebKit
// based embedded webviews (Tauri's on macOS included) frequently don't
// render title tooltips at all, even though the attribute is set correctly
// in the DOM. A small controlled tooltip works the same everywhere.
function useHoverTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onEnter = (e: React.MouseEvent<HTMLElement>, text: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setTooltip({ text, x: rect.left, y: rect.bottom + 6 });
    }, TOOLTIP_DELAY);
  };

  const onLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setTooltip(null);
  };

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { tooltip, onEnter, onLeave };
}

function VarTokenTooltip({ tooltip }: { tooltip: TooltipState | null }) {
  if (!tooltip) return null;
  return (
    <div className="var-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
      {tooltip.text}
    </div>
  );
}

type HoverHandlers = {
  onEnter: (e: React.MouseEvent<HTMLElement>, text: string) => void;
  onLeave: () => void;
};

function renderVariableRuns(text: string, variables: KeyValue[], keyPrefix: string, hover: HoverHandlers, baseClassName?: string) {
  return splitVariableTokens(text).map((run, i) => {
    const key = `${keyPrefix}-${i}`;
    if (!run.isVariable) {
      return run.text ? (
        <span key={key} className={baseClassName}>
          {run.text}
        </span>
      ) : null;
    }
    const found = findVariable(run.key!, variables);
    const message = found ? `${run.key} = ${found.value || "(empty)"}` : "Not defined in the active environment, collection, or globals";
    return (
      <span
        key={key}
        className={`var-token${found ? "" : " unresolved"}`}
        onMouseEnter={(e) => hover.onEnter(e, message)}
        onMouseLeave={hover.onLeave}
      >
        {run.text}
      </span>
    );
  });
}

function renderTokens(value: string, variables: KeyValue[], hover: HoverHandlers) {
  return renderVariableRuns(value, variables, "r", hover);
}

function renderJsonTokens(value: string, variables: KeyValue[], hover: HoverHandlers) {
  return tokenizeJsonLike(value).flatMap((run, i) => renderVariableRuns(run.text, variables, `j${i}`, hover, JSON_TOKEN_CLASS[run.kind]));
}

function insertIndent(el: HTMLTextAreaElement, onChange: (value: string) => void) {
  const { selectionStart, selectionEnd, value } = el;
  const next = value.slice(0, selectionStart) + INDENT + value.slice(selectionEnd);
  onChange(next);
  requestAnimationFrame(() => {
    el.selectionStart = el.selectionEnd = selectionStart + INDENT.length;
  });
}

function removeIndent(el: HTMLTextAreaElement, onChange: (value: string) => void) {
  const { selectionStart, value } = el;
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const leading = value.slice(lineStart, selectionStart).match(/^\s{1,2}/);
  if (!leading) return;
  const removed = leading[0].length;
  const next = value.slice(0, lineStart) + value.slice(lineStart + removed);
  onChange(next);
  requestAnimationFrame(() => {
    el.selectionStart = el.selectionEnd = selectionStart - removed;
  });
}

interface VariableInputProps {
  value: string;
  onChange: (value: string) => void;
  variables: KeyValue[];
  className?: string;
  placeholder?: string;
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
}

export function VariableInput({ value, onChange, variables, className, placeholder, onPaste }: VariableInputProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const { tooltip, onEnter, onLeave } = useHoverTooltip();
  const syncScroll = (el: HTMLInputElement) => {
    if (backdropRef.current) backdropRef.current.scrollLeft = el.scrollLeft;
  };

  useEffect(() => onLeave(), [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`field-stack ${className ?? ""}`}>
      <input
        className="field-native"
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => {
          onChange(e.target.value);
          syncScroll(e.target);
        }}
        onScroll={(e) => syncScroll(e.currentTarget)}
        onPaste={onPaste}
      />
      <div className="field-backdrop" ref={backdropRef} aria-hidden="true">
        {renderTokens(value, variables, { onEnter, onLeave })}
      </div>
      <VarTokenTooltip tooltip={tooltip} />
    </div>
  );
}

interface VariableTextareaProps {
  value: string;
  onChange: (value: string) => void;
  variables: KeyValue[];
  className?: string;
  syntax?: "plain" | "json";
}

export function VariableTextarea({ value, onChange, variables, className, syntax = "plain" }: VariableTextareaProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const { tooltip, onEnter, onLeave } = useHoverTooltip();
  const syncScroll = (el: HTMLTextAreaElement) => {
    if (backdropRef.current) {
      backdropRef.current.scrollTop = el.scrollTop;
      backdropRef.current.scrollLeft = el.scrollLeft;
    }
  };

  useEffect(() => onLeave(), [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`field-stack ${className ?? ""}`}>
      <textarea
        className="field-native"
        value={value}
        spellCheck={false}
        onChange={(e) => {
          onChange(e.target.value);
          syncScroll(e.target);
        }}
        onScroll={(e) => syncScroll(e.currentTarget)}
        onKeyDown={(e) => {
          // A plain <textarea> tabs focus out of the field by default —
          // editing code/JSON needs Tab to indent instead, like an editor.
          if (e.key !== "Tab") return;
          e.preventDefault();
          if (e.shiftKey) removeIndent(e.currentTarget, onChange);
          else insertIndent(e.currentTarget, onChange);
        }}
      />
      <div className={`field-backdrop multiline${syntax === "json" ? " json" : ""}`} ref={backdropRef} aria-hidden="true">
        {syntax === "json" ? renderJsonTokens(value, variables, { onEnter, onLeave }) : renderTokens(value, variables, { onEnter, onLeave })}
      </div>
      <VarTokenTooltip tooltip={tooltip} />
    </div>
  );
}
