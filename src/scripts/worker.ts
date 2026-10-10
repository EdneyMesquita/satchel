import wasmUrl from "@jitl/quickjs-wasmfile-release-sync/wasm?url";
import type { QuickJSWASMModule } from "quickjs-emscripten-core";
import { loadQuickJS } from "./engine";
import { runInQuickJS } from "./runtime";
import type { ScriptInput, ScriptResult } from "./types";

// Scripts run here, off the window's thread: the engine is loaded on the first run and kept.
let engine: Promise<QuickJSWASMModule> | null = null;

// The DOM typings are in scope, not the worker ones: describe the little this file uses.
const scope = self as unknown as {
  onmessage: (e: MessageEvent<{ id: number; input: ScriptInput }>) => void;
  postMessage: (message: { id: number; result: ScriptResult }) => void;
};

scope.onmessage = async (e) => {
  const { id, input } = e.data;
  let result: ScriptResult;
  try {
    engine ??= loadQuickJS(wasmUrl);
    result = runInQuickJS(await engine, input);
  } catch (err) {
    // The engine aborted (memory full) or failed to load: start over with a fresh one next time.
    engine = null;
    const message = /abort|memory/i.test(String(err)) ? "The script ran out of memory and was stopped." : `The script engine failed: ${String(err)}`;
    result = { changes: [], logs: [{ level: "error", message }], error: { message, line: null } };
  }
  scope.postMessage({ id, result });
};
