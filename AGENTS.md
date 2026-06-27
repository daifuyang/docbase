<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->

## CLI working agreement

- The `docbase` CLI lives in `src/cli/` and is the canonical entry point for
  AI agents and automation. It runs in-process via `tsx` (no separate HTTP
  server needed) and shares the same DB / auth / Redis instances as the Web.
- All CLI commands call service-layer functions in `src/server/services/`.
  Do not re-implement domain logic in CLI handlers — extend the service
  layer and call it through `ApiClient`.
- Authentication uses the `@better-auth/api-key` plugin. Credentials live
  in `~/.config/docbase/credentials.json` (mode 0600). Use
  `DOCBASE_CREDENTIALS_PATH` to override for tests.
- Markdown → TipTap conversion lives in `src/cli/markdown.ts`. Use
  `gray-matter` for frontmatter and `marked` + `@tiptap/html`'s
  `generateJSON` for body conversion; do not add a custom AST walker.
- Exit codes: `0` ok, `1` internal error, `2` validation, `3` unknown,
  `4` 401, `5` 403, `6` 429. Use `src/cli/errors.ts` `handleError`.