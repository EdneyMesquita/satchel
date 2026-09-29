import { Layers, X } from "lucide-react";
import { IconButton } from "@/features/shell/IconButton";
import { Hint, LinkButton } from "@/components/common/Modal";
import { plural, type AttachedEnvironment } from "./importModel";
import { SectionLabel } from "./ImportWarnings";

interface AttachedEnvironmentsProps {
  attached: AttachedEnvironment[];
  /** name each one will get (de-duplicated against existing environments) */
  plannedNames: string[];
  onRemove: (id: string) => void;
  onAdd: () => void;
}

/** Postman environment files that will become new Satchel environments. */
export function AttachedEnvironments({ attached, plannedNames, onRemove, onAdd }: AttachedEnvironmentsProps) {
  return (
    <>
      <SectionLabel>Environments</SectionLabel>
      <div className="grid gap-1.5">
        {attached.map((a, i) => {
          const planned = plannedNames[i];
          return (
            <div key={a.id} className="flex h-[34px] min-w-0 items-center gap-2 rounded-md border border-line pr-1.5 pl-3 text-[12.5px]">
              <Layers className="size-3.5 flex-none" />
              <b className="min-w-0 truncate font-medium">{a.environment.name}</b>
              <span className="whitespace-nowrap text-fg3">
                · {plural(a.environment.variables.length, "variable")} → new environment
                {planned && planned !== a.environment.name ? ` “${planned}”` : ""}
              </span>
              <span className="flex-1" />
              <IconButton aria-label={`Remove ${a.environment.name}`} onClick={() => onRemove(a.id)}>
                <X className="size-2.5" strokeWidth={2.4} />
              </IconButton>
            </div>
          );
        })}
        <Hint>
          <LinkButton onClick={onAdd}>Add a Postman environment file…</LinkButton>
        </Hint>
      </div>
    </>
  );
}
