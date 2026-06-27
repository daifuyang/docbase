# Tasks: DocBase 企业知识库 MVP

## Phase 1: Replan Documentation

- [X] Replace community spec with enterprise knowledge-base spec.
- [X] Replace plan, data model, contracts and task list.
- [X] Update README and constitution wording to remove community assumptions.

## Phase 2: Data Model

- [X] Add `user.role`.
- [X] Add `space` and `category` schema.
- [X] Replace `post` with `document`.
- [X] Replace `post_tag` with `document_tag`.
- [X] Remove comments and likes from MVP schema exports.

## Phase 3: Server Functions

- [X] Add `documents` server module for list/search/detail/create/update/delete.
- [X] Add `spaces` server module for listing and admin creation.
- [X] Add admin-only `createMember`.
- [X] Remove community server modules.

## Phase 4: UI

- [X] Replace post components with document components.
- [X] Add `/documents/new`, `/documents/$slug`, `/documents/$slug/edit`.
- [X] Add `/spaces/$slug`.
- [X] Update home, sidebar, tag page, nav and sitemap to document routes.
- [X] Connect search dialog to real document search.
- [X] Remove open register route and public user profile route.

## Phase 5: Validation

- [X] Add document validation tests.
- [X] Run `pnpm typecheck`.
- [X] Run targeted `pnpm test`.
- [X] Regenerate migrations after schema decision is finalized.
- [X] Run `pnpm build`.
