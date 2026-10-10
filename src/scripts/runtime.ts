import { shouldInterruptAfterDeadline, type QuickJSWASMModule } from "quickjs-emscripten-core";
import { PRELUDE } from "./prelude";
import type { ScriptInput, ScriptResult } from "./types";

/** A script runs start to finish within this. */
export const TIME_LIMIT_MS = 1000;
const MEMORY_LIMIT = 64 * 1024 * 1024;
const STACK_LIMIT = 1024 * 1024;

interface Out {
  logs: ScriptResult["logs"];
  changes: ScriptResult["changes"];
  request: ScriptResult["request"] | null;
  response: ScriptResult["response"] | null;
}

/** The line in the user's script an error points at (its stack names "script.js:LINE:COL"). */
export function errorLine(stack: unknown): number | null {
  const m = typeof stack === "string" ? /script\.js:(\d+)/.exec(stack) : null;
  return m ? Number(m[1]) : null;
}

function describe(error: unknown, timedOut: boolean): string {
  if (timedOut) return `The script ran for more than ${TIME_LIMIT_MS / 1000} s and was stopped.`;
  if (error && typeof error === "object" && "message" in error) {
    const e = error as { name?: string; message?: string };
    if (/out of memory/i.test(e.message ?? "")) return "The script ran out of memory and was stopped.";
    return `${e.name ?? "Error"}: ${e.message}`;
  }
  return String(error);
}

/**
 * Run one script in a fresh QuickJS runtime: no host functions, a deadline, a
 * memory limit, and everything disposed afterwards. Synchronous; the app calls
 * it from a worker (see worker.ts).
 *
 * QuickJS's own memory limit misses large single allocations, so a script that
 * fills the engine's capped wasm memory makes the engine abort: that throws,
 * and the caller must load a new engine.
 */
export function runInQuickJS(qjs: QuickJSWASMModule, input: ScriptInput): ScriptResult {
  const runtime = qjs.newRuntime();
  runtime.setMemoryLimit(MEMORY_LIMIT);
  runtime.setMaxStackSize(STACK_LIMIT);
  const deadline = Date.now() + TIME_LIMIT_MS;
  runtime.setInterruptHandler(shouldInterruptAfterDeadline(deadline));
  const vm = runtime.newContext();
  try {
    const json = vm.newString(JSON.stringify(input));
    vm.setProp(vm.global, "__SAT_INPUT", json);
    json.dispose();
    const prelude = vm.evalCode(PRELUDE, "prelude.js");
    if (prelude.error) {
      const e = vm.dump(prelude.error);
      prelude.error.dispose();
      return { changes: [], logs: [], error: { message: `Couldn't start the script: ${describe(e, false)}`, line: null } };
    }
    prelude.value.dispose();

    const run = vm.evalCode(input.code, "script.js");
    let error: ScriptResult["error"];
    if (run.error) {
      const e = vm.dump(run.error);
      run.error.dispose();
      const timedOut = Date.now() >= deadline;
      error = { message: describe(e, timedOut), line: timedOut ? null : errorLine((e as { stack?: unknown })?.stack) };
    } else {
      run.value.dispose();
    }

    // What the script did before it finished (or failed) still shows in the Console.
    runtime.removeInterruptHandler();
    const read = vm.evalCode("JSON.stringify(globalThis.__satOut)", "read.js");
    let out: Out = { logs: [], changes: [], request: null, response: null };
    if (read.error) read.error.dispose();
    else {
      out = JSON.parse(vm.getString(read.value)) as Out;
      read.value.dispose();
    }
    if (error) {
      out.logs.push({ level: "error", message: error.line ? `${error.message} (line ${error.line})` : error.message });
      return { changes: out.changes, logs: out.logs, error };
    }
    return {
      changes: out.changes,
      logs: out.logs,
      ...(out.request ? { request: out.request } : {}),
      ...(out.response ? { response: out.response } : {}),
    };
  } finally {
    // After the engine aborts (its memory is full) disposing throws too: the caller drops the engine.
    try {
      vm.dispose();
      runtime.dispose();
    } catch {
      // the engine is gone with everything in it
    }
  }
}
