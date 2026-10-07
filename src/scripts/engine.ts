import { newQuickJSWASMModuleFromVariant, newVariant, type QuickJSWASMModule } from "quickjs-emscripten-core";
import variant from "@jitl/quickjs-wasmfile-release-sync";

/** 64 KiB pages: the engine starts at 16 MiB and can't grow past 256 MiB, whatever a script does. */
const INITIAL_PAGES = 256;
const MAX_PAGES = 4096;

/**
 * A QuickJS engine with its own capped memory. `wasmLocation` is the .wasm
 * URL in the app (Vite can't follow the variant's own import.meta.url once it
 * pre-bundles it); tests in node leave it out and the variant finds its file.
 */
export function loadQuickJS(wasmLocation?: string, maxPages = MAX_PAGES): Promise<QuickJSWASMModule> {
  return newQuickJSWASMModuleFromVariant(
    newVariant(variant, {
      ...(wasmLocation ? { wasmLocation } : {}),
      wasmMemory: new WebAssembly.Memory({ initial: INITIAL_PAGES, maximum: maxPages }),
    }),
  );
}
