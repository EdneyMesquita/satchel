## What does this change do, and why?

<!-- Link an issue if there is one. -->

## How was this tested?

<!--
- Unit tests added/updated (src/*.test.ts)?
- If this touches request sending, Postman import, or curl parsing: did you
  test it against a real request/collection/curl command, not just the
  parser output? Which one?
- Manual testing steps, if any.
-->

## Checklist

- [ ] `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, and `cargo test` pass locally (in `src-tauri/`)
- [ ] `npm test` and `npm run build` pass locally
- [ ] This PR is focused on one thing (a bug fix or one feature, not several unrelated changes)
