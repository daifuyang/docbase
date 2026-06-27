# Server Functions Contracts: DocBase 企业知识库 MVP

## Common

- 所有知识内容读取和写入默认要求 better-auth session。
- 所有输入经 Zod 校验。
- 管理员接口必须检查 `user.role === 'admin'`。
- 错误使用统一 `ServerError` code/status/message。

## Auth

- `getCurrentUser() -> PublicUser | null`
- `signIn({ account, password }) -> { user, session }`
- `signOut() -> { ok: true }`
- `createMember({ email, username, password, displayName? }) -> { user }`
  - Auth: admin

## Spaces

- `listSpaces() -> { items: SpaceSummary[] }`
- `listCategoriesBySpace({ spaceId }) -> { items: CategorySummary[] }`
- `createSpace({ name, description? }) -> { space }`
  - Auth: admin
- `createCategory({ spaceId, name, description? }) -> { category }`
  - Auth: admin

## Documents

- `listDocuments({ query?, spaceSlug?, categorySlug?, tagSlug?, page?, pageSize? })`
  - Auth: member/admin
  - Returns published documents by default, sorted by `updated_at DESC`
- `searchDocuments(...)`
  - Alias of the same document query behavior, used by global search dialog
- `getDocumentBySlug({ slug }) -> DocumentDetail | null`
  - Auth: member/admin
  - Drafts visible only to creator
- `createDocument({ title, contentJson, tags, status, spaceId, categoryId? })`
  - Auth: member/admin
  - Rate limit: 10/min/user
- `updateDocument({ id, title?, contentJson?, tags?, status?, spaceId?, categoryId? })`
  - Auth: creator
- `deleteDocument({ id }) -> { ok: true }`
  - Auth: creator
- `listMyDocuments({ status?, page?, pageSize? })`
  - Auth: member/admin

## Tags

- `listTags({ limit? }) -> { items: Tag[] }`

## UI Route Contracts

- `/`: login-gated knowledge home
- `/documents/new`: create document
- `/documents/$slug`: document detail
- `/documents/$slug/edit`: edit document
- `/spaces/$slug`: space document list
- `/tags/$slug`: tag document list
- `/auth/login`: login
