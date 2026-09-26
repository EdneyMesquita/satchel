# Security

## Reporting a vulnerability

Please use [GitHub's private vulnerability reporting](https://github.com/matheuscaet/satchel/security/advisories/new) for this repo, or email **matheuseprofissional@gmail.com**, rather than opening a public issue. Include what you found, how to reproduce it, and its impact if you can. This is a young, single-maintainer project without a formal SLA, but reports will be acknowledged and fixed as quickly as reasonably possible.

## How data is stored

Collections, environments, and globals - including any bearer tokens, API keys, or passwords you put in an Auth tab - are saved as **plain JSON**, either in the workspace file you choose to save to, or in the browser/webview's `localStorage` as a working cache before you save one. This mirrors how Postman's own collection and environment exports work: there is no encryption-at-rest for request data.

Practically, that means:

- Don't commit a saved workspace file to a public repo if it has real secrets in it, the same way you wouldn't commit a Postman environment export.
- Anyone with access to your machine's user account can read a saved workspace file or the app's local storage.

If you need secrets that never touch disk in plaintext, keep them out of the workspace file and paste them in per-request when you need to send something - a real secret manager backing environment variables is tracked as a future improvement, not something Satchel does today.

## Outbound requests aren't sandboxed like a browser tab

Requests are sent from the Rust side (`tauri-plugin-http`), specifically so they aren't subject to browser CORS restrictions - that's the whole point of a desktop API client. This means Satchel will send a request with whatever headers, auth, and body you've configured to whatever host you point it at, the same way `curl` or Postman's desktop app would. Treat an imported collection or a pasted curl command the same way you'd treat a downloaded shell script: know what it does before you hit Send, especially if it came from somewhere you don't trust.

## Parsing untrusted input

Postman collection files, pasted curl commands, and workspace files are all treated as inert data:

- Collection and workspace files are parsed with `JSON.parse` plus explicit shape validation (see `src/postman.ts` and `src/workspace.ts`) - never `eval`'d or otherwise executed.
- A pasted curl command is tokenized and read for its flags (`-X`, `-H`, `-d`, `-u`, ...) to populate a request's fields - the string is never handed to a shell, so it can't execute anything (see `src/curl.ts`).

A malformed or malicious file/curl string can at worst produce an incorrect or malformed request; it can't run code on your machine through Satchel itself.

## Known limitations

- No code signing yet, so release builds are unsigned. Verify you're downloading from this repository's [Releases](https://github.com/matheuscaet/satchel/releases) page.
- No automatic update mechanism yet - you'll need to download new releases manually.
