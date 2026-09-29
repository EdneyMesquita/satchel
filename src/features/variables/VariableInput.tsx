import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ClipboardEvent,
  type FocusEvent,
  type KeyboardEvent,
  type Ref,
} from "react";
import type { VariableContext } from "@/variables";
import { isResolved } from "@/variables";
import { cn } from "@/lib/utils";
import { textSegments, urlSegments, type Segment } from "./segments";

/** Renders segments as spans; tokens carry data-var / data-pp for the hover layer. */
export function SegmentSpans({ segments, context }: { segments: Segment[]; context: VariableContext }) {
  return (
    <>
      {segments.map((s, i) => {
        if (s.kind === "var")
          return (
            <span key={i} className={cn("tok", !isResolved(s.key, context) && "tok-miss")} data-var={s.key}>
              {s.text}
            </span>
          );
        if (s.kind === "path")
          return (
            <span key={i} className="pp" data-pp={s.name}>
              {s.text}
            </span>
          );
        if (s.kind === "qs")
          return (
            <span key={i} className="qs">
              {s.text}
            </span>
          );
        return <span key={i}>{s.text}</span>;
      })}
    </>
  );
}

export type VariableInputVariant = "cell" | "url";

const VARIANT_CLASS: Record<VariableInputVariant, { wrap: string; line: string }> = {
  // table cells and boxed form fields
  cell: { wrap: "text-[12.5px]", line: "h-[30px] px-2.5 leading-[30px]" },
  // the URL bar
  url: { wrap: "h-full text-[13px]", line: "h-[34px] px-2.5 leading-[34px]" },
};

export interface VariableInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Resolves {{variables}} to color them defined (brass) or missing (red) */
  context: VariableContext;
  /** "url" also marks /:path params and ? & = in the query */
  kind?: "text" | "url";
  variant?: VariableInputVariant;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  /** Disabled table rows: fg3 text, dimmed tokens */
  dimmed?: boolean;
  onPaste?: (e: ClipboardEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  inputRef?: Ref<HTMLInputElement>;
  /** Extra data-* attributes for the <input> (e.g. to find it for focusing) */
  inputData?: Record<`data-${string}`, string>;
  "aria-label"?: string;
}

/**
 * A real <input> with transparent text over a mirror that renders the same
 * text with highlighted tokens. Both share font, size, line-height and
 * padding exactly, so nothing shifts when the field takes focus; the mirror
 * follows the input's horizontal scroll.
 */
export function VariableInput({
  value,
  onChange,
  context,
  kind = "text",
  variant = "cell",
  placeholder,
  className,
  inputClassName,
  dimmed,
  onPaste,
  onKeyDown,
  onFocus,
  onBlur,
  inputRef,
  inputData,
  "aria-label": ariaLabel,
}: VariableInputProps) {
  const ownRef = useRef<HTMLInputElement | null>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const v = VARIANT_CLASS[variant];

  const setRefs = useCallback(
    (el: HTMLInputElement | null) => {
      ownRef.current = el;
      if (typeof inputRef === "function") inputRef(el);
      else if (inputRef) inputRef.current = el;
    },
    [inputRef],
  );

  const syncScroll = useCallback(() => {
    const input = ownRef.current;
    if (input && innerRef.current) innerRef.current.style.transform = `translateX(${-input.scrollLeft}px)`;
  }, []);

  // After every value change (typing, or the URL being rebuilt from the params table).
  useLayoutEffect(syncScroll, [value, syncScroll]);

  // Width changes (split drag, window resize) and late font loads can move scrollLeft.
  useEffect(() => {
    const input = ownRef.current;
    if (!input) return;
    const ro = new ResizeObserver(syncScroll);
    ro.observe(input);
    document.fonts?.ready.then(syncScroll).catch(() => {});
    return () => ro.disconnect();
  }, [syncScroll]);

  const segments = useMemo(() => (kind === "url" ? urlSegments(value) : textSegments(value)), [kind, value]);

  return (
    <div
      data-vf
      className={cn(
        "relative min-w-0 overflow-hidden font-mono [font-variant-ligatures:none]",
        v.wrap,
        dimmed && "[&_.pp]:opacity-55 [&_.tok]:opacity-55",
        className,
      )}
    >
      <div
        data-vf-mirror
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 overflow-hidden whitespace-pre [font-variant-ligatures:none]",
          v.line,
          dimmed ? "text-fg3" : "text-fg",
        )}
      >
        <span ref={innerRef} className="inline-block">
          <SegmentSpans segments={segments} context={context} />
        </span>
      </div>
      <input
        ref={setRefs}
        {...inputData}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        onKeyUp={syncScroll}
        onMouseUp={syncScroll}
        onSelect={syncScroll}
        onFocus={(e) => {
          syncScroll();
          onFocus?.(e);
        }}
        onBlur={onBlur}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        data-vf-input
        className={cn(
          "relative block w-full border-0 bg-transparent p-0 text-transparent caret-fg outline-0 [font-variant-ligatures:none]",
          "placeholder:text-fg3 placeholder:opacity-75 selection:bg-brass-soft selection:text-transparent",
          v.line,
          inputClassName,
        )}
      />
    </div>
  );
}

/** Read-only highlighted text (auto rows, labels). Tokens still get the provenance popover. */
export function VariableText({
  value,
  context,
  kind = "text",
  className,
}: {
  value: string;
  context: VariableContext;
  kind?: "text" | "url";
  className?: string;
}) {
  const segments = useMemo(() => (kind === "url" ? urlSegments(value) : textSegments(value)), [kind, value]);
  return (
    <span className={cn("[&_[data-pp]]:cursor-help [&_[data-var]]:cursor-help", className)}>
      <SegmentSpans segments={segments} context={context} />
    </span>
  );
}
