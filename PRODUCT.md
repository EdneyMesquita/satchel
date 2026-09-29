# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(Rendered inside a Tauri 2 desktop webview on macOS, Windows, and Linux; default window 1080×720. The UI is a single-window desktop app, not a website.)

## Users

Developers testing their own API while they build it: backend and full-stack engineers mid-development, firing requests constantly, switching between Local and Production, pasting a "Copy as cURL" from the browser to reproduce a call. Sessions are short and frequent; the app is open beside an editor and a terminal all day.

## Product Purpose

Satchel is a small, fast, open-source desktop API client: organize HTTP requests into collections, send them, and inspect the response, without a background Electron process or an account. Success is the shortest possible loop between "I changed the endpoint" and "I can see what it returns now".

## Positioning

Local-first and account-free by construction: the whole workspace is one plain `.json` file on disk that the user picks, versions, and owns. Postman collections and cURL commands are doors in, not dependencies; everything becomes a native Satchel collection the user keeps editing.

## Operating Context

- Runs next to a code editor and a terminal; requests are re-sent many times per minute while iterating.
- Common entry points: paste a cURL from browser devtools (sidebar or directly into the URL field), import a Postman v2.1 export, or create a request from scratch.
- Variables resolve with precedence active environment → collection → globals, via `{{name}}` in URL, params, headers, auth, and body.
- Workspace auto-saves (debounced) to the chosen file; before a file is picked, it lives in a localStorage cache.

## Capabilities and Constraints

- Collections, nested folders, requests: create, rename, delete.
- Methods GET, POST, PUT, PATCH, DELETE, QUERY, HEAD, OPTIONS.
- Request tabs: Params (query, synced with the URL, and `/:name` path params), Headers, Body (none / JSON with Beautify / form data with text and file fields / x-www-form-urlencoded), Auth (none, Bearer, Basic, API key in header or query), Rate Limit (burst N req/s for T seconds, charted, first 429 marked).
- Response: status, time, size; body as Pretty, Tree, Table or Raw with search; headers list; a pop-out response window.
- Environments plus a Globals bucket; one active environment at a time.
- Save / Open workspace file; Postman import; cURL paste.
- Not built yet: request history, native GraphQL, pre/post-request scripts. Future work must not show these as shipped.
- Stack: Tauri 2 (Rust) + React + TypeScript, shadcn/ui on Tailwind v4, no state library.

## Brand Commitments

- Name "Satchel" and the satchel-bag mark (`public/icon.png`, inline SVG in `Sidebar.tsx`) are kept.
- Local-first / `.json` workspace file is a visible part of the product, not hidden plumbing.
- Dark by default with a light twin; brass is reserved for Send, selection and focus.
- Standing preference (2026-09-28): the category-standard layout (tree sidebar, request tabs, URL bar + Send, request/response panes), executed at the craft level of Bruno, Insomnia, Yaak, and Postman. Convention is the commitment; no novelty world.

## Evidence on Hand

- README screenshot of the current UI; source in `src/`.
- No users, testimonials, benchmarks, or download numbers exist; never invent them.

## Product Principles

1. The request is the hero: URL, status, and response body outrank every piece of chrome.
2. Density over air: a developer should see method, URL, variables, status, and body without scrolling or opening panels.
3. One loop, zero ceremony: edit → send → read should be keyboard-reachable and never interrupted by modals.
4. Honest about where things live: which file the workspace is in, which environment is active, and where each `{{variable}}` resolves from are always visible.
5. Not a Postman clone: fewer surfaces, no team/cloud chrome, nothing the product does not do.
