# Satchel

Satchel is an open-source, cross-platform desktop API client, built on [Tauri](https://tauri.app). It's a small, fast alternative to Postman-style tools: organize HTTP requests into collections, send them, and inspect the response — without a background Electron process or an account.

**Core feature: importing Postman collections.** Drop in a Postman [Collection Format v2.1](https://learning.postman.com/collection-format/getting-started/overview/) export and Satchel rebuilds it — folders, requests, headers, bodies, auth, and `{{variables}}` — as a native Satchel collection. See `src/postman.ts` for the importer and its Postman → Satchel field mapping.

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
  collectionTree.ts       helpers for finding/updating a request inside the collection tree
  components/
    Sidebar.tsx           collection tree + import button
    RequestEditor.tsx      method/url bar, params/headers/body/auth tabs, send + response
src-tauri/                Rust shell (Tauri config, HTTP plugin wiring)
```

## Status

Early scaffold. Working: Postman import, editing requests, sending them, viewing the response. Not yet built: exporting/saving collections to disk, environments beyond collection-level variables, request history, form-data bodies, GraphQL bodies, tests/scripts.

## License

MIT
