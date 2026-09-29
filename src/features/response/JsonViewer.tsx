import { memo, useMemo } from "react";
import { JSON_TOKEN_CLASS, tokenizeJsonLike } from "@/jsonTokens";

/** Past this, skip per-token coloring — a multi-MB body would mount hundreds of thousands of spans. */
const HIGHLIGHT_LIMIT = 300_000;

interface JsonViewerProps {
  text: string;
  /** color JSON tokens; plain text otherwise */
  json: boolean;
}

/** Read-only code view with a line-number gutter. */
export const JsonViewer = memo(function JsonViewer({ text, json }: JsonViewerProps) {
  const lineNumbers = useMemo(() => {
    let n = 1;
    for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
    return Array.from({ length: n }, (_, i) => i + 1).join("\n");
  }, [text]);

  const content = useMemo(() => {
    if (!json || text.length > HIGHLIGHT_LIMIT) return text;
    return tokenizeJsonLike(text).map((run, i) => {
      const cls = JSON_TOKEN_CLASS[run.kind];
      return cls ? (
        <span key={i} className={cls}>
          {run.text}
        </span>
      ) : (
        run.text
      );
    });
  }, [text, json]);

  return (
    <div className="grid grid-cols-[auto_1fr] pt-2 pb-6 font-mono text-[12.5px] leading-5">
      <div aria-hidden className="pr-2.5 pl-3 text-right whitespace-pre text-fg3 opacity-60 select-none">
        {lineNumbers}
      </div>
      <div className="min-w-0 pr-4 whitespace-pre">{content}</div>
    </div>
  );
});
