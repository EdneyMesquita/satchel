import { useRef } from "react";
import type { KeyValue } from "../types";
import { findVariable, splitVariableTokens } from "../variableTokens";
import { tokenizeJsonLike, type JsonTokenKind } from "../jsonTokens";

const INDENT = "  ";

function renderVariableRuns(text: string, variables: KeyValue[], keyPrefix: string, baseClassName?: string) {
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
    const title = found ? `${run.key} = ${found.value || "(empty)"}` : "Not defined in the active environment, collection, or globals";
    return (
      <span key={key} className={`var-token${found ? "" : " unresolved"}`} title={title}>
        {run.text}
      </span>
    );
  });
}

function renderTokens(value: string, variables: KeyValue[]) {
  return renderVariableRuns(value, variables, "r");
}

const JSON_CLASS: Record<JsonTokenKind, string | undefined> = {
  key: "json-key",
  string: "json-string",
  number: "json-number",
  literal: "json-literal",
  punct: "json-punct",
  text: undefined,
};

function renderJsonTokens(value: string, variables: KeyValue[]) {
  return tokenizeJsonLike(value).flatMap((run, i) => renderVariableRuns(run.text, variables, `j${i}`, JSON_CLASS[run.kind]));
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
  const syncScroll = (el: HTMLInputElement) => {
    if (backdropRef.current) backdropRef.current.scrollLeft = el.scrollLeft;
  };

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
        {renderTokens(value, variables)}
      </div>
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
  const syncScroll = (el: HTMLTextAreaElement) => {
    if (backdropRef.current) {
      backdropRef.current.scrollTop = el.scrollTop;
      backdropRef.current.scrollLeft = el.scrollLeft;
    }
  };

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
        {syntax === "json" ? renderJsonTokens(value, variables) : renderTokens(value, variables)}
      </div>
    </div>
  );
}
