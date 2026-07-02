<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->

## Service working agreement

- Domain logic lives in `src/server/services/`. Web routes and automation
  should extend and call the service layer rather than duplicating business
  logic in handlers.
- Authentication uses Better Auth session cookies for the Web. The
  `@better-auth/api-key` plugin remains available for server-side API key
  validation, but there is no first-party `docbase` CLI entry point.
