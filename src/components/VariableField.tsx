import { useRef } from "react";
import type { KeyValue } from "../types";
import { findVariable, splitVariableTokens } from "../variableTokens";

function renderTokens(value: string, variables: KeyValue[]) {
  return splitVariableTokens(value).map((run, i) => {
    if (!run.isVariable) return <span key={i}>{run.text}</span>;
    const found = findVariable(run.key!, variables);
    const title = found ? `${run.key} = ${found.value || "(empty)"}` : "Not defined in the active environment, collection, or globals";
    return (
      <span key={i} className={`var-token${found ? "" : " unresolved"}`} title={title}>
        {run.text}
      </span>
    );
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
}

export function VariableTextarea({ value, onChange, variables, className }: VariableTextareaProps) {
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
      />
      <div className="field-backdrop multiline" ref={backdropRef} aria-hidden="true">
        {renderTokens(value, variables)}
      </div>
    </div>
  );
}
