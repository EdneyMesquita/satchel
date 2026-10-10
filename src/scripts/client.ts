import type { ScriptInput, ScriptResult } from "./types";

/** A script that hasn't answered by then is stopped with its worker (the engine stops at 1 s on its own). */
const WATCHDOG_MS = 4000;

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, { resolve: (r: ScriptResult) => void; timer: ReturnType<typeof setTimeout> }>();

function failAll(message: string) {
  for (const [id, p] of pending) {
    clearTimeout(p.timer);
    p.resolve({ changes: [], logs: [{ level: "error", message }], error: { message, line: null } });
    pending.delete(id);
  }
}

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  w.onmessage = (e: MessageEvent<{ id: number; result: ScriptResult }>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    clearTimeout(p.timer);
    pending.delete(e.data.id);
    p.resolve(e.data.result);
  };
  w.onerror = (e) => {
    e.preventDefault();
    restart(`The script engine stopped: ${e.message || "unknown error"}`);
  };
  worker = w;
  return w;
}

function restart(message: string) {
  worker?.terminate();
  worker = null;
  failAll(message);
}

/** Run a script in the sandbox. Never rejects: failures come back as `error`. */
export function runScript(input: ScriptInput): Promise<ScriptResult> {
  const id = ++nextId;
  return new Promise((resolve) => {
    const timer = setTimeout(() => restart("The script didn't finish and was stopped."), WATCHDOG_MS);
    pending.set(id, { resolve, timer });
    getWorker().postMessage({ id, input });
  });
}
