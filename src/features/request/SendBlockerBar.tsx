interface SendBlockerBarProps {
  missing: string[];
  environmentName: string | undefined;
  onDefine: () => void;
  onSendAnyway: () => void;
}

const LINK = "text-fg2 underline decoration-line2 underline-offset-[3px] hover:text-fg hover:decoration-current whitespace-nowrap";

/** Inline bar under the URL when a send was held back for undefined {{variables}}. */
export function SendBlockerBar({ missing, environmentName, onDefine, onSendAnyway }: SendBlockerBarProps) {
  const where = environmentName ?? "any scope";
  return (
    <div role="alert" className="mt-2 flex flex-wrap items-center gap-2.5 rounded-md bg-err-soft px-2.5 py-1.5 text-[12.5px] text-fg">
      <b className="font-mono font-medium text-err">{missing.map((n) => `{{${n}}}`).join(", ")}</b>
      <span>
        {missing.length === 1 ? "isn't" : "aren't"} defined in {where}, so {missing.length === 1 ? "it" : "they"} would be sent literally.
      </span>
      <span className="flex-1" />
      <button type="button" className={LINK} onClick={onDefine}>
        {environmentName ? `Define in ${environmentName}` : "Define it"}
      </button>
      <button type="button" className={LINK} onClick={onSendAnyway}>
        Send anyway
      </button>
    </div>
  );
}
