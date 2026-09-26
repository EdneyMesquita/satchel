# Satchel

Satchel is an open-source, cross-platform desktop API client, built on [Tauri](https://tauri.app). It's a small, fast alternative to Postman-style tools: organize HTTP requests into collections, send them, and inspect the response — without a background Electron process or an account.

Satchel is a standalone tool first: build collections, folders, and requests directly in the app — no import required. Postman collections are a door in, not a dependency: drop in a [Collection Format v2.1](https://learning.postman.com/collection-format/getting-started/overview/) export and Satchel rebuilds it — folders, requests, headers, bodies, auth, and `{{variables}}` — as native Satchel collections you keep editing afterward. See `src/postman.ts` for the importer and its Postman → Satchel field mapping.

## Stack

- [Tauri 2](https://tauri.app) (Rust) for the native shell and outbound HTTP (via `tauri-plugin-http`, which sends requests from the Rust side to avoid browser CORS restrictions — the whole point of an API client)
- React + TypeScript for the UI
- No state library, no CSS framework — a handful of components and one stylesheet

## Getting started

```bash
npm install
npm run tauri dev
```

`npm run dev` alone runs just the Vite dev server in a regular browser tab — useful for UI work, but outbound requests will be subject to normal browser CORS rules since the Tauri HTTP bridge isn't present. Use `npm run tauri dev` to test real request sending.

## Project layout

```
src/
  types.ts              Satchel's own request/collection model
  postman.ts             Postman v2.1 → Satchel collection importer
  collectionTree.ts       tree ops: create/add/remove/rename/find nodes, resolve {{variables}}
  components/
    Sidebar.tsx           collection tree — create/rename/delete collections, folders, requests; import button
    RequestEditor.tsx      method/url bar, params/headers/body/auth tabs, send + response
src-tauri/                Rust shell (Tauri config, HTTP plugin wiring)
```

## Status

Early scaffold. Working: creating and editing collections/folders/requests from scratch, Postman import, sending requests, viewing the response. Collections persist to `localStorage` between sessions (see `STORAGE_KEY` in `App.tsx`) — not yet a real file on disk, so it won't survive a browser profile reset. Not yet built: exporting collections to a `.json`/`.satchel` file, environments beyond collection-level variables, request history, form-data bodies, GraphQL bodies, tests/scripts.

## License

MIT
