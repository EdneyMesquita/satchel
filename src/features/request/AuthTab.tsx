import type { ReactNode } from "react";
import type { AuthConfig, SatchelRequest } from "@/types";
import type { VariableContext } from "@/variables";
import { Segmented } from "@/components/common/Segmented";
import { VariableInput } from "@/features/variables/VariableInput";
import { switchAuth } from "./stash";

interface AuthTabProps {
  request: SatchelRequest;
  context: VariableContext;
  update: (updater: (r: SatchelRequest) => SatchelRequest) => void;
}

const AUTH_OPTIONS: { value: AuthConfig["type"]; label: string }[] = [
  { value: "none", label: "None" },
  { value: "bearer", label: "Bearer" },
  { value: "basic", label: "Basic" },
  { value: "apikey", label: "API key" },
];

export function AuthTab({ request, context, update }: AuthTabProps) {
  const auth = request.auth;
  const setAuth = (next: AuthConfig) => update((r) => ({ ...r, auth: next }));

  return (
    <div className="grid max-w-[520px] gap-3.5 p-3">
      <Segmented
        value={auth.type}
        onChange={(type) => setAuth(switchAuth(request.id, auth, type))}
        options={AUTH_OPTIONS}
        aria-label="Auth type"
      />
      {auth.type === "none" && <Hint>No auth. Headers you add yourself are sent as-is.</Hint>}
      {auth.type === "bearer" && (
        <Field label="Token">
          <Boxed>
            <VariableInput
              value={auth.token}
              onChange={(token) => setAuth({ ...auth, token })}
              context={context}
              placeholder="{{token}}"
              aria-label="Token"
            />
          </Boxed>
          <Hint>
            Sent as <span className="font-mono">Authorization: Bearer …</span>. It shows up under Headers as an auto header.
          </Hint>
        </Field>
      )}
      {auth.type === "basic" && (
        <>
          <Field label="Username">
            <Boxed>
              <VariableInput
                value={auth.username}
                onChange={(username) => setAuth({ ...auth, username })}
                context={context}
                placeholder="username"
                aria-label="Username"
              />
            </Boxed>
          </Field>
          <Field label="Password">
            <input
              type="password"
              value={auth.password}
              onChange={(e) => setAuth({ ...auth, password: e.target.value })}
              placeholder="password"
              autoComplete="off"
              aria-label="Password"
              className="block h-8 w-full rounded-md border border-line2 bg-bg0 px-2.5 font-mono text-[12.5px] leading-[30px] outline-0 placeholder:text-fg3 focus:border-brass-line"
            />
          </Field>
        </>
      )}
      {auth.type === "apikey" && (
        <>
          <Field label="Key">
            <Boxed>
              <VariableInput value={auth.key} onChange={(key) => setAuth({ ...auth, key })} context={context} placeholder="X-Api-Key" aria-label="Key" />
            </Boxed>
          </Field>
          <Field label="Value">
            <Boxed>
              <VariableInput
                value={auth.value}
                onChange={(value) => setAuth({ ...auth, value })}
                context={context}
                placeholder="{{apiKey}}"
                aria-label="Value"
              />
            </Boxed>
          </Field>
          <Field label="Add to">
            <Segmented
              value={auth.in}
              onChange={(where) => setAuth({ ...auth, in: where })}
              options={[
                { value: "header", label: "Header" },
                { value: "query", label: "Query params" },
              ]}
              aria-label="Add to"
            />
          </Field>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <label className="text-xs text-fg3">{label}</label>
      {children}
    </div>
  );
}

function Boxed({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-line2 bg-bg0 focus-within:border-brass-line">{children}</div>;
}

function Hint({ children }: { children: ReactNode }) {
  return <div className="text-xs leading-normal text-fg3">{children}</div>;
}
