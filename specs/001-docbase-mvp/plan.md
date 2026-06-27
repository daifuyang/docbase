# Implementation Plan: DocBase 企业知识库 MVP

**Branch**: `001-docbase-mvp` | **Date**: 2026-06-27 | **Spec**: [spec.md](./spec.md)

## Summary

DocBase 是内部企业知识库。MVP 使用 TanStack Start + React + TypeScript + PostgreSQL + Drizzle + Redis + better-auth + TipTap + shadcn/ui，核心能力为登录访问、空间/分类组织、文档创建编辑、标签筛选、真实基础搜索和管理员治理。

## Technical Context

- **Runtime**: Node.js 20, TypeScript strict
- **Framework**: TanStack Start, TanStack Router, React Query
- **Data**: PostgreSQL 16, Drizzle ORM, Redis 7
- **Auth**: better-auth email/password, cookie session
- **Editor**: TipTap JSON, server-side HTML rendering, sanitize-html
- **UI**: shadcn/ui, Radix primitives, Tailwind v4
- **Testing**: Vitest, Playwright
- **Deploy**: Docker Compose + Caddy

## Constitution Check

| Principle | Status |
|-----------|--------|
| Modular Boundaries & Library-First | Pass: auth, documents, spaces, tags use separated server modules and shared schemas. |
| Test-First Delivery | Pass: validation and route behavior tests cover the replanned MVP; broader E2E can expand from the new user stories. |
| Contract & Journey Coverage | Pass: server function contracts define auth, spaces, documents, search and tags. |
| Production Observability & Operability | Pass: existing logger, health route, Docker and Redis patterns remain in place. |
| Spec-First Change Control | Pass: this plan replaces the old community spec chain. |
| Product Experience & Domain Fit | Pass: UI is Chinese enterprise knowledge-base oriented, with persistent sidebar and real search. |
| Security, Privacy & Data Integrity | Pass: content is login-gated, role checks protect governance APIs, TipTap HTML is sanitized. |

## Project Structure

Primary implementation areas:

- `db/schema/`: `auth`, `spaces`, `documents`, `tags`
- `src/server/`: `auth`, `spaces`, `documents`, `tags`
- `src/routes/`: `/`, `/auth/login`, `/documents/*`, `/spaces/*`, `/tags/*`
- `src/components/`: document list/form/search/sidebar/navigation primitives
- `specs/001-docbase-mvp/`: spec, contracts, data model, tasks, quickstart

## Complexity Tracking

No constitution violations. The old community model is intentionally removed instead of kept as compatibility surface.
